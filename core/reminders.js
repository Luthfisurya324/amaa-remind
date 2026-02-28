const fs = require('fs');
const cron = require('node-cron');
const { atomicWriteJSON } = require('./utils');

function initReminders(bot, FILE_PATHS) {
    const { REMINDERS_FILE } = FILE_PATHS;

    function loadReminders() {
        try {
            return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    function saveReminders(reminders) {
        atomicWriteJSON(REMINDERS_FILE, reminders);
    }

    function addReminder(chatId, title, reminderTime) {
        const reminders = loadReminders();
        reminders.push({ chatId, title, reminderTime, sent: false });
        saveReminders(reminders);
    }

    function removeReminderByTitle(titleSubstring) {
        let reminders = loadReminders();
        reminders = reminders.filter(r => !r.title.includes(titleSubstring));
        saveReminders(reminders);
    }

    // Cron job 30 detik untuk check reminder
    cron.schedule('*/30 * * * * *', () => {
        const now = Date.now();
        let reminders = loadReminders();
        let changed = false;

        reminders.forEach(r => {
            if (!r.sent && r.reminderTime <= now) {
                bot.sendMessage(r.chatId, `Bang 30 menit lagi ada agenda: *${r.title}* ya 🤍 Fokus!`, { parse_mode: 'Markdown' });
                r.sent = true;
                changed = true;
            }
        });

        if (changed) {
            reminders = reminders.filter(r => !r.sent || (r.reminderTime > now - 3600000));
            saveReminders(reminders);
        }
    });

    console.log('Persistent reminder scheduler aktif');

    return {
        loadReminders,
        saveReminders,
        addReminder,
        removeReminderByTitle
    };
}

module.exports = { initReminders };
