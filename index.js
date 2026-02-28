import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { processUpdate } from './core/logic.js';
import { checkAndSendReminders } from './core/reminders.js';
import cron from 'node-cron';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Listen for messages (Polling mode for local dev)
bot.on('message', async (msg) => {
    await processUpdate(bot, { message: msg });
});

// Local Cron for Reminders (Optional, for local testing)
cron.schedule('*/1 * * * *', () => {
    console.log('⏰ Checking reminders (Local Cron)...');
    checkAndSendReminders(bot);
});

// Register Commands Menu
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
    { command: 'edit', description: 'Edit event terakhir' },
    { command: 'help', description: 'Panduan penggunaan' },
]);

console.log('🚀 Amaa Remind Local Dev Server Active! 🤍');