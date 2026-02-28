import TelegramBot from 'node-telegram-bot-api';
import { checkAndSendReminders } from '../core/reminders.js';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

export default async function handler(req, res) {
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const isValidSecret = req.query.secret === process.env.CRON_SECRET;

    if (!isVercelCron && !isValidSecret) {
        return res.status(401).send('Unauthorized');
    }

    try {
        await checkAndSendReminders(bot);
        return res.status(200).send('Reminders checked 🤍');
    } catch (error) {
        console.error('Cron Reminders Error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
