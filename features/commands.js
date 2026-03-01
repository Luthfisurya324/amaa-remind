import { google } from 'googleapis';
import { getUserState } from '../core/db/queries.js';
import { getAuthClient, getOAuth2Client } from '../core/calendar.js';
import { callTripleFallback } from '../core/ai.js';

export async function handleGeneralCommands(bot, msg, command, parts) {
    const chatId = msg.chat.id;

    if (command === '/start') {
        const isAbang = process.env.BOT_MODE === 'abang';
        const greeting = isAbang ? `Halo Salma! Aku ${process.env.BOT_NAME} 🤍\n\nKirim pesan seperti "besok rapat mingguan jam 10" dan aku akan simpan ke Google Calendar serta ngingetin kamu jadwalnya.\n\nKetik /connect untuk mulai yaa.` :
            `Halo bang! Aku ${process.env.BOT_NAME || 'Amaa Remind'} 🤍\n\nKirim pesan seperti "rapat besok jam 10" dan aku akan simpan ke Google Calendar serta kasih pengingat.\n\nKetik /connect untuk mulai.`;

        await bot.sendMessage(chatId, greeting);
        return true;
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
        return true;
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
        return true;
    }

    if (command === '/delete' || command === '/agenda') {
        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
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
                return true;
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
        return true;
    }

    const delMatch = command.match(/^\/del_(\d+)$/);
    if (delMatch) {
        const index = parseInt(delMatch[1], 10) - 1;
        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
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
                return true;
            }

            const eventToDelete = events[index];
            await calendar.events.delete({ calendarId: 'primary', eventId: eventToDelete.id });
            const safeSummary = (eventToDelete.summary || '').replace(/[<>]/g, '');
            await bot.sendMessage(chatId, `Agenda <b>${safeSummary}</b> berhasil dihapus! 🗑️`, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Error deleting event:', e);
            await bot.sendMessage(chatId, "Gagal menghapus agenda 😔");
        }
        return true;
    }

    if (command === '/edit') {
        const prompt = parts.slice(1).join(' ');
        if (!prompt) {
            const isAbang = process.env.BOT_MODE === 'abang';
            const editPromptMsg = isAbang ? "Mau edit apa Salma? Contoh:\n`/edit ganti jamnya jadi jam 10 pagi`\n`/edit ubah lokasinya ke senayan`" :
                "Mau edit apa bang? Contoh:\n`/edit ganti jamnya jadi jam 10 pagi`\n`/edit ubah lokasinya ke senayan`";
            await bot.sendMessage(chatId, editPromptMsg, { parse_mode: 'Markdown' });
            return true;
        }

        const state = await getUserState(chatId);
        if (!state?.last_google_event_id) {
            await bot.sendMessage(chatId, "Nggak ada event terakhir yang bisa diedit nih 🤔");
            return true;
        }

        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
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
        return true;
    }

    return false;
}
