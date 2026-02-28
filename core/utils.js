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
export function cleanTitle(text, parsedResults) {
    let rawTitle = text;
    parsedResults.forEach(res => {
        rawTitle = rawTitle.replace(res.text, '');
    });
    rawTitle = rawTitle
        .replace(/\bbesok|lusa|jam|pagi|siang|sore|malam|hari ini|ada|sama|dengan|di|ke|sampe|sampai|minggu depan|bulan depan\b/gi, '')
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
