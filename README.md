# 🤍 Amaa Remind

**Telegram Bot + Google Calendar Assistant** — Asisten pribadi yang memahami bahasa Indonesia secara natural untuk menjadwalkan event ke Google Calendar.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🗣️ **Natural Language (Bahasa Indonesia)** | Tulis bebas seperti *"besok jam 9 meeting"* dan bot langsung paham |
| 🏷️ **Auto Kategori + Emoji** | Otomatis mendeteksi jenis kegiatan (Rapat, Belajar, Olahraga, dll) |
| ⏳ **Durasi Otomatis** | Tidak menyebut jam selesai? Default 1 jam |
| ⚠️ **Deteksi Jadwal Bentrok** | Peringatan jika sudah ada event lain di jam yang sama |
| 🔔 **Persistent Reminder** | Notifikasi 30 menit sebelum event — tetap aktif walau bot di-restart |
| 📅 **Smart Daily Summary** | Ringkasan pagi jam 6 dengan tone personal sesuai kepadatan hari |
| 📊 **Weekly Overview** | Lihat ringkasan 7 hari ke depan + hari paling padat |
| 🔕 **Focus Mode** | Buat sesi fokus dengan durasi kustom + notifikasi saat selesai |
| 📈 **Monthly Stats** | Statistik event dan kategori terbanyak bulan ini |
| 🗑️ **Hapus Event Terakhir** | Salah bikin? Hapus cepat via `/delete` |
| 🔐 **OAuth via Telegram** | Hubungkan Google Calendar langsung dari chat, tanpa script terpisah |

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Bot Framework:** [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- **NLP Date Parser:** [chrono-node](https://github.com/wanasit/chrono) + Indonesian translator
- **Calendar API:** [Google Calendar API v3](https://developers.google.com/calendar) via `googleapis`
- **Scheduler:** [node-cron](https://github.com/node-cron/node-cron)
- **Environment:** [dotenv](https://github.com/motdotla/dotenv)

---

## 📁 Struktur Project

```
amaa-remind/
├── core/               # Core modules (utils, calendar, reminders)
├── features/           # Feature modules (stats, focus, daily, calendar)
├── index.js            # Main entrypoint & bot orchestration
├── .env                # Environment variables (secrets)
├── .gitignore          # Mencegah file sensitif ter-commit
├── credentials.json    # Google Cloud OAuth2 credentials
├── token.json          # OAuth2 token (auto-generated)
├── reminders.json      # Persistent reminders (auto-generated)
├── stats.json          # Monthly event statistics (auto-generated)
├── last_chat_id.txt    # Chat ID terakhir (untuk daily summary)
├── package.json        # Dependencies & metadata
└── README.md           # Dokumentasi ini
```

---

## 🚀 Instalasi & Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd amaa-remind
npm install
```

### 2. Setup Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih yang sudah ada
3. Aktifkan **Google Calendar API**
4. Buat **OAuth 2.0 Client ID** (tipe: Web Application)
5. Tambahkan **Authorized redirect URI:**
   ```
   http://localhost:3000/oauth2callback
   ```
6. Catat `Client ID` dan `Client Secret`

### 3. Setup Telegram Bot

1. Chat ke [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot` dan ikuti instruksi
3. Catat **API Token** yang diberikan

### 4. Konfigurasi Environment

Buat file `.env` di root project:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/oauth2callback
```

### 5. Jalankan Bot

```bash
node index.js
```

### 6. Hubungkan Google Calendar

Buka Telegram → Chat bot kamu → Ketik `/connect` → Klik link → Login & izinkan akses. Selesai! 🎉

---

## 💬 Cara Penggunaan

### Pesan Bebas (Natural Language)

| Contoh Pesan | Hasil |
|---|---|
| `besok jam 9 meeting` | 📞 Rapat — besok 09.00–10.00 |
| `hari ini jam 15 sampe 17 belajar` | 📚 Belajar — hari ini 15.00–17.00 |
| `lusa makan siang jam 12` | 🍽️ Makan — lusa 12.00–13.00 |
| `minggu depan nongkrong` | ☕ Santai — minggu depan (1 jam) |
| `besok pagi gym jam 6` | 🏋️ Olahraga — besok 06.00–07.00 |

### Slash Commands

| Command | Fungsi |
|---|---|
| `/start` | Welcome message |
| `/connect` | Hubungkan Google Calendar |
| `/today` | Jadwal hari ini |
| `/tomorrow` | Jadwal besok |
| `/week` | Ringkasan 7 hari ke depan |
| `/focus [durasi]` | Mulai sesi fokus (contoh: `/focus 2 jam`) |
| `/stats` | Statistik event bulan ini |
| `/delete` | Hapus event terakhir yang dibuat |
| `/help` | Panduan penggunaan |

---

## 🏷️ Auto Kategori

| Kata Kunci | Kategori |
|---|---|
| rapat, meeting | 📞 Rapat |
| belajar, kelas, kampus, kuliah | 📚 Belajar |
| gym, lari, olahraga | 🏋️ Olahraga |
| makan, dinner, lunch | 🍽️ Makan |
| nongkrong, main, jalan | ☕ Santai |
| focus, fokus | 🔕 Focus Session |
| *(lainnya)* | 📝 [judul asli] |

---

## 🔤 Kamus Terjemahan Bahasa Indonesia

| Bahasa Indonesia | Diterjemahkan ke |
|---|---|
| besok | tomorrow |
| lusa | day after tomorrow |
| hari ini | today |
| minggu/bulan/tahun depan | next week/month/year |
| jam [angka] | at [angka] |
| sampe / sampai | to |
| pagi | morning |
| siang / sore | afternoon |
| malam | evening |

---

## ⚙️ Fitur Otomatis

### 🔔 Persistent Reminder
Reminder disimpan ke `reminders.json` dan dicek setiap 30 detik via cron. Event yang dijadwalkan akan tetap mendapat reminder meski bot di-restart.

### 📅 Smart Daily Summary (Jam 6 Pagi)
Pesan pagi disesuaikan dengan kepadatan:
- **0 event:** "Hari ini kosong, selamat istirahat! ✨"
- **1 event:** "Santai 🤍 cuma ada 1 agenda"
- **2–3 event:** "Ada beberapa agenda, semangat! 💪"
- **4+ event:** "Cukup padat 😅 atur energi ya"

### 🔕 Focus Mode
Ketik `/focus 2 jam` untuk:
- Membuat event "🔕 Focus Session" di Google Calendar
- Mendapat notifikasi saat sesi selesai

### 📈 Monthly Stats
Setiap event yang dibuat via bot dicatat di `stats.json`. Ketik `/stats` untuk lihat ringkasan bulanan.

---

## 🔐 Security

- Semua secrets disimpan di `.env` (tidak di-commit)
- `credentials.json`, `token.json` ada di `.gitignore`
- OAuth2 flow via Telegram (`/connect`) — aman dan praktis

---

## 🐛 Troubleshooting

| Error | Solusi |
|---|---|
| `409 Conflict` | Pastikan hanya 1 instance bot berjalan: `taskkill /F /IM node.exe /T` |
| `No refresh token` | Jalankan `/connect` ulang dari Telegram |
| `Access blocked` | Tambahkan email sebagai Test User di Google Cloud Console → OAuth Consent Screen |
| `EADDRINUSE port 3000` | Port 3000 masih dipakai proses lain, matikan dulu |

---

## 📋 Catatan Pengembangan

- **Single-user optimized:** Dirancang untuk penggunaan pribadi, ringan tanpa database
- **File-based storage:** `reminders.json`, `stats.json`, `last_chat_id.txt`
- **Webhook mode:** Untuk deployment cloud, pertimbangkan ganti polling ke webhook

---

## 📄 Lisensi

ISC
