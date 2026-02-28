// Deteksi kategori event otomatis
export function detectCategory(title) {
    const lower = title.toLowerCase();
    if (lower.includes("rapat") || lower.includes("meeting")) return "📞 Rapat";
    if (lower.includes("belajar") || lower.includes("kelas") || lower.includes("kampus") || lower.includes("kuliah")) return "📚 Belajar";
    if (lower.includes("gym") || lower.includes("lari") || lower.includes("olahraga")) return "🏋️ Olahraga";
    if (lower.includes("makan") || lower.includes("dinner") || lower.includes("lunch")) return "🍽️ Makan";
    if (lower.includes("nongkrong") || lower.includes("main") || lower.includes("jalan")) return "☕ Santai";
    if (lower.includes("focus") || lower.includes("fokus")) return "🔕 Focus Session";
    return "📝 " + title;
}

// Bersihkan judul dari kata-kata waktu
export function cleanTitle(text) {
    let rawTitle = text.toLowerCase();

    // Hapus pola jam
    rawTitle = rawTitle.replace(/\b(?:jam|pukul)\s*\d{1,2}(?:\.\d{2})?(?:\s*(?:pagi|siang|sore|malam))?\b/gi, '');

    // Hapus pola sampe/sampai jam
    rawTitle = rawTitle.replace(/\b(?:sampe|sampai|s\/d)\s*(?:jam|pukul)?\s*\d{1,2}(?:\.\d{2})?\b/gi, '');

    // Hapus pola hari/keterangan waktu
    rawTitle = rawTitle.replace(/\b(?:besok|lusa|hari ini|nanti|minggu depan|bulan depan|tahun depan)\b/gi, '');

    // Hapus nama hari (senin-minggu)
    rawTitle = rawTitle.replace(/\b(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b/gi, '');

    // Hapus preposisi waktu
    rawTitle = rawTitle.replace(/\b(?:pagi|siang|sore|malam)\b/gi, '');

    // Hapus bagian lokasi ("di ...") jika ada di akhir
    if (rawTitle.includes(' di ')) {
        rawTitle = rawTitle.split(/ di /i)[0]; // Ambil bagian sebelum 'di'
    }

    // Bersihkan sisa karakter aneh
    rawTitle = rawTitle
        .replace(/\b(?:ada|sama|dengan|ke|buat)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return rawTitle || "Agenda";
}

// Terjemahkan bahasa Indonesia ke bahasa Inggris agar dipahami chrono-node
export function translateIndoToChrono(text) {
    let lowerText = text.toLowerCase();

    // Replace "jam X" -> "at X"
    lowerText = lowerText.replace(/jam (\d+)/g, 'at $1');
    lowerText = lowerText.replace(/pukul (\d+)/g, 'at $1');

    // Replace dates
    lowerText = lowerText.replace(/\bbesok\b/g, 'tomorrow');
    lowerText = lowerText.replace(/\blusa\b/g, 'day after tomorrow');
    lowerText = lowerText.replace(/\bhari ini\b/g, 'today');

    // Replace "sampe" / "sampai" -> "to"
    lowerText = lowerText.replace(/\bsampe\b/g, 'to');
    lowerText = lowerText.replace(/\bsampai\b/g, 'to');

    // Relative Time
    lowerText = lowerText.replace(/(\d+)\s+menit\s+lagi/g, 'in $1 minutes');
    lowerText = lowerText.replace(/(\d+)\s+jam\s+lagi/g, 'in $1 hours');
    lowerText = lowerText.replace(/setengah\s+jam\s+lagi/g, 'in 30 minutes');

    // Replace time of day
    lowerText = lowerText.replace(/\bpagi\b/g, 'morning');
    lowerText = lowerText.replace(/\bsiang\b/g, 'afternoon');
    lowerText = lowerText.replace(/\bsore\b/g, 'afternoon'); // chrono handles afternoon better than evening up to 5pm usually
    lowerText = lowerText.replace(/\bmalam\b/g, 'evening');

    // Next periods
    lowerText = lowerText.replace(/\bminggu depan\b/g, 'next week');
    lowerText = lowerText.replace(/\bbulan depan\b/g, 'next month');
    lowerText = lowerText.replace(/\btahun depan\b/g, 'next year');

    // Days of week
    const days = {
        'senin': 'monday',
        'selasa': 'tuesday',
        'rabu': 'wednesday',
        'kamis': 'thursday',
        'jumat': 'friday',
        'sabtu': 'saturday',
        'minggu': 'sunday'
    };

    for (const [id, en] of Object.entries(days)) {
        lowerText = lowerText.replace(new RegExp(`\\b${id}\\b`, 'g'), en);
    }

    return lowerText;
}
