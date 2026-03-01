import { google } from 'googleapis';
import crypto from 'crypto';
import { getDbStats, getUserState } from '../core/db/queries.js';
import { getAuthClient } from '../core/calendar.js';

// Verify Telegram Web App initData
function verifyTelegramWebAppData(telegramInitData) {
    if (!telegramInitData) return false;

    // Parse initData
    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // Create sorted params string
    urlParams.sort();
    const dataCheckString = Array.from(urlParams.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    // Verify hash using bot token
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.TELEGRAM_TOKEN)
        .digest();

    const expectedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (hash !== expectedHash) {
        return false;
    }

    // Hash is valid, extract user
    const userStr = urlParams.get('user');
    return userStr ? JSON.parse(userStr) : null;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { initData, dev_chat_id } = req.query;

    let chatId;

    // In local development, allow bypassing initData validation if DEV_CHAT_ID is passed
    // NOTE: In production, we MUST rely on the verified initData for security
    if (!initData && dev_chat_id && process.env.NODE_ENV !== 'production') {
        chatId = dev_chat_id;
    } else {
        const user = verifyTelegramWebAppData(initData);
        if (!user || (!dev_chat_id && !user.id)) {
            return res.status(401).json({ error: 'Unauthorized. Invalid initData.' });
        }
        chatId = user.id.toString();
    }

    try {
        // Fetch User State (checking bot_mode just in case)
        const userState = await getUserState(chatId);

        // Setup data object
        const responseData = {
            isConnected: false,
            events: [],
            stats: {
                totalEvents: 0,
                focusSessions: 0
            }
        };

        // Fetch DB Stats
        const monthKey = new Date().toISOString().slice(0, 7);
        const stats = await getDbStats(monthKey);

        if (stats && stats.length > 0) { // getDbStats returns an array
            // Summarize
            stats.forEach(s => {
                if (s.category === '🔕 Focus Session') {
                    responseData.stats.focusSessions += s.count;
                } else {
                    responseData.stats.totalEvents += s.count;
                }
            });
        }

        // Fetch Google Calendar Data
        const authClient = await getAuthClient(chatId, null); // passing null for bot since we just want the client if it exists
        if (authClient) {
            responseData.isConnected = true;
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            const start = new Date();
            const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000); // Next 7 days
            start.setHours(0, 0, 0, 0);

            const resCal = await calendar.events.list({
                calendarId: 'primary',
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                maxResults: 15, // don't overload dashboard UI
                singleEvents: true,
                orderBy: 'startTime',
            });

            responseData.events = resCal.data.items || [];
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('API Dashboard Error:', error);
        return res.status(500).json({ error: 'Internal Server Error fetching dashboard data' });
    }
}
