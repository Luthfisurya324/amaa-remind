const fs = require('fs');
const path = require('path');

// Helper atomic write untuk menghidari data corrupt
function atomicWriteJSON(filePath, data) {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
}

// Deteksi kategori event otomatis
function detectCategory(title) {
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
function cleanTitle(text, parsedResults) {
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

module.exports = {
    atomicWriteJSON,
    detectCategory,
    cleanTitle
};
