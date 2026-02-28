const { google } = require('googleapis');

function initCalendarFeatures(getAuthClient) {
    async function handleCommand(bot, msg, command) {
        const chatId = msg.chat.id;

        // /today
        if (command === '/today') {
            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

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
                    bot.sendMessage(chatId, "Hari ini santai, kosong kok jadwal kamu ✨");
                } else {
                    let text = `📅 Jadwal Hari Ini:\n\n`;
                    events.forEach((event, i) => {
                        const s = new Date(event.start.dateTime || event.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        text += `${i + 1}. ${event.summary} (${s})\n`;
                    });
                    bot.sendMessage(chatId, text);
                }
            } catch (e) {
                bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar kamu 😔");
            }
            return true;
        }

        // /tomorrow
        if (command === '/tomorrow') {
            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const start = new Date();
            start.setDate(start.getDate() + 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);

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
                    bot.sendMessage(chatId, "Besok santai, kosong kok jadwal kamu ✨");
                } else {
                    let text = `📅 Jadwal Besok:\n\n`;
                    events.forEach((event, i) => {
                        const s = new Date(event.start.dateTime || event.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        text += `${i + 1}. ${event.summary} (${s})\n`;
                    });
                    bot.sendMessage(chatId, text);
                }
            } catch (e) {
                bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar kamu 😔");
            }
            return true;
        }

        // /week
        if (command === '/week') {
            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const startOfWeek = new Date();
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 7);

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
                    bot.sendMessage(chatId, "Minggu ini kosong! Saatnya planning 🤍");
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
                    const key = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
                    if (!grouped[key]) grouped[key] = [];
                    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    grouped[key].push(`  ${time} - ${event.summary}`);
                });

                Object.keys(grouped).forEach(hari => {
                    text += `📅 *${hari}*\n${grouped[hari].join('\n')}\n\n`;
                });

                bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error('Gagal cek jadwal:', e.message);
                bot.sendMessage(chatId, "Maaf, aku gagal cek kalendar 😔");
            }
            return true;
        }

        return false;
    }

    return { handleCommand };
}

module.exports = { initCalendarFeatures };
