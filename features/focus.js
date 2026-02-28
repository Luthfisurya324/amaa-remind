const { google } = require('googleapis');

function initFocus(getAuthClient, addReminder, removeReminderByTitle, trackEvent) {
    let lastFocusEventId = null;

    async function handleCommand(bot, msg, command, parts) {
        const chatId = msg.chat.id;

        if (command === '/focus') {
            const durasiText = parts.slice(1).join(' ') || '1 jam';
            let durasiMs = 60 * 60 * 1000;

            const jamMatch = durasiText.match(/(\d+)\s*jam/i);
            const menitMatch = durasiText.match(/(\d+)\s*menit/i);
            if (jamMatch) durasiMs = parseInt(jamMatch[1]) * 60 * 60 * 1000;
            if (menitMatch) durasiMs += parseInt(menitMatch[1]) * 60 * 1000;

            const start = new Date();
            const end = new Date(start.getTime() + durasiMs);

            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const event = {
                summary: '🔕 Focus Session',
                description: 'Dibuat oleh Amaa Remind — Focus Mode',
                start: { dateTime: start.toISOString(), timeZone: 'Asia/Jakarta' },
                end: { dateTime: end.toISOString(), timeZone: 'Asia/Jakarta' },
            };

            try {
                const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
                lastFocusEventId = res.data.id;
                trackEvent('🔕 Focus Session', start.getHours());

                addReminder(chatId, '🔕 Focus Session selesai!', end.getTime());

                const endStr = end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                bot.sendMessage(chatId, `🔕 Focus Mode ON!\n\nSampai pukul ${endStr}.\nAku akan kasih tau kalau waktunya selesai 🤍\n\nFokus ya bang, matikan notifikasi yang lain!`);
            } catch (e) {
                console.error('Gagal bikin focus session:', e.message);
                bot.sendMessage(chatId, "Waduh gagal bikin focus session 😔 Coba lagi ya.");
            }
            return true;
        }

        if (command === '/unfocus') {
            if (!lastFocusEventId) {
                bot.sendMessage(chatId, "Nggak ada focus session yang aktif nih 🤔");
                return true;
            }
            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });
            try {
                await calendar.events.delete({ calendarId: 'primary', eventId: lastFocusEventId });
                removeReminderByTitle('Focus Session');
                lastFocusEventId = null;
                bot.sendMessage(chatId, "Focus session dibatalkan! 🔔\nIstirahat dulu gapapa kok 🤍");
            } catch (e) {
                bot.sendMessage(chatId, "Gagal membatalkan focus session 😔");
            }
            return true;
        }

        return false; // command not handled
    }

    return { handleCommand, getLastFocusEventId: () => lastFocusEventId, setLastFocusEventId: (id) => lastFocusEventId = id };
}

module.exports = { initFocus };
