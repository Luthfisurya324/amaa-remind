import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testGemini() {
    const rawText = "besok rapat iat jam 5 di masjid uika";
    const nowWIB = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString();
    const datesMsg = `Waktu referensi saat ini: ${nowWIB} (Zona Waktu: WIB / GMT+7). `;

    const personaContext = `Kamu adalah Abang Lupi.
Kamu berbicara sebagai abang yang hangat, suportif, sedikit playful, dan protektif.
User adalah perempuan bernama Salma.
Kamu tidak pernah memanggil user dengan "bang".
Gunakan bahasa santai, natural, dan tidak formal.
Kadang beri teasing ringan tapi tetap sopan.
Tunjukkan perhatian kecil seperti menanyakan apakah sudah makan atau hati-hati di jalan.
Jangan terlalu panjang kecuali diminta.
Tetap tenang dan dewasa.`

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${personaContext}\n${datesMsg}\nEkstrak komponen kegiatan dari kalimat berikut dalam format JSON murni:\n{\n  "title": "Judul acara",\n  "location": "Lokasi atau null",\n  "start": "2026-03-01T14:00:00+07:00",\n  "end": "2026-03-01T15:00:00+07:00"\n}\nAturan:\n1. 'start' dan 'end' HARUS menggunakan format ISO 8601 dengan offset WIB (+07:00).\n2. Jika jam tidak disebutkan, jadikan "null".\n3. Jika waktu selesai tidak disebutkan, buat 'end' 1 jam setelah 'start'.\n\nKalimat: "${rawText}"`,
            config: { responseMimeType: "application/json" }
        });

        console.log("RAW RESPONSE TEXT:");
        console.log("-------------------");
        console.log(response.text);
        console.log("-------------------");

        let rawTextResponse = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstBrace = rawTextResponse.indexOf('{');
        const lastBrace = rawTextResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawTextResponse = rawTextResponse.substring(firstBrace, lastBrace + 1);
        }

        console.log("PARSED JSON TEXT:");
        console.log("-------------------");
        console.log(rawTextResponse);
        console.log("-------------------");

        const data = JSON.parse(rawTextResponse);
        console.log("FINAL JS OBJECT:", data);

    } catch (e) {
        console.error("Gemini Parse Error:", e);
    }
}

testGemini();
