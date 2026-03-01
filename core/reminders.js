import { addDbReminder, removeDbReminderByTitle, getDueReminders, markDbReminderSent, cleanupOldDbReminders } from './db/queries.js';

export async function addReminder(chatId, title, reminderTime, startTime) {
    try {
        const data = await addDbReminder(chatId, title, reminderTime, startTime);
        return data;
    } catch (error) {
        console.error('❌ Error saving reminder to DB:', error);
        throw error;
    }
}

export async function removeReminderByTitle(titleSubstring) {
    try {
        await removeDbReminderByTitle(titleSubstring);
    } catch (error) {
        console.error('❌ Error deleting reminder from DB:', error);
        throw error;
    }
}

export async function checkAndSendReminders(bot) {
    const now = new Date().toISOString();

    // Get unsent reminders that are due
    let reminders;
    try {
        reminders = await getDueReminders(now);
    } catch (error) {
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
            await markDbReminderSent(r.id);

            console.log(`✅ Sent reminder for: ${r.title}`);
        } catch (err) {
            console.error(`❌ Failed to send reminder to ${r.chat_id}:`, err);
        }
    }

    // Optional: Cleanup old sent reminders (older than 24 hours)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        await cleanupOldDbReminders(dayAgo);
    } catch (e) {
        // ignore
    }
}
