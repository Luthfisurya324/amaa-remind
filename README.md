# 🤍 Amaa Remind (Cloud Edition)

**Telegram Bot + Google Calendar Assistant** — Asisten pribadi yang memahami bahasa Indonesia secara natural untuk menjadwalkan event ke Google Calendar. 

Sekarang berjalan **24 Jam Non-stop** di Cloud menggunakan **Vercel (Serverless)** dan **Supabase (PostgreSQL)**!

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🗣️ **Natural Language (Bahasa Indonesia)** | Tulis bebas seperti *"besok jam 9 meeting"* dan bot langsung paham |
| 🏷️ **Auto Kategori + Emoji** | Otomatis mendeteksi jenis kegiatan (Rapat, Belajar, Olahraga, dll) |
| ⏳ **Durasi Otomatis** | Tidak menyebut jam selesai? Default 1 jam |
| ⚠️ **Deteksi Jadwal Bentrok** | Peringatan jika sudah ada event lain di jam yang sama |
| 🔔 **Persistent Reminder** | Notifikasi otomatis via Webhook (Aman walau server restart) |
| 📅 **Smart Daily Summary** | Ringkasan pagi jam 6 dengan tone personal sesuai kepadatan hari |
| 📊 **Weekly Overview** | Lihat ringkasan 7 hari ke depan + hari paling padat |
| 🔕 **Focus Mode** | Buat sesi fokus dengan durasi kustom + notifikasi saat selesai |
| 📈 **Monthly Stats** | Statistik event dan kategori terbanyak bulan ini |
| 🗑️ **Hapus Event Terakhir** | Salah bikin? Hapus cepat via `/delete` |
| 🔐 **OAuth via Telegram** | Hubungkan Google Calendar langsung dari chat |
| ☁️ **Cloud Native** | Stateless architecture, berjalan di Vercel Functions |

---

## 🛠️ Tech Stack Baru

- **Runtime:** Node.js (ES Modules)
- **Deployment:** [Vercel](https://vercel.com/) (Serverless Functions / Webhook Mode)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Bot Framework:** [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- **NLP Date Parser:** [chrono-node](https://github.com/wanasit/chrono)
- **Calendar API:** [Google Calendar API v3](https://developers.google.com/calendar) via `googleapis`
- **Cron Service:** [cron-job.org](https://cron-job.org/) (Gratis & Stabil)

---

## 📁 Struktur Project (Serverless)

```
amaa-remind/
├── api/                # Vercel Serverless Endpoints
│   ├── check-reminders.js # Cek reminder (1 menit sekali)
│   ├── daily-summary.js   # Ringkasan harian (Jam 6 pagi)
│   ├── oauth2callback.js  # Callback Google OAuth2
│   └── webhook.js         # Endpoint utama Telegram Bot
├── core/               # Logika Utama Bot
│   ├── calendar.js     # Interaksi Google Calendar & Token
│   ├── logic.js        # Controller & Message Router
│   ├── reminders.js    # Logika Pengingat
│   ├── supabase.js     # Base Client Supabase
│   └── utils.js        # Fungsi Helper
├── features/           # Modul Fungsionalitas
│   ├── calendar.js     # /today, /tomorrow, /week
│   ├── daily.js        # Logic Smart Daily Summary
│   ├── focus.js        # /focus, /unfocus
│   └── stats.js        # /stats, /resetstats
├── .env                # Variabel Lingkungan Lokal
├── index.js            # Entrypoint untuk LOCAL DEV (Polling)
├── vercel.json         # Routing Rules untuk Vercel
└── package.json        # Dependencies
```

---

## 🚀 Instalasi & Deployment (Vercel + Supabase)

### 1. Setup Supabase (Database)
1. Buat project baru di [Supabase](https://supabase.com).
2. Di menu **SQL Editor**, jalankan query ini untuk membuat tabel:
   ```sql
   create table reminders (id uuid default gen_random_uuid() primary key, chat_id text, title text, start_time timestamptz, reminder_time timestamptz, sent boolean default false);
   create table transactions (id uuid default gen_random_uuid() primary key, type text, category text, amount integer, date date default current_date);
   create table stats (id uuid default gen_random_uuid() primary key, month text, category text, count integer default 1, event_hours jsonb default '[]'::jsonb, unique(month, category));
   create table user_state (chat_id text primary key, last_chat_id text, last_google_event_id text, last_focus_event_id text);
   create table tokens (chat_id text primary key, token_data jsonb);
   ```
3. Copy **Project URL** dan **Anon Public Key** dari Settings -> API.

### 2. Setup Vercel (Hosting)
1. Push repository ini ke GitHub.
2. Login ke [Vercel](https://vercel.com) dan import repository-nya.
3. Di bagian **Environment Variables**, tambahkan:
   - `TELEGRAM_TOKEN` = (Token bot Telegram dari @BotFather)
   - `GOOGLE_CLIENT_ID` = (Client ID dari Google Cloud Console)
   - `GOOGLE_CLIENT_SECRET` = (Client Secret dari Google Cloud Console)
   - `SUPABASE_URL` = (Dari Supabase)
   - `SUPABASE_ANON_KEY` = (Dari Supabase)
   - `OAUTH_REDIRECT_URI` = `https://<URL-VERCEL-KAMU>.vercel.app/api/oauth2callback`
   - `CRON_SECRET` = (Buat password acak, contoh: `bebas-apa-aja-123`)
4. Klik **Deploy**.

### 3. Aktifkan Webhook Telegram
Setelah Vercel selesai deploy, buka browser dan akses URL ini untuk menyambungkan Telegram ke Vercel:
`https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<URL-VERCEL-KAMU>.vercel.app/api/webhook`

### 4. Setup Cron-job.org (Automation)
Daftar di [cron-job.org](https://cron-job.org/) dan buat 2 jobs:
1. **Reminder Cron**
   - URL: `https://<URL-VERCEL-KAMU>.vercel.app/api/check-reminders?secret=bebas-apa-aja-123`
   - Schedule: Every 1 Minute
2. **Daily Summary Cron**
   - URL: `https://<URL-VERCEL-KAMU>.vercel.app/api/daily-summary?secret=bebas-apa-aja-123`
   - Schedule: Daily at 06:00 (Asia/Jakarta)

---

## 💻 Local Development
Jika ingin testing di komputer lokal (mode polling, bukan webhook):
1. Copy file `.env.example` menjadi `.env` dan isi valuenya.
2. `OAUTH_REDIRECT_URI` rubah jadi `http://localhost:3000/api/oauth2callback`.
3. Jalankan `npm run dev`. Bot akan berjalan dalam mode polling!

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

## 📄 Lisensi
ISC
