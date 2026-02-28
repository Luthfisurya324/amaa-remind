import { google } from 'googleapis';
import { getWIBStartOfDay } from '../core/utils.js';
export async function handleCalendarCommand(bot, msg, command, { getAuthClient }) {
    const chatId = msg.chat.id;

    // /today
    if (command === '/today') {
        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const start = getWIBStartOfDay(new Date(), 0);
        const end = new Date(start.getTime() + 24 * 3600 * 1000 - 1);

        try {
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = res.data.items || [];
            if (events.length === 0) {
                const emptyMsg = process.env.BOT_MODE === 'abang' ? "Hari ini santai, kosong kok jadwal kamu Salma ✨" : "Hari ini santai, kosong kok jadwal kamu ✨";
                bot.sendMessage(chatId, emptyMsg);
            } else {
                let text = `📅 Jadwal Hari Ini:\n\n`;
                events.forEach((event, i) => {
                    const s = new Date(event.start.dateTime || event.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
                    const safeSummary = (event.summary || '(Tanpa judul)').replace(/[<>]/g, '');
                    text += `${i + 1}. ${safeSummary} (${s})\n`;
                });
                bot.sendMessage(chatId, text);
            }
        } catch (e) {
            console.error('Error fetching today events:', e);
            bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar kamu 😔");
        }
        return true;
    }

    // /tomorrow
    if (command === '/tomorrow') {
        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const start = getWIBStartOfDay(new Date(), 1);
        const end = new Date(start.getTime() + 24 * 3600 * 1000 - 1);

        try {
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = res.data.items || [];
            if (events.length === 0) {
                const emptyMsg = process.env.BOT_MODE === 'abang' ? "Besok santai, kosong kok jadwal kamu Salma ✨" : "Besok santai, kosong kok jadwal kamu ✨";
                bot.sendMessage(chatId, emptyMsg);
            } else {
                let text = `📅 Jadwal Besok:\n\n`;
                events.forEach((event, i) => {
                    const s = new Date(event.start.dateTime || event.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
                    const safeSummary = (event.summary || '(Tanpa judul)').replace(/[<>]/g, '');
                    text += `${i + 1}. ${safeSummary} (${s})\n`;
                });
                bot.sendMessage(chatId, text);
            }
        } catch (e) {
            console.error('Error fetching tomorrow events:', e);
            bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar kamu 😔");
        }
        return true;
    }

    // /week
    if (command === '/week') {
        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const startOfWeek = getWIBStartOfDay(new Date(), 0);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 3600 * 1000 - 1);

        try {
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfWeek.toISOString(),
                timeMax: endOfWeek.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = res.data.items || [];
            if (events.length === 0) {
                const emptyMsg = process.env.BOT_MODE === 'abang' ? "Minggu ini kosong Salma! Saatnya planning 🤍" : "Minggu ini kosong! Saatnya planning 🤍";
                bot.sendMessage(chatId, emptyMsg);
                return true;
            }

            // Hitung event per hari
            const hariNama = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const perHari = {};
            events.forEach(event => {
                const d = new Date(event.start.dateTime || event.start.date);
                const hari = hariNama[d.getDay()];
                perHari[hari] = (perHari[hari] || 0) + 1;
            });

            const paling = Object.entries(perHari).sort((a, b) => b[1] - a[1])[0];

            let text = `📊 Ringkasan 7 hari ke depan:\n\n`;
            text += `Total agenda: ${events.length}\n`;
            text += `Hari paling padat: ${paling[0]} (${paling[1]} event)\n\n`;

            const grouped = {};
            events.forEach(event => {
                const d = new Date(event.start.dateTime || event.start.date);
                const key = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
                if (!grouped[key]) grouped[key] = [];
                const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
                const safeSummary = (event.summary || '(Tanpa judul)').replace(/[<>]/g, '');
                grouped[key].push(`  ${time} - ${safeSummary}`);
            });

            Object.keys(grouped).forEach(hari => {
                text += `📅 <b>${hari}</b>\n${grouped[hari].join('\n')}\n\n`;
            });

            bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Gagal cek jadwal:', e.message);
            bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar 😔");
        }
        return true;
    }

    return false;
}
