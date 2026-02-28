import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

export default async function handler(req, res) {
    try {
        await bot.setMyCommands([
            { command: 'start', description: 'Mulai & perkenalan bot' },
            { command: 'connect', description: 'Hubungkan Google Calendar' },
            { command: 'today', description: 'Lihat jadwal hari ini' },
            { command: 'tomorrow', description: 'Lihat jadwal besok' },
            { command: 'week', description: 'Ringkasan 7 hari ke depan' },
            { command: 'agenda', description: 'Lihat & hapus agenda mendatang' },
            { command: 'focus', description: 'Mulai sesi fokus' },
            { command: 'unfocus', description: 'Batalkan focus session' },
            { command: 'stats', description: 'Statistik event bulan ini' },
            { command: 'resetstats', description: 'Reset statistik' },
            { command: 'delete', description: 'Lihat & hapus agenda' },
            { command: 'edit', description: 'Edit event terakhir' },
            { command: 'help', description: 'Panduan penggunaan' },
        ]);

        return res.status(200).send('Successfully registered bot commands to Telegram! 🤍');
    } catch (error) {
        console.error('Failed to set commands:', error);
        return res.status(500).send('Failed to register commands.');
    }
}
