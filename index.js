const TelegramBot = require('node-telegram-bot-api');
const chrono = require('chrono-node');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Import Core & Features ---
const { atomicWriteJSON, detectCategory, cleanTitle } = require('./core/utils');
const {
    getAuthClient,
    startCallbackServer,
    setPendingAuthChatId,
    crashRecoveryCheck,
    getOAuth2Client
} = require('./core/calendar');
const { initReminders } = require('./core/reminders');
const { initStats } = require('./features/stats');
const { initFocus } = require('./features/focus');
const { initDailySummary } = require('./features/daily');
const { initCalendarFeatures } = require('./features/calendar');

// --- Initialization ---
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const FILE_PATHS = {
    REMINDERS_FILE: path.join(__dirname, 'reminders.json'),
    LAST_CHAT_FILE: path.join(__dirname, 'last_chat_id.txt'),
    STATS_FILE: path.join(__dirname, 'stats.json')
};

const remindersModel = initReminders(bot, FILE_PATHS);
const statsModel = initStats(FILE_PATHS);
const focusModel = initFocus(
    getAuthClient,
    remindersModel.addReminder,
    remindersModel.removeReminderByTitle,
    statsModel.trackEvent
);
initDailySummary(bot, FILE_PATHS, getAuthClient);
const calendarFeatures = initCalendarFeatures(getAuthClient);

startCallbackServer(bot);
crashRecoveryCheck(bot, FILE_PATHS, remindersModel.loadReminders, remindersModel.saveReminders);

// --- Global State (Simple) ---
let lastCreatedEventId = null;

// --- Main Handler ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Simpan Chat ID terakhir untuk summary
    fs.writeFileSync(FILE_PATHS.LAST_CHAT_FILE, chatId.toString());

    // --- COMMAND HANDLERS ---
    if (text.startsWith('/')) {
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();

        // 1. Core/Orchestration Commands
        if (command === '/start') {
            bot.sendMessage(chatId, 'Halo bang! Aku Amaa Remind 🤍\n\nKirim pesan seperti "rapat besok jam 10" dan aku akan simpan ke Google Calendar serta kasih pengingat.\n\nKetik /connect untuk mulai.');
            return;
        }

        if (command === '/help') {
            bot.sendMessage(chatId, [
                '✨ *Panduan Amaa Remind* 🤍\n',
                'Kirim pesan jadwal apa saja, contoh:',
                '"Rapat besok jam 15"',
                '"Nongkrong hari ini jam 17 sampe 19"',
                '"Kelas Senin jam 8 pagi"\n',
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
                '/help - Bantuan ini',
            ].join('\n'), { parse_mode: 'Markdown' });
            return;
        }

        if (command === '/connect') {
            const oAuth2Client = getOAuth2Client();
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/calendar.events'],
            });
            setPendingAuthChatId(chatId);
            bot.sendMessage(chatId, `Klik link ini untuk menghubungkan Google Calendar kamu 🤍:\n\n${authUrl}`);
            return;
        }

        if (command === '/delete') {
            if (!lastCreatedEventId) {
                bot.sendMessage(chatId, "Nggak ada event yang bisa dihapus nih 🤔");
                return;
            }
            const authClient = getAuthClient(chatId, bot);
            if (!authClient) return;
            const calendar = google.calendar({ version: 'v3', auth: authClient });
            try {
                await calendar.events.delete({ calendarId: 'primary', eventId: lastCreatedEventId });
                lastCreatedEventId = null;
                bot.sendMessage(chatId, "Event terakhir sudah dihapus dari Calendar! 🗑️");
            } catch (e) {
                bot.sendMessage(chatId, "Gagal menghapus event 😔");
            }
            return;
        }

        // 2. Feature-based command routing
        if (await focusModel.handleCommand(bot, msg, command, parts)) return;
        if (await statsModel.handleCommand(bot, msg, command)) return;
        if (await calendarFeatures.handleCommand(bot, msg, command)) return;

        return;
    }

    // --- NLP PARSING & EVENT CREATION ---
    const parsedResults = chrono.parse(text);
    if (parsedResults.length === 0) {
        bot.sendMessage(chatId, "Maksudnya jam berapa bang? 🤍\nCoba kasih tau jamnya, misal: \"besok jam 10\".");
        return;
    }

    const mergedResult = parsedResults[0];
    if (!mergedResult.start.isCertain('hour')) {
        bot.sendMessage(chatId, "Aku tangkap tanggalnya, tapi jamnya belum jelas 🤍\nCoba sebut jamnya ya, misal: \"jam 15\".");
        return;
    }

    const rawTitle = cleanTitle(text, parsedResults);
    const titleCategory = detectCategory(rawTitle);

    const start = mergedResult.start.date();
    const end = mergedResult.end ? mergedResult.end.date() : new Date(start.getTime() + 60 * 60 * 1000);

    const authClient = getAuthClient(chatId, bot);
    if (!authClient) return;
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const event = {
        summary: titleCategory,
        location: 'Online',
        description: `Dibuat oleh Amaa Remind: "${text}"`,
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Jakarta' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Jakarta' },
    };

    try {
        const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
        lastCreatedEventId = res.data.id;

        statsModel.trackEvent(titleCategory, start.getHours());

        const reminderTime = start.getTime() - (30 * 60 * 1000);
        if (reminderTime > Date.now()) {
            remindersModel.addReminder(chatId, titleCategory, reminderTime);
        }

        const dateStr = start.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        bot.sendMessage(chatId, `Sip! Jadwal sudah masuk Google Calendar ✅\n\n📌 *${titleCategory}*\n📅 ${dateStr}\n⏰ Jam ${timeStr}\n\nAku kasih tau 30 menit sebelum mulai ya 🤍`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Insert failed:', e.message);
        bot.sendMessage(chatId, "Waduh gagal simpan ke Calendar 😔 Coba lagi ya.");
    }
});

// --- Register Bot Menu ---
bot.setMyCommands([
    { command: 'start', description: 'Mulai & perkenalan bot' },
    { command: 'connect', description: 'Hubungkan Google Calendar' },
    { command: 'today', description: 'Lihat jadwal hari ini' },
    { command: 'tomorrow', description: 'Lihat jadwal besok' },
    { command: 'week', description: 'Ringkasan 7 hari ke depan' },
    { command: 'focus', description: 'Mulai sesi fokus' },
    { command: 'unfocus', description: 'Batalkan focus session' },
    { command: 'stats', description: 'Statistik event bulan ini' },
    { command: 'resetstats', description: 'Reset statistik' },
    { command: 'delete', description: 'Hapus event terakhir' },
    { command: 'help', description: 'Panduan penggunaan' },
]);

console.log('Amaa Remind aktif! 🤍');