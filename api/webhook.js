import TelegramBot from 'node-telegram-bot-api';
import { processUpdate } from '../core/logic.js';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await processUpdate(bot, req.body);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
    return res.status(200).send('Amaa Remind is running 🤍');
}
