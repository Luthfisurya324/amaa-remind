import TelegramBot from 'node-telegram-bot-api';
import { getOAuth2Client, saveAuthToken } from '../core/calendar.js';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

export default async function handler(req, res) {
    const { code, state: chatId } = req.query;

    if (!code || !chatId) {
        return res.status(400).send('Missing code or state');
    }

    try {
        const oAuth2Client = getOAuth2Client();
        const { tokens } = await oAuth2Client.getToken(code);

        await saveAuthToken(chatId, tokens);

        await bot.sendMessage(chatId, 'Google Calendar berhasil terhubung! 🎉🤍\n\nSekarang kamu bisa langsung kirim jadwal, contoh:\n"Besok jam 9 meeting"');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>✅ Berhasil!</h1><p>Kamu bisa menutup halaman ini dan kembali ke Telegram.</p>');
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).send('Authentication failed');
    }
}
