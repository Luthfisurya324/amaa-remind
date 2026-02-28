import { google } from 'googleapis';
import { supabase } from '../core/supabase.js';

export async function sendDailySummary(bot, getAuthClient) {
    // Get all chat IDs that have tokens (meaning they are connected)
    const { data: users, error: fetchError } = await supabase
        .from('tokens')
        .select('chat_id');

    if (fetchError || !users) return;

    for (const { chat_id } of users) {
        const oAuth2Client = await getAuthClient(chat_id, bot);
        if (!oAuth2Client) continue;

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        try {
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = res.data.items || [];
            let msg = '';

            if (events.length === 0) {
                msg = "Selamat pagi! Hari ini kosong, selamat istirahat! ✨";
            } else if (events.length === 1) {
                msg = `Selamat pagi! Hari ini santai 🤍 cuma ada 1 agenda:\n\n`;
            } else if (events.length <= 3) {
                msg = `Selamat pagi! Hari ini ada ${events.length} agenda. Semangat ya! 💪\n\n`;
            } else {
                msg = `Selamat pagi! Hari ini cukup padat (${events.length} agenda) 😅 Atur energi ya bang.\n\n`;
            }

            events.forEach((event, i) => {
                const start = new Date(event.start.dateTime || event.start.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                msg += `${i + 1}. ${event.summary} (${start})\n`;
            });

            // Energy Check
            if (events.length > 0) {
                const firstHour = new Date(events[0].start.dateTime || events[0].start.date).getHours();
                const lastHour = new Date(events[events.length - 1].start.dateTime || events[events.length - 1].start.date).getHours();

                if (firstHour < 7) {
                    msg += `\n⚡ Hari ini mulai pagi banget! Jangan lupa istirahat cukup ya.`;
                }
                if (lastHour >= 21) {
                    msg += `\n🌙 Jadwal malam cukup padat, jaga kesehatan ya bang.`;
                }
            }

            await bot.sendMessage(chat_id, msg);
            console.log(`✅ Daily summary sent to ${chat_id}`);
        } catch (e) {
            console.error(`❌ Failed to send daily summary to ${chat_id}:`, e.message);
        }
    }
}
