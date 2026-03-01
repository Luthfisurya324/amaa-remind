import { google } from 'googleapis';
import { getToken, saveToken, getUnsentDbRemindersByChatId } from './db/queries.js';

export function getOAuth2Client() {
    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/oauth2callback';
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    );
}

export async function getAuthClient(chatId, bot) {
    const oAuth2Client = getOAuth2Client();
    try {
        const tokenData = await getToken(chatId);

        if (!tokenData) throw new Error('No token found');

        oAuth2Client.setCredentials(tokenData.token_data);

        // Handle token refresh automatically
        oAuth2Client.on('tokens', async (tokens) => {
            if (tokens.refresh_token) {
                // If we got a new refresh token, store everything
                await saveToken(chatId, tokens);
            } else {
                // Otherwise just update the access token parts
                const current = await getToken(chatId);
                const updatedToken = { ...(current ? current.token_data : {}), ...tokens };
                await saveToken(chatId, updatedToken);
            }
        });

        return oAuth2Client;
    } catch (e) {
        if (chatId && bot) {
            bot.sendMessage(chatId, 'Kalender belum terhubung nih 😔 Ketik /connect dulu yaa.');
        }
        return null;
    }
}

// saveToken method is now handled by the DAL. 
// Function signature exported for backward compatibility
export async function saveAuthToken(chatId, token) {
    await saveToken(chatId, token);
}

// 🔄 CRASH RECOVERY — Scan Calendar and sync with Supabase
export async function crashRecoveryCheck(bot, chatId, loadReminders, addReminder) {
    const authClient = await getAuthClient(chatId, bot);
    if (!authClient) return;

    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: in24h.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = res.data.items || [];

        // Note: loadReminders would now fetch from DB
        const existingReminders = await getUnsentDbRemindersByChatId(chatId);

        let added = 0;

        for (const event of events) {
            const eventStart = new Date(event.start.dateTime || event.start.date).getTime();
            const reminderTime = eventStart - (30 * 60 * 1000);

            if (reminderTime <= Date.now()) continue;

            const exists = existingReminders.some(r =>
                Math.abs(new Date(r.reminder_time).getTime() - reminderTime) < 60000
            );

            if (!exists) {
                await addReminder(chatId, event.summary || 'Agenda', reminderTime, eventStart);
                added++;
            }
        }

        if (added > 0) {
            console.log(`Crash recovery: ${added} reminder di-generate ulang dari Calendar`);
        } else {
            console.log('Crash recovery: semua reminder sudah sinkron ✅');
        }
    } catch (e) {
        console.error('Crash recovery gagal:', e.message);
    }
}
