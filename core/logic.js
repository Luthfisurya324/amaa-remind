import { handleFocusCommand } from '../features/focus.js';
import { handleGeneralCommands } from '../features/commands.js';
import { handleEventCreation } from '../features/events.js';
import { getAuthClient } from './calendar.js';
import { generateAIResponse } from './ai.js';
import { upsertUserState } from './db/queries.js';
import { handleStatsCommand, trackEvent } from '../features/stats.js';
import { handleCalendarCommand } from '../features/calendar.js';
import { addReminder, removeReminderByTitle } from './reminders.js';

export async function processUpdate(bot, update) {
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Save Chat ID to user_state for cron jobs
    await upsertUserState(chatId, { last_chat_id: chatId.toString(), bot_mode: process.env.BOT_MODE });

    // --- COMMAND HANDLERS ---
    if (text.startsWith('/')) {
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();

        if (await handleGeneralCommands(bot, msg, command, parts)) return;

        // Feature-based command routing
        if (await handleFocusCommand(bot, msg, command, parts, { getAuthClient, addReminder, removeReminderByTitle, trackEvent })) return;
        if (await handleStatsCommand(bot, msg, command)) return;
        if (await handleCalendarCommand(bot, msg, command, { getAuthClient })) return;

        return;
    }

    // --- NLP PARSING & EVENT CREATION (Route to features/events.js) ---
    const eventHandled = await handleEventCreation(bot, msg, text);
    if (!eventHandled) {
        const aiReply = await generateAIResponse(text, process.env.BOT_MODE);
        await bot.sendMessage(chatId, aiReply);
    }
}
