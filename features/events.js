import { google } from 'googleapis';
import { supabase } from '../core/supabase.js';
import { getAuthClient } from '../core/calendar.js';
import { detectCategory, translateIndoToChrono, cleanTitle } from '../core/utils.js';
import { addReminder } from '../core/reminders.js';
import * as chrono from 'chrono-node';
import { generateAITitle } from '../core/ai.js';
import { trackEvent } from './stats.js';

export async function handleEventCreation(bot, msg, text) {
    const chatId = msg.chat.id;

    // --- NLP PARSING & EVENT CREATION (Rule-Based) ---
    const translatedText = translateIndoToChrono(text);
    // Parse using timezone offset (420 minutes = +07:00) so "today" is evaluated correctly in WIB relative to current time
    const parsedResults = chrono.parse(translatedText, { instant: new Date(), timezone: 420 }, { forwardDate: true, timezone: 420 }); // GMT+7

    // Tidak ada waktu terdeteksi -> Kemungkinan chat biasa/curhat
    if (parsedResults.length === 0) {
        return false;
    }

    // Waktu terdeteksi -> Lanjut bikin event
    let startHour = null;
    let startMinute = 0;
    let endHour = null;
    let endMinute = 0;
    let baseRes = parsedResults[0];

    for (const res of parsedResults) {
        if (res.start && res.start.isCertain('day')) {
            baseRes = res; // Pakai hasil yang punya informasi hari yg pasti
        }

        // Cek hour dari knownValues (pasti)
        const hasHour = res.start && res.start.isCertain('hour');

        if (hasHour) {
            if (startHour === null) {
                startHour = res.start.get('hour');
                startMinute = res.start.get('minute') || 0;

                const hasEndHour = res.end && res.end.isCertain('hour');
                if (hasEndHour) {
                    endHour = res.end.get('hour');
                    endMinute = res.end.get('minute') || 0;
                }
            } else if (endHour === null) {
                // Time kedua yg ditemukan dianggap sebagai end time (misal "jam 10 sampe jam 12")
                endHour = res.start.get('hour');
                endMinute = res.start.get('minute') || 0;
            }
        }
    }

    if (startHour === null) {
        const askTimeMsg = process.env.BOT_MODE === 'abang'
            ? "Aku tangkap kegiatannya, tapi jam berapa tuh Salma? 🤍\nCoba sebut jamnya ya, misal: \"jam 15\"."
            : "Aku tangkap kegiatannya, tapi jam berapa tuh bang? 🤍\nCoba sebut jamnya ya, misal: \"jam 15\".";
        await bot.sendMessage(chatId, askTimeMsg);
        return true;
    }

    const baseParsedDate = baseRes.start.date();
    const baseYear = baseParsedDate.getUTCFullYear();
    const baseMonth = baseParsedDate.getUTCMonth();
    const baseDay = baseParsedDate.getUTCDate();

    let start = new Date(Date.UTC(baseYear, baseMonth, baseDay, startHour - 7, startMinute, 0, 0));

    let end;
    if (endHour !== null) {
        end = new Date(Date.UTC(baseYear, baseMonth, baseDay, endHour - 7, endMinute, 0, 0));
        // Jika end time lebih kecil dari start time (misal 23.00 ke 01.00), anggap besoknya
        if (end < start) end.setUTCDate(end.getUTCDate() + 1);
    } else {
        end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1 jam
    }

    // Rule-Based Location Extraction
    let location = 'Online';
    if (text.toLowerCase().includes(' di ')) {
        const parts = text.split(/ di /i);
        if (parts.length > 1) {
            location = parts.pop().trim();
            location = location.replace(/\b(?:jam|pukul)\s*\d{1,2}(?:\.\d{2})?(?:\s*(?:pagi|siang|sore|malam))?\b/gi, '');
            location = location.replace(/\b(?:sampe|sampai|s\/d)\s*(?:jam|pukul)?\s*\d{1,2}(?:\.\d{2})?\b/gi, '');
            location = location.replace(/\b(?:besok|lusa|hari ini|nanti|minggu depan|bulan depan|tahun depan)\b/gi, '');
            location = location.replace(/\b(?:pagi|siang|sore|malam)\b/gi, '').trim();
            // Relative time cleaning
            location = location.replace(/\b\d+\s+(?:menit|jam)\s+lagi\b/gi, '').trim();
            if (!location) location = 'Online';
        }
    }

    const aiTitle = await generateAITitle(text);
    let rawTitle = aiTitle || cleanTitle(text);
    if (rawTitle.toLowerCase() === 'undefined' || rawTitle.trim() === '') {
        rawTitle = cleanTitle(text) || 'Agenda';
    }

    const titleCategory = detectCategory(rawTitle);

    const authClient = await getAuthClient(chatId, bot);
    if (!authClient) return true;
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const eventObj = {
        summary: titleCategory,
        location: location,
        description: `Dibuat oleh ${process.env.BOT_NAME || 'Amaa Remind'}: "${text}"`,
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Jakarta' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Jakarta' },
    };

    try {
        const res = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventObj,
        });

        const eventId = res.data.id;
        console.log('Event created:', res.data.htmlLink);

        await supabase
            .from('user_state')
            .upsert({ chat_id: chatId.toString(), last_google_event_id: eventId, bot_mode: process.env.BOT_MODE });

        await trackEvent(titleCategory, start.getHours());

        const reminderTime = start.getTime() - (30 * 60 * 1000); // 30 mins before
        if (reminderTime > Date.now()) {
            await addReminder(chatId, titleCategory, reminderTime, start.getTime());
        }

        const dateStr = start.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
        const timeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

        const isAbang = process.env.BOT_MODE === 'abang';
        const replyMsg = isAbang
            ? `Siaap Salma! Jadwal udah aku masukin kalendar yaa ✅\n\n📌 <b>${titleCategory}</b>\n📅 ${dateStr}\n⏰ Jam ${timeStr}\n📍 Lokasi: ${location}\n\nNanti aku ingetin 30 menit sebelum mulai 🤍`
            : `Sip! Jadwal sudah masuk Google Calendar ✅\n\n📌 📝 <b>${titleCategory}</b>\n📅 ${dateStr}\n⏰ Jam ${timeStr}\n📍 Lokasi: ${location}\n\nAku kasih tau 30 menit sebelum mulai ya 🤍`;

        await bot.sendMessage(chatId, replyMsg, { parse_mode: 'HTML' });
    } catch (err) {
        console.error('Error creating event:', err);
        const errMsg = process.env.BOT_MODE === 'abang'
            ? "Aduh maaf Salma, gagal simpan ke kalendar nih 😔 Coba ketik lagi ya."
            : "Waduh gagal simpan jadwal ke kalendar nih bang 😔 Coba diulang.";
        await bot.sendMessage(chatId, errMsg);
    }
    return true;
}
