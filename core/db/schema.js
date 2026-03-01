import { pgTable, text, timestamp, boolean, jsonb, integer, serial, uuid } from 'drizzle-orm/pg-core';

export const userState = pgTable('user_state', {
    chat_id: text('chat_id').primaryKey(),
    bot_mode: text('bot_mode'),
    last_chat_id: text('last_chat_id'),
    last_google_event_id: text('last_google_event_id'),
    last_focus_event_id: text('last_focus_event_id'),
});

export const tokens = pgTable('tokens', {
    chat_id: text('chat_id').primaryKey(),
    token_data: jsonb('token_data').notNull(),
});

export const reminders = pgTable('reminders', {
    id: uuid('id').defaultRandom().primaryKey(),
    chat_id: text('chat_id').notNull(),
    title: text('title').notNull(),
    reminder_time: timestamp('reminder_time').notNull(),
    start_time: timestamp('start_time'),
    sent: boolean('sent').default(false).notNull(),
    bot_mode: text('bot_mode'),
});

export const stats = pgTable('stats', {
    id: uuid('id').defaultRandom().primaryKey(),
    month: text('month').notNull(),
    category: text('category').notNull(),
    bot_mode: text('bot_mode'),
    count: integer('count').default(0).notNull(),
    event_hours: jsonb('event_hours').default({}),
});
