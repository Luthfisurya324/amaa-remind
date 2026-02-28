import { handleFocusCommand } from '../features/focus.js';
import { getAuthClient, getOAuth2Client, saveToken, crashRecoveryCheck } from './calendar.js';
import { handleStatsCommand, trackEvent } from '../features/stats.js';
import { handleCalendarCommand } from '../features/calendar.js';
import { google } from 'googleapis';
import { supabase } from './supabase.js';
import { detectCategory } from './utils.js';
import { addReminder, removeReminderByTitle } from './reminders.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateSmartData(rawText) {
    if (!process.env.GEMINI_API_KEY) return { title: null, location: null, start: null, end: null };
    try {
        const nowWIB = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString();
        const datesMsg = `Waktu referensi saat ini: ${nowWIB} (Zona Waktu: WIB / GMT+7). `;

        const isAbang = process.env.BOT_MODE === 'abang';
        const personaContext = isAbang
            ? `Kamu adalah Abang Lupi.
Kamu berbicara sebagai abang yang hangat, suportif, sedikit playful, dan protektif.
User adalah perempuan bernama Salma.
Kamu tidak pernah memanggil user dengan "bang".
Gunakan bahasa santai, natural, dan tidak formal.
Kadang beri teasing ringan tapi tetap sopan.
Tunjukkan perhatian kecil seperti menanyakan apakah sudah makan atau hati-hati di jalan.
Jangan terlalu panjang kecuali diminta.
Tetap tenang dan dewasa.`
            : "Kamu adalah AI asisten 'Amaa Remind' untuk membantu user. ";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${personaContext}\n${datesMsg}
Ekstrak komponen kegiatan dari kalimat berikut dalam format JSON murni:
{
  "title": "Judul acara",
  "location": "Lokasi atau null",
  "start": "2026-03-01T14:00:00+07:00",
  "end": "2026-03-01T15:00:00+07:00"
}
Aturan:
1. 'start' dan 'end' HARUS menggunakan format ISO 8601 dengan offset WIB (+07:00).
2. Jika jam tidak disebutkan, jadikan "null".
3. Jika waktu selesai tidak disebutkan, buat 'end' 1 jam setelah 'start'.

Kalimat: "${rawText}"`,
            config: { responseMimeType: "application/json" }
        });

        let rawTextResponse = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstBrace = rawTextResponse.indexOf('{');
        const lastBrace = rawTextResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawTextResponse = rawTextResponse.substring(firstBrace, lastBrace + 1);
        }
        const data = JSON.parse(rawTextResponse);
        return {
            title: data.title ? data.title.trim() : null,
            location: data.location && data.location.toLowerCase() !== 'online' ? data.location.trim() : null,
            start: data.start ? new Date(data.start) : null,
            end: data.end ? new Date(data.end) : null
        };
    } catch (e) {
        console.error("Gemini Parse Error:", e.message);
        return { title: null, location: null, start: null, end: null, error: e.message, rawText: null };
    }
}

export async function processUpdate(bot, update) {
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Save Chat ID to user_state for cron jobs
    await supabase.from('user_state').upsert({ chat_id: chatId.toString(), last_chat_id: chatId.toString(), bot_mode: process.env.BOT_MODE });

    // --- COMMAND HANDLERS ---
    if (text.startsWith('/')) {
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();

        if (command === '/start') {
            const isAbang = process.env.BOT_MODE === 'abang';
            const greeting = isAbang ? `Halo Salma! Aku ${process.env.BOT_NAME} 🤍\n\nKirim pesan seperti "besok rapat mingguan jam 10" dan aku akan simpan ke Google Calendar serta ngingetin kamu jadwalnya.\n\nKetik /connect untuk mulai yaa.` :
                `Halo bang! Aku ${process.env.BOT_NAME || 'Amaa Remind'} 🤍\n\nKirim pesan seperti "rapat besok jam 10" dan aku akan simpan ke Google Calendar serta kasih pengingat.\n\nKetik /connect untuk mulai.`;

            await bot.sendMessage(chatId, greeting);
            return;
        }

        if (command === '/help') {
            const botName = process.env.BOT_NAME || 'Amaa Remind';
            await bot.sendMessage(chatId, [
                `✨ *Panduan ${botName}* 🤍\n`,
                'Kirim pesan jadwal apa saja, contoh:',
                '"Rapat besok jam 15"',
                '"Nongkrong hari ini jam 17 sampe 19"',
                '"Kelas Senin jam 8 pagi\"\n',
                '🛠 *Commands:*',
                '/connect - Hubungkan Google Calendar',
                '/today - Jadwal hari ini',
                '/tomorrow - Jadwal besok',
                '/week - Ringkasan minggu ini',
                '/focus [durasi] - Sesi fokus',
                '/unfocus - Batalkan focus session',
                '/stats - Statistik bulan ini',
                '/resetstats - Reset statistik',
                '/delete - Hapus event terakhir',
                '/edit [perintah] - Edit event terakhir',
                '/help - Bantuan ini',
            ].join('\n'), { parse_mode: 'Markdown' });
            return;
        }

        if (command === '/connect') {
            const oAuth2Client = getOAuth2Client();
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/calendar.events'],
                state: chatId.toString() // Use state to pass chatId to callback
            });
            const msgText = process.env.BOT_MODE === 'abang'
                ? "Klik tombol di bawah ini buat ngehubungin kalendarmu ya Salma 🤍"
                : "Klik tombol di bawah ini untuk menghubungkan kalendarmu bang 🤍";

            await bot.sendMessage(chatId, msgText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 Hubungkan Google Calendar', url: authUrl }]
                    ]
                }
            });
            return;
        }

        if (command === '/delete') {
            const { data: state } = await supabase.from('user_state').select('last_google_event_id').eq('chat_id', chatId.toString()).eq('bot_mode', process.env.BOT_MODE).single();
            if (!state?.last_google_event_id) {
                await bot.sendMessage(chatId, "Nggak ada event yang bisa dihapus nih 🤔");
                return;
            }
            const authClient = await getAuthClient(chatId, bot);
            if (!authClient) return;
            const calendar = google.calendar({ version: 'v3', auth: authClient });
            try {
                await calendar.events.delete({ calendarId: 'primary', eventId: state.last_google_event_id });
                await supabase.from('user_state').update({ last_google_event_id: null }).eq('chat_id', chatId.toString()).eq('bot_mode', process.env.BOT_MODE);
                await bot.sendMessage(chatId, "Event terakhir sudah dihapus dari Calendar! 🗑️");
            } catch (e) {
                await bot.sendMessage(chatId, "Gagal menghapus event 😔");
            }
            return;
        }

        if (command === '/edit') {
            const prompt = parts.slice(1).join(' ');
            if (!prompt) {
                const isAbang = process.env.BOT_MODE === 'abang';
                const editPromptMsg = isAbang ? "Mau edit apa Salma? Contoh:\n`/edit ganti jamnya jadi jam 10 pagi`\n`/edit ubah lokasinya ke senayan`" :
                    "Mau edit apa bang? Contoh:\n`/edit ganti jamnya jadi jam 10 pagi`\n`/edit ubah lokasinya ke senayan`";
                await bot.sendMessage(chatId, editPromptMsg, { parse_mode: 'Markdown' });
                return;
            }

            const { data: state } = await supabase.from('user_state').select('last_google_event_id').eq('chat_id', chatId.toString()).eq('bot_mode', process.env.BOT_MODE).single();
            if (!state?.last_google_event_id) {
                await bot.sendMessage(chatId, "Nggak ada event terakhir yang bisa diedit nih 🤔");
                return;
            }

            const authClient = await getAuthClient(chatId, bot);
            if (!authClient) return;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            try {
                const { data: event } = await calendar.events.get({ calendarId: 'primary', eventId: state.last_google_event_id });

                const nowWIB = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString();

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `Waktu Sekarang (WIB): ${nowWIB}
Berikut adalah detail acara di kalender:
Nama: ${event.summary}
Lokasi: ${event.location || 'Online'}
Waktu Mulai: ${event.start.dateTime || event.start.date}
Waktu Selesai: ${event.end.dateTime || event.end.date}

Permintaan dari user untuk mengedit acara ini: "${prompt}"

Tugas: Berikan output JSON murni berisi HANYA field kalender yang perlu diubah.
Format waktu harus mematuhi ISO 8601 dengan offset WIB (+07:00).
Struktur output JSON yang valid:
{
  "summary": "Judul acara baru",
  "location": "Lokasi baru",
  "start": {"dateTime": "2026-03-01T10:00:00+07:00", "timeZone": "Asia/Jakarta"},
  "end": {"dateTime": "2026-03-01T11:00:00+07:00", "timeZone": "Asia/Jakarta"}
}
Hanya sertakan field yang berubah. Jika jam diubah, pastikan \`end\` juga disesuaikan 1 jam setelah \`start\`.
HANYA berikan JSON murni, tanpa backticks, tanpa format markdown.`,
                    config: { responseMimeType: "application/json" }
                });

                let rawJson = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const firstBrace = rawJson.indexOf('{');
                const lastBrace = rawJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    rawJson = rawJson.substring(firstBrace, lastBrace + 1);
                }
                const updates = JSON.parse(rawJson);

                if (Object.keys(updates).length > 0) {
                    await calendar.events.patch({
                        calendarId: 'primary',
                        eventId: state.last_google_event_id,
                        requestBody: updates
                    });

                    const isAbang = process.env.BOT_MODE === 'abang';
                    let reply = isAbang ? "Siaapp! Jadwalnya udah aku benerin sesuai mintamu yaa 🪄✅\n\n_Ini yang aku ubah:_" :
                        "Beres bang! Jadwal udah di-update sesuai permintaan 🪄✅\n\n_Perubahan:_";

                    if (updates.summary) reply += `\n📌 ${updates.summary}`;
                    if (updates.location) reply += `\n📍 ${updates.location}`;
                    if (updates.start?.dateTime) reply += `\n⏰ Waktu diupdate`;

                    await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
                } else {
                    const failMsg = process.env.BOT_MODE === 'abang' ? "Hmm, aku nggak nemu apa yang harus diubah dari kalimatmu Salma 🤔" : "Hmm, aku gak nemu apa yang harus diubah dari kalimat itu 🤔";
                    await bot.sendMessage(chatId, failMsg);
                }
            } catch (e) {
                console.error('Edit error:', e.message);
                const errMsg = process.env.BOT_MODE === 'abang' ? "Waduh maaf ya, gagal edit jadwal nih 😔 Coba ketik dengan cara lain." : "Waduh gagal edit jadwal nih 😔 Coba kata-katanya diubah.";
                await bot.sendMessage(chatId, errMsg);
            }
            return;
        }

        // Feature-based command routing
        if (await handleFocusCommand(bot, msg, command, parts, { getAuthClient, addReminder, removeReminderByTitle, trackEvent })) return;
        if (await handleStatsCommand(bot, msg, command)) return;
        if (await handleCalendarCommand(bot, msg, command, { getAuthClient })) return;

        return;
    }

    // --- NLP PARSING & EVENT CREATION ---
    const { title: rawTitle, location, start, end, error, rawText } = await generateSmartData(text);

    if (error || (!start && !rawTitle)) {
        const isAbang = process.env.BOT_MODE === 'abang';
        let failParsingMsg = isAbang ? "Kurang jelas nih Salma, mau ngapain dan kapan? 🤍\nCoba sebut jam dan kegiatannya ya, misal: \"besok rapat jam 10\"." :
            "Kurang jelas bang, mau ngapain dan kapan? 🤍\nCoba sebut jam dan kegiatannya, misal: \"besok rapat jam 10\".";

        if (error) {
            failParsingMsg += `\n\n_[DEBUG INFO]_:\nError: ${error}\nBot Mode: ${process.env.BOT_MODE}`;
        }

        await bot.sendMessage(chatId, failParsingMsg);
        return;
    }

    if (!start && rawTitle) {
        await bot.sendMessage(chatId, "Aku tangkap kegiatannya, tapi kapan tuh? 🤍\nCoba sebut jamnya ya, misal: \"jam 15\".");
        return;
    }

    const titleCategory = rawTitle || detectCategory(text);

    const authClient = await getAuthClient(chatId, bot);
    if (!authClient) return;
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const botName = process.env.BOT_NAME || 'Amaa Remind';
    const isAbang = process.env.BOT_MODE === 'abang';

    const event = {
        summary: titleCategory,
        location: location || 'Online',
        description: `Dibuat oleh ${botName}: "${text}"`,
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Jakarta' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Jakarta' },
    };

    try {
        const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
        const eventId = res.data.id;

        await supabase.from('user_state').upsert({ chat_id: chatId.toString(), last_google_event_id: eventId });
        await trackEvent(titleCategory, start.getHours());

        const reminderTime = start.getTime() - (30 * 60 * 1000);
        if (reminderTime > Date.now()) {
            await addReminder(chatId, titleCategory, reminderTime, start.getTime());
        }

        const dateStr = start.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
        const timeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

        let msgReply = isAbang ? `Beres yaa! Jadwalnya udah aku masukin ke Google Calendar ✅\n\n📌 *${titleCategory}*\n📅 ${dateStr}\n⏰ Jam ${timeStr}` :
            `Sip! Jadwal sudah masuk Google Calendar ✅\n\n📌 *${titleCategory}*\n📅 ${dateStr}\n⏰ Jam ${timeStr}`;
        if (location) msgReply += `\n📍 Lokasi: ${location}`;
        msgReply += isAbang ? `\n\nNanti aku ingetin 30 menit sebelum mulai ya Salma 🤍` : `\n\nAku kasih tau 30 menit sebelum mulai ya 🤍`;

        await bot.sendMessage(chatId, msgReply, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Insert failed:', e.message);
        await bot.sendMessage(chatId, "Waduh gagal simpan ke Calendar 😔 Coba lagi ya.");
    }
}
