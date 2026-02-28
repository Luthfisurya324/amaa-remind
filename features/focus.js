import { google } from 'googleapis';
import { supabase } from '../core/supabase.js';

export async function handleFocusCommand(bot, msg, command, parts, { getAuthClient, addReminder, removeReminderByTitle, trackEvent }) {
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

        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const event = {
            summary: '🔕 Focus Session',
            description: `Dibuat oleh ${process.env.BOT_NAME || 'Amaa Remind'} — Focus Mode`,
            start: { dateTime: start.toISOString(), timeZone: 'Asia/Jakarta' },
            end: { dateTime: end.toISOString(), timeZone: 'Asia/Jakarta' },
        };

        try {
            const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
            const eventId = res.data.id;

            // Store state in Supabase
            await supabase
                .from('user_state')
                .upsert({ chat_id: chatId.toString(), last_focus_event_id: eventId, bot_mode: process.env.BOT_MODE });

            await trackEvent('🔕 Focus Session', start.getHours());
            await addReminder(chatId, '🔕 Focus Session selesai!', end.getTime(), start.getTime());

            const endStr = end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const isAbang = process.env.BOT_MODE === 'abang';
            const focusON = isAbang ? `🔕 Focus Mode ON!\n\nSampai pukul ${endStr}.\nNanti aku ingetin kalau waktunya selesai 🤍\n\nFokus ya Salma, matikan notifikasi yang lain!` :
                `🔕 Focus Mode ON!\n\nSampai pukul ${endStr}.\nAku akan kasih tau kalau waktunya selesai 🤍\n\nFokus ya bang, matikan notifikasi yang lain!`;

            bot.sendMessage(chatId, focusON);
        } catch (e) {
            console.error('Gagal bikin focus session:', e.message);
            bot.sendMessage(chatId, "Waduh gagal bikin focus session 😔 Coba lagi ya.");
        }
        return true;
    }

    if (command === '/unfocus') {
        const { data: state, error: fetchError } = await supabase
            .from('user_state')
            .select('last_focus_event_id')
            .eq('chat_id', chatId.toString())
            .eq('bot_mode', process.env.BOT_MODE)
            .single();

        if (fetchError || !state?.last_focus_event_id) {
            bot.sendMessage(chatId, "Nggak ada focus session yang aktif nih 🤔");
            return true;
        }

        const authClient = await getAuthClient(chatId, bot);
        if (!authClient) return true;
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        try {
            await calendar.events.delete({ calendarId: 'primary', eventId: state.last_focus_event_id });
            await removeReminderByTitle('Focus Session');

            // Clear state
            await supabase
                .from('user_state')
                .update({ last_focus_event_id: null })
                .eq('chat_id', chatId.toString())
                .eq('bot_mode', process.env.BOT_MODE);

            bot.sendMessage(chatId, "Focus session dibatalkan! 🔔\nIstirahat dulu gapapa kok 🤍");
        } catch (e) {
            console.error('Gagal membatalkan focus session:', e.message);
            bot.sendMessage(chatId, "Gagal membatalkan focus session 😔");
        }
        return true;
    }

    return false;
}
