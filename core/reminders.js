import { supabase } from './supabase.js';

export async function addReminder(chatId, title, reminderTime, startTime) {
    const { data, error } = await supabase
        .from('reminders')
        .insert({
            chat_id: chatId.toString(), // Ensure it's stored as text
            title,
            reminder_time: new Date(reminderTime).toISOString(),
            start_time: startTime ? new Date(startTime).toISOString() : null,
            sent: false,
            bot_mode: process.env.BOT_MODE
        });

    if (error) {
        console.error('❌ Error saving reminder to Supabase:', error);
        throw error;
    }
    return data;
}

export async function removeReminderByTitle(titleSubstring) {
    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('bot_mode', process.env.BOT_MODE)
        .ilike('title', `%${titleSubstring}%`);

    if (error) {
        console.error('❌ Error deleting reminder from Supabase:', error);
        throw error;
    }
}

export async function checkAndSendReminders(bot) {
    const now = new Date().toISOString();

    // Get unsent reminders that are due
    const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('sent', false)
        .eq('bot_mode', process.env.BOT_MODE)
        .lte('reminder_time', now);

    if (error) {
        console.error('❌ Error fetching due reminders:', error);
        return;
    }

    if (!reminders || reminders.length === 0) return;

    for (const r of reminders) {
        try {
            const isAbang = process.env.BOT_MODE === 'abang';
            const reminderTxt = isAbang ? `Siap-siap Salma, 30 menit lagi ada agenda: *${r.title}* ya 🤍 Fokus!` :
                `Bang 30 menit lagi ada agenda: *${r.title}* ya 🤍 Fokus!`;

            await bot.sendMessage(r.chat_id, reminderTxt, { parse_mode: 'Markdown' });

            // Mark as sent
            await supabase
                .from('reminders')
                .update({ sent: true })
                .eq('id', r.id);

            console.log(`✅ Sent reminder for: ${r.title}`);
        } catch (err) {
            console.error(`❌ Failed to send reminder to ${r.chat_id}:`, err);
        }
    }

    // Optional: Cleanup old sent reminders (older than 24 hours)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('reminders').delete().eq('sent', true).eq('bot_mode', process.env.BOT_MODE).lt('reminder_time', dayAgo);
}
