const fs = require('fs');
const { atomicWriteJSON } = require('../core/utils');

function initStats(FILE_PATHS) {
    const { STATS_FILE } = FILE_PATHS;

    function loadStats() {
        try {
            return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }

    function trackEvent(category, eventHour) {
        let stats = loadStats();

        const monthKey = new Date().toISOString().slice(0, 7);
        if (!stats[monthKey]) stats[monthKey] = { total: 0, categories: {}, hours: {} };
        stats[monthKey].total++;
        stats[monthKey].categories[category] = (stats[monthKey].categories[category] || 0) + 1;

        if (eventHour !== undefined) {
            const hourKey = `${eventHour}:00`;
            stats[monthKey].hours[hourKey] = (stats[monthKey].hours[hourKey] || 0) + 1;
        }

        const keys = Object.keys(stats).sort();
        if (keys.length > 6) {
            keys.slice(0, keys.length - 6).forEach(k => delete stats[k]);
        }

        atomicWriteJSON(STATS_FILE, stats);
    }

    function handleCommand(bot, msg, command) {
        const chatId = msg.chat.id;

        if (command === '/stats') {
            const stats = loadStats();
            const monthKey = new Date().toISOString().slice(0, 7);
            const monthStats = stats[monthKey];

            if (!monthStats || monthStats.total === 0) {
                bot.sendMessage(chatId, "Bulan ini belum ada event yang dibuat lewat Amaa Remind 📝");
                return true;
            }

            const categories = Object.entries(monthStats.categories).sort((a, b) => b[1] - a[1]);
            const top = categories[0];

            let text = `📊 Statistik bulan ini:\n\n`;
            text += `Total event dibuat: ${monthStats.total}\n`;
            text += `Kategori terbanyak: ${top[0]} (${top[1]}x)\n\n`;

            if (monthStats.hours && Object.keys(monthStats.hours).length > 0) {
                const busiestHour = Object.entries(monthStats.hours).sort((a, b) => b[1] - a[1])[0];
                text += `⏰ Jam paling aktif: ${busiestHour[0]} (${busiestHour[1]} event)\n\n`;
            }

            text += `Detail kategori:\n`;
            categories.forEach(([cat, count]) => {
                text += `  ${cat}: ${count}x\n`;
            });

            bot.sendMessage(chatId, text);
            return true;
        }

        if (command === '/resetstats') {
            let stats = loadStats();
            const monthKey = new Date().toISOString().slice(0, 7);
            delete stats[monthKey];
            atomicWriteJSON(STATS_FILE, stats);
            bot.sendMessage(chatId, "Statistik bulan ini sudah di-reset! 🗑️ Mulai dari nol lagi ya 🤍");
            return true;
        }

        return false;
    }

    return { trackEvent, handleCommand };
}

module.exports = { initStats };
