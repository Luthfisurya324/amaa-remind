const fs = require('fs');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content));
});

function authorize(credentials) {
    const { client_secret, client_id } = credentials.web || credentials.installed;

    // Menggunakan localhost untuk callback
    const redirectUri = 'http://localhost:3000/oauth2callback';
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Paksa minta consent ulang agar refresh_token selalu dikembalikan
        scope: ['https://www.googleapis.com/auth/calendar.events'],
    });

    console.log('\n=========================================');
    console.log('KUNJUNGI LINK INI UNTUK OTORISASI GOOGLE CALENDAR:');
    console.log('=========================================');
    console.log(authUrl);
    console.log('\n(Server berjalan di port 3000 menunggu callback otorisasi...)');

    const server = http.createServer(async (req, res) => {
        try {
            if (req.url.startsWith('/oauth2callback')) {
                const queryParams = new url.URL(req.url, 'http://localhost:3000').searchParams;
                const code = queryParams.get('code');

                if (code) {
                    res.end('Otorisasi berhasil! Kamu bisa menutup halaman ini dan kembali ke terminal.');
                    server.close();
                    console.log('\nKode otorisasi berhasil didapatkan. Mengambil token...');

                    oAuth2Client.getToken(code, (err, token) => {
                        if (err) return console.error('Error saat mengambil token:', err);
                        fs.writeFile('token.json', JSON.stringify(token), (err) => {
                            if (err) return console.error(err);
                            console.log('Token berhasil disimpan ke token.json!');
                            console.log('=========================================');
                            console.log('BERHASIL! Sekarang kamu bisa menjalankan bot dengan perintah: node index.js');
                            console.log('=========================================');
                            process.exit(0);
                        });
                    });
                } else {
                    res.end('Gagal mendapatkan otorisasi.');
                }
            }
        } catch (e) {
            console.error(e);
        }
    }).listen(3000, () => {
        // NOTE: Jangan lupa pastikan di console.cloud.google.com -> Credentials
        // URI redirect 'http://localhost:3000/oauth2callback' sudah ditambahkan
        console.log('Pastikan URI redirect "http://localhost:3000/oauth2callback"');
        console.log('sudah ditambahkan di Google Cloud Console untuk credential ini.\n');
    });
}
