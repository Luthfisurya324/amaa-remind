import { db } from './index.js';
import * as schema from './schema.js';
import { eq, and, lt, lte, ilike } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

// STATE & CHAT INFO
export async function upsertUserState(chatId, updates) {
    const existing = await getUserState(chatId);
    if (existing) {
        return await db.update(schema.userState)
            .set(updates)
            .where(eq(schema.userState.chat_id, chatId.toString()))
            .returning();
    } else {
        return await db.insert(schema.userState)
            .values({ chat_id: chatId.toString(), ...updates })
            .returning();
    }
}

export async function getUserState(chatId) {
    const [state] = await db.select().from(schema.userState).where(eq(schema.userState.chat_id, chatId.toString()));
    return state;
}

export async function clearFocusSession(chatId) {
    return await db.update(schema.userState)
        .set({ last_focus_event_id: null })
        .where(
            and(
                eq(schema.userState.chat_id, chatId.toString()),
                eq(schema.userState.bot_mode, process.env.BOT_MODE)
            )
        );
}

// TOKENS
export async function saveToken(chatId, tokensData) {
    const existing = await getToken(chatId);
    if (existing) {
        return await db.update(schema.tokens)
            .set({ token_data: tokensData })
            .where(eq(schema.tokens.chat_id, chatId.toString()))
            .returning();
    } else {
        return await db.insert(schema.tokens)
            .values({ chat_id: chatId.toString(), token_data: tokensData })
            .returning();
    }
}

export async function getToken(chatId) {
    const [row] = await db.select().from(schema.tokens).where(eq(schema.tokens.chat_id, chatId.toString()));
    return row;
}

export async function getAllActiveTokens() {
    return await db.select({ chat_id: schema.tokens.chat_id }).from(schema.tokens);
}

// REMINDERS
export async function addDbReminder(chatId, title, reminderTime, startTime) {
    return await db.insert(schema.reminders).values({
        chat_id: chatId.toString(),
        title,
        reminder_time: new Date(reminderTime),
        start_time: startTime ? new Date(startTime) : null,
        sent: false,
        bot_mode: process.env.BOT_MODE
    }).returning();
}

export async function removeDbReminderByTitle(titleSubstring) {
    return await db.delete(schema.reminders)
        .where(
            and(
                eq(schema.reminders.bot_mode, process.env.BOT_MODE),
                ilike(schema.reminders.title, `%${titleSubstring}%`)
            )
        );
}

export async function getDueReminders(now) {
    return await db.select().from(schema.reminders)
        .where(
            and(
                eq(schema.reminders.sent, false),
                eq(schema.reminders.bot_mode, process.env.BOT_MODE),
                lte(schema.reminders.reminder_time, new Date(now))
            )
        );
}

export async function getUnsentDbRemindersByChatId(chatId) {
    return await db.select().from(schema.reminders)
        .where(
            and(
                eq(schema.reminders.chat_id, chatId.toString()),
                eq(schema.reminders.sent, false)
            )
        );
}

export async function markDbReminderSent(id) {
    return await db.update(schema.reminders)
        .set({ sent: true })
        .where(eq(schema.reminders.id, id));
}

export async function cleanupOldDbReminders(dayAgoDate) {
    return await db.delete(schema.reminders)
        .where(
            and(
                eq(schema.reminders.sent, true),
                eq(schema.reminders.bot_mode, process.env.BOT_MODE),
                lt(schema.reminders.reminder_time, dayAgoDate)
            )
        );
}

// STATS
export async function trackDbStat(category, eventHour) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const hourKey = eventHour !== undefined ? `${eventHour}:00` : null;

    const [existing] = await db.select().from(schema.stats)
        .where(
            and(
                eq(schema.stats.month, monthKey),
                eq(schema.stats.category, category),
                eq(schema.stats.bot_mode, process.env.BOT_MODE)
            )
        );

    if (existing) {
        let hours = existing.event_hours || {};
        if (hourKey) {
            hours[hourKey] = (hours[hourKey] || 0) + 1;
        }
        await db.update(schema.stats)
            .set({
                count: existing.count + 1,
                event_hours: hours,
                bot_mode: process.env.BOT_MODE
            })
            .where(eq(schema.stats.id, existing.id));
    } else {
        let hours = {};
        if (hourKey) hours[hourKey] = 1;

        await db.insert(schema.stats).values({
            month: monthKey,
            category: category,
            count: 1,
            event_hours: hours,
            bot_mode: process.env.BOT_MODE
        });
    }
}

export async function getDbStats(monthKey) {
    return await db.select().from(schema.stats)
        .where(
            and(
                eq(schema.stats.month, monthKey),
                eq(schema.stats.bot_mode, process.env.BOT_MODE)
            )
        );
}

export async function resetDbStats(monthKey) {
    return await db.delete(schema.stats)
        .where(eq(schema.stats.month, monthKey));
}
