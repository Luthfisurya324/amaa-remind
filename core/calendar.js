const fs = require('fs');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');

let pendingAuthChatId = null;

function getOAuth2Client() {
    const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    );
}

function getAuthClient(chatId, bot) {
    const oAuth2Client = getOAuth2Client();
    try {
        const token = JSON.parse(fs.readFileSync('token.json'));
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    } catch (e) {
        if (chatId && bot) {
            bot.sendMessage(chatId, 'Kalender belum terhubung nih 😔 Ketik /connect dulu yaa.');
        }
        return null;
    }
}

function startCallbackServer(bot) {
    const callbackServer = http.createServer((req, res) => {
        try {
            if (req.url && req.url.startsWith('/oauth2callback')) {
                const queryParams = new url.URL(req.url, 'http://localhost:3000').searchParams;
                const code = queryParams.get('code');

                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>✅ Berhasil!</h1><p>Kamu bisa menutup halaman ini dan kembali ke Telegram.</p>');

                    const oAuth2Client = getOAuth2Client();
                    oAuth2Client.getToken(code, (err, token) => {
                        if (err) {
                            console.error('Error saat mengambil token:', err);
                            if (pendingAuthChatId && bot) bot.sendMessage(pendingAuthChatId, 'Gagal mendapatkan token 😔 Coba ulangi /connect');
                            return;
                        }
                        fs.writeFileSync('token.json', JSON.stringify(token));
                        console.log('Token berhasil disimpan ke token.json!');
                        if (pendingAuthChatId && bot) {
                            bot.sendMessage(pendingAuthChatId, 'Google Calendar berhasil terhubung! 🎉🤍\n\nSekarang kamu bisa langsung kirim jadwal, contoh:\n"Besok jam 9 meeting"');
                            pendingAuthChatId = null;
                        }
                    });
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>❌ Gagal</h1><p>Tidak ada kode otorisasi.</p>');
                }
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        } catch (e) {
            console.error('Callback server error:', e);
            res.writeHead(500);
            res.end('Server error');
        }
    });

    callbackServer.listen(3000, () => {
        console.log('OAuth callback server aktif di port 3000');
    });
}

function setPendingAuthChatId(id) {
    pendingAuthChatId = id;
}

// 🔄 CRASH RECOVERY — Scan Calendar on startup
async function crashRecoveryCheck(bot, FILE_PATHS, loadReminders, saveReminders) {
    let latestChatId = null;
    try {
        latestChatId = fs.readFileSync(FILE_PATHS.LAST_CHAT_FILE, 'utf8');
    } catch (e) { return; }

    const oAuth2Client = getAuthClient(null, bot);
    if (!oAuth2Client) return;

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
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
        let reminders = loadReminders();
        let added = 0;

        events.forEach(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date).getTime();
            const reminderTime = eventStart - (30 * 60 * 1000);

            if (reminderTime <= Date.now()) return;
            const exists = reminders.some(r =>
                !r.sent && Math.abs(r.reminderTime - reminderTime) < 60000
            );
            if (!exists) {
                reminders.push({
                    chatId: parseInt(latestChatId),
                    title: event.summary || 'Agenda',
                    reminderTime,
                    sent: false
                });
                added++;
            }
        });

        if (added > 0) {
            saveReminders(reminders);
            console.log(`Crash recovery: ${added} reminder di-generate ulang dari Calendar`);
        } else {
            console.log('Crash recovery: semua reminder sudah sinkron ✅');
        }
    } catch (e) {
        console.error('Crash recovery gagal:', e.message);
    }
}

module.exports = {
    getOAuth2Client,
    getAuthClient,
    startCallbackServer,
    setPendingAuthChatId,
    crashRecoveryCheck
};
