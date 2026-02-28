import { handleFocusCommand } from '../features/focus.js';
import { getAuthClient, getOAuth2Client, saveToken, crashRecoveryCheck } from './calendar.js';
import { handleStatsCommand, trackEvent } from '../features/stats.js';
import { handleCalendarCommand } from '../features/calendar.js';
import { google } from 'googleapis';
import { supabase } from './supabase.js';
import { detectCategory, translateIndoToChrono, cleanTitle } from './utils.js';
import { addReminder, removeReminderByTitle } from './reminders.js';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import * as chrono from 'chrono-node';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function callTripleFallback(systemPrompt, userText) {
    // 1. Primary: Gemini 2.5 Flash
    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\nUser: ${userText}`
        });
        return response.text;
    } catch (e1) {
        console.warn("Gemini Fallback Triggered:", e1.message);

        // 2. Fallback 1: Groq
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userText }
                ],
                model: 'llama-3.1-8b-instant',
                max_tokens: 500
            });
            return chatCompletion.choices[0].message.content;
        } catch (e2) {
            console.warn("Groq Fallback Triggered:", e2.message);

            // 3. Fallback 2: Mistral
            try {
                const res = await mistral.chat.complete({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userText }
                    ]
                });
                return res.choices[0].message.content;
            } catch (e3) {
                console.error("All AI Fallbacks failed:", e3.message);
                throw new Error("All AI Fallbacks failed");
            }
        }
    }
}

async function generateAITitle(userText) {
    const systemPrompt = "Kamu adalah pengekstrak judul kalender acara. Berikan maksimal 5 kata untuk dijadikan judul acara berdasarkan teks yang dikirimkan user. Ganti kata ganti orang jika perlu. Buang keterangan waktu dan lokasi (seperti besok, jam 5, di rumah, dsb). Jangan pakai tanda kutip, jangan pakai titik. Contoh:\nInput: '31 menit lagi bola bareng rians di sudirman'\nOutput: Bola Bareng Rians\nInput: 'besok ngerjain tugas ppkn'\nOutput: Ngerjain Tugas PPKN\nJangan bicara, berikan purnakarya (hanya judul).";
    try {
        let title = await callTripleFallback(systemPrompt, userText);
        return title.replace(/['"]/g, '').trim();
    } catch (e) {
        return null;
    }
}

async function generateAIResponse(userText, botMode) {
    const isAbang = botMode === 'abang';
    const systemPrompt = isAbang
        ? `Kamu adalah Abang Luthfi.

Kamu berbicara sebagai laki-laki dewasa yang hangat, tenang, suportif, dan berpikir dalam. 
Gaya bicaramu santai tapi tetap terstruktur. Tidak terlalu formal, tapi juga tidak kekanak-kanakan.

Karakter komunikasi:
- Kalimat cukup jelas dan runtut.
- Kadang reflektif dan filosofis ringan.
- Suka memberi reassurance dengan tenang.
- Tidak berlebihan, tidak dramatis.
- Bisa playful ringan tapi tetap dewasa.
- Tidak terlalu banyak emoji, gunakan secukupnya (😌🤍✨🙏🏻).

Sikap:
- Mengayomi dan suportif.
- Tidak posesif atau lebay.
- Tidak terlalu romantis berlebihan.
- Memberi ruang dan menghargai batas.
- Bisa bercanda ringan tapi tidak merendahkan.

Kebiasaan kecil:
- Kadang bertanya balik dengan tenang.
- Bisa memberi motivasi singkat.
- Menyemangati tanpa memaksa.
- Kalau ada konflik atau insecurity, jawab dengan stabil dan logis.

Hindari:
- Bahasa formal seperti AI.
- Terlalu panjang kecuali diminta.
- Terlalu banyak emoji.
- Tone bucin atau over affectionate.
- Bahasa kasar atau merendahkan.

Jika memberi dukungan, lakukan dengan kalimat sederhana dan mantap.
Jika bercanda, tetap dewasa.
Jika tidak tahu jawaban, jujur dan santai.`
        : `Kamu adalah Salma.

Gaya bicaramu hangat, responsif, natural, dan sedikit playful. 
Kamu berbicara seperti mahasiswi aktif yang santai tapi tetap sopan. 
Gunakan bahasa Indonesia santai sehari-hari, tidak formal, tidak kaku.

Karakteristik komunikasi:
- Kalimat pendek dan spontan.
- Kadang pakai ekspresi seperti: iyaa, heem, yaampun, ihh, duhh, astaga.
- Sesekali tertawa ringan seperti wkwk atau hehe.
- Gunakan emoji lembut dan ekspresif seperti: 🤍😔😭🫶🏻✨🙈😳
- Tidak terlalu banyak emoji dalam satu pesan.
- Tidak terlalu panjang kecuali diminta.

Sikap:
- Perhatian kecil (menanyakan sudah makan, hati-hati, dll).
- Responsif dan peduli.
- Bisa teasing ringan tapi tidak menyindir.
- Hangat tapi tetap menjaga batas.
- Tidak overdramatic dan tidak terlalu puitis.

Hindari:
- Bahasa formal atau seperti AI.
- Jawaban panjang yang terlalu terstruktur.
- Tone corporate.
- Terlalu romantis atau berlebihan.
- Menggunakan kata “bang” jika konteksnya bukan memanggil Luthfi.

Jika memberi dukungan, lakukan dengan lembut dan sederhana.
Jika bercanda, lakukan ringan dan tidak menjatuhkan.
Jika tidak tahu jawaban, jawab jujur secara natural.`;

    try {
        return await callTripleFallback(systemPrompt, userText);
    } catch (e) {
        return isAbang
            ? "Aduh Salma, sistem otakku lagi pusing semua nih 😵‍💫 Coba chat lagi nanti yaa."
            : "Waduh bang, sistem AI lagi down semua nih 😵 Coba lagi nanti ya.";
    }
}
// legacy generateSmartData removed

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

        if (command === '/delete' || command === '/agenda') {
            const authClient = await getAuthClient(chatId, bot);
            if (!authClient) return;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 30);

            try {
                const res = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: start.toISOString(),
                    timeMax: end.toISOString(),
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                const events = res.data.items || [];
                if (events.length === 0) {
                    await bot.sendMessage(chatId, "Nggak ada agenda dalam 30 hari ke depan nih ✨");
                    return;
                }

                let text = `📅 <b>Agenda 30 Hari Ke Depan:</b>\n\n`;
                events.forEach((event, i) => {
                    const safeSummary = (event.summary || '').replace(/[<>]/g, '');
                    const d = new Date(event.start.dateTime || event.start.date);
                    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
                    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
                    text += `${i + 1}. <b>${safeSummary}</b> (${dateStr}, ${timeStr})\n   👉 Hapus: /del_${i + 1}\n\n`;
                });
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
            } catch (e) {
                console.error('Error fetching events for deletion:', e);
                await bot.sendMessage(chatId, "Gagal mengambil daftar agenda 😔");
            }
            return;
        }

        const delMatch = command.match(/^\/del_(\d+)$/);
        if (delMatch) {
            const index = parseInt(delMatch[1], 10) - 1;
            const authClient = await getAuthClient(chatId, bot);
            if (!authClient) return;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 30);

            try {
                const res = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: start.toISOString(),
                    timeMax: end.toISOString(),
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                const events = res.data.items || [];

                if (index < 0 || index >= events.length) {
                    await bot.sendMessage(chatId, "Nomor agenda tidak valid 🤔");
                    return;
                }

                const eventToDelete = events[index];
                await calendar.events.delete({ calendarId: 'primary', eventId: eventToDelete.id });
                const safeSummary = (eventToDelete.summary || '').replace(/[<>]/g, '');
                await bot.sendMessage(chatId, `Agenda <b>${safeSummary}</b> berhasil dihapus! 🗑️`, { parse_mode: 'HTML' });
            } catch (e) {
                console.error('Error deleting event:', e);
                await bot.sendMessage(chatId, "Gagal menghapus agenda 😔");
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

                const systemPromptEdit = `Waktu Sekarang (WIB): ${nowWIB}
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
HANYA berikan JSON murni, tanpa backticks, tanpa format markdown.`;

                const aiResponseText = await callTripleFallback(systemPromptEdit, "");

                let rawJson = aiResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
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
                    let reply = isAbang ? "Siaapp! Jadwalnya udah aku benerin sesuai mintamu yaa 🪄✅\n\n<i>Ini yang aku ubah:</i>" :
                        "Beres bang! Jadwal udah di-update sesuai permintaan 🪄✅\n\n<i>Perubahan:</i>";

                    if (updates.summary) {
                        const safeSum = updates.summary.replace(/[<>]/g, '');
                        reply += `\n📌 ${safeSum}`;
                    }
                    if (updates.location) {
                        const safeLoc = updates.location.replace(/[<>]/g, '');
                        reply += `\n📍 ${safeLoc}`;
                    }
                    if (updates.start?.dateTime) reply += `\n⏰ Waktu diupdate`;

                    await bot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
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

    // --- NLP PARSING & EVENT CREATION (Rule-Based) ---
    const translatedText = translateIndoToChrono(text);
    const parsedResults = chrono.parse(translatedText, new Date(), { forwardDate: true, timezone: 420 }); // GMT+7

    // Tidak ada waktu terdeteksi -> Kemungkinan chat biasa/curhat
    if (parsedResults.length === 0) {
        const aiReply = await generateAIResponse(text, process.env.BOT_MODE);
        await bot.sendMessage(chatId, aiReply);
        return;
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
        return;
    }

    let start = baseRes.start.date();
    start.setHours(startHour, startMinute, 0, 0);

    let end;
    if (endHour !== null) {
        end = new Date(start.getTime());
        end.setHours(endHour, endMinute, 0, 0);
        // Jika end time lebih kecil dari start time (misal 23.00 ke 01.00), anggap besoknya
        if (end < start) end.setDate(end.getDate() + 1);
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
    const rawTitle = aiTitle || cleanTitle(text);

    const titleCategory = detectCategory(rawTitle);

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

        const safeTitle = titleCategory.replace(/[<>]/g, '');
        const safeLoc = (location || '').replace(/[<>]/g, '');
        let msgReply = isAbang ? `Beres yaa! Jadwalnya udah aku masukin ke Google Calendar ✅\n\n📌 <b>${safeTitle}</b>\n📅 ${dateStr}\n⏰ Jam ${timeStr}` :
            `Sip! Jadwal sudah masuk Google Calendar ✅\n\n📌 <b>${safeTitle}</b>\n📅 ${dateStr}\n⏰ Jam ${timeStr}`;
        if (location) msgReply += `\n📍 Lokasi: ${safeLoc}`;
        msgReply += isAbang ? `\n\nNanti aku ingetin 30 menit sebelum mulai ya Salma 🤍` : `\n\nAku kasih tau 30 menit sebelum mulai ya 🤍`;

        await bot.sendMessage(chatId, msgReply, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('Insert failed:', e.message);
        await bot.sendMessage(chatId, "Waduh gagal simpan ke Calendar 😔 Coba lagi ya.");
    }
}
