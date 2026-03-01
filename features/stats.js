import { trackDbStat, getDbStats, resetDbStats } from '../core/db/queries.js';

export async function trackEvent(category, eventHour) {
    try {
        await trackDbStat(category, eventHour);
    } catch (error) {
        console.error('❌ Error tracking stats:', error);
    }
}

export async function handleStatsCommand(bot, msg, command) {
    const chatId = msg.chat.id;
    const monthKey = new Date().toISOString().slice(0, 7);

    if (command === '/stats') {
        let stats;
        try {
            stats = await getDbStats(monthKey);
        } catch (error) {
            console.error('❌ Error fetching stats from DB:', error);
            bot.sendMessage(chatId, "Waduh, gagal ambil data statistik nih 😭");
            return true;
        }

        if (!stats || stats.length === 0) {
            bot.sendMessage(chatId, "Bulan ini belum ada event yang dibuat lewat Amaa Remind 📝");
            return true;
        }

        let totalCount = 0;
        let globalHours = {};
        let categoriesInfo = [];

        stats.forEach(s => {
            totalCount += s.count;
            categoriesInfo.push({ category: s.category, count: s.count });

            if (s.event_hours) {
                Object.entries(s.event_hours).forEach(([h, c]) => {
                    globalHours[h] = (globalHours[h] || 0) + c;
                });
            }
        });

        categoriesInfo.sort((a, b) => b.count - a.count);
        const top = categoriesInfo[0];

        let text = `📊 Statistik bulan ini:\n\n`;
        text += `Total event dibuat: ${totalCount}\n`;
        text += `Kategori terbanyak: ${top.category} (${top.count}x)\n\n`;

        if (Object.keys(globalHours).length > 0) {
            const busiestHour = Object.entries(globalHours).sort((a, b) => b[1] - a[1])[0];
            text += `⏰ Jam paling aktif: ${busiestHour[0]} (${busiestHour[1]} event)\n\n`;
        }

        text += `Detail kategori:\n`;
        categoriesInfo.forEach(({ category, count }) => {
            text += `  ${category}: ${count}x\n`;
        });

        bot.sendMessage(chatId, text);
        return true;
    }

    if (command === '/resetstats') {
        try {
            await resetDbStats(monthKey);
            bot.sendMessage(chatId, "Statistik bulan ini sudah di-reset! 🗑️ Mulai dari nol lagi ya 🤍");
        } catch (error) {
            console.error('❌ Error resetting stats:', error);
            bot.sendMessage(chatId, "Gagal reset statistik 😭");
        }
        return true;
    }

    return false;
}
