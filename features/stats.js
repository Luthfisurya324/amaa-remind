import { supabase } from '../core/supabase.js';

export async function trackEvent(category, eventHour) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const hourKey = eventHour !== undefined ? `${eventHour}:00` : null;

    // Use Postgres upsert logic
    const { data: existing, error: fetchError } = await supabase
        .from('stats')
        .select('*')
        .eq('month', monthKey)
        .eq('category', category)
        .eq('bot_mode', process.env.BOT_MODE) // Added filter
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows found"
        console.error('❌ Error fetching stats:', fetchError);
        return;
    }

    if (existing) {
        let hours = existing.event_hours || {};
        if (hourKey) {
            hours[hourKey] = (hours[hourKey] || 0) + 1;
        }
        await supabase
            .from('stats')
            .update({
                count: existing.count + 1,
                event_hours: hours,
                bot_mode: process.env.BOT_MODE // Added to update
            })
            .eq('id', existing.id);
    } else {
        let hours = {};
        if (hourKey) hours[hourKey] = 1;
        await supabase
            .from('stats')
            .insert({
                month: monthKey,
                category: category,
                count: 1,
                event_hours: hours,
                bot_mode: process.env.BOT_MODE // Added to insert
            });
    }
}

export async function handleStatsCommand(bot, msg, command) {
    const chatId = msg.chat.id;
    const monthKey = new Date().toISOString().slice(0, 7);

    if (command === '/stats') {
        const { data: stats, error } = await supabase
            .from('stats')
            .select('*')
            .eq('month', monthKey)
            .eq('bot_mode', process.env.BOT_MODE); // Added filter

        if (error) {
            console.error('❌ Error fetching stats from Supabase:', error);
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
        const { error } = await supabase
            .from('stats')
            .delete()
            .eq('month', monthKey);

        if (error) {
            console.error('❌ Error resetting stats:', error);
            bot.sendMessage(chatId, "Gagal reset statistik 😭");
        } else {
            bot.sendMessage(chatId, "Statistik bulan ini sudah di-reset! 🗑️ Mulai dari nol lagi ya 🤍");
        }
        return true;
    }

    return false;
}
