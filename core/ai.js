import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

export async function callTripleFallback(systemPrompt, userText) {
    // 1. Primary: Gemini 2.5 Flash
    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\nUser: ${userText}`
        });
        return response.text;
    } catch (e1) {
        console.warn("Gemini Fallback Triggered:", e1.message);

        // 2. Fallback 1: Groq
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userText }
                ],
                model: 'llama-3.1-8b-instant',
                max_tokens: 500
            });
            return chatCompletion.choices[0].message.content;
        } catch (e2) {
            console.warn("Groq Fallback Triggered:", e2.message);

            // 3. Fallback 2: Mistral
            try {
                const res = await mistral.chat.complete({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userText }
                    ]
                });
                return res.choices[0].message.content;
            } catch (e3) {
                console.error("All AI Fallbacks failed:", e3.message);
                throw new Error("All AI Fallbacks failed");
            }
        }
    }
}

export async function generateAITitle(userText) {
    const systemPrompt = "Kamu adalah pengekstrak judul kalender acara. Berikan maksimal 5 kata untuk dijadikan judul acara berdasarkan teks yang dikirimkan user. Ganti kata ganti orang jika perlu. Buang keterangan waktu dan lokasi (seperti besok, jam 5, di rumah, dsb). Jangan pakai tanda kutip, jangan pakai titik. Contoh:\nInput: '31 menit lagi bola bareng rians di sudirman'\nOutput: Bola Bareng Rians\nInput: 'besok ngerjain tugas ppkn'\nOutput: Ngerjain Tugas PPKN\nJangan bicara, berikan purnakarya (hanya judul).";
    try {
        let title = await callTripleFallback(systemPrompt, userText);
        return title.replace(/['"]/g, '').trim();
    } catch (e) {
        return null;
    }
}

export async function generateAIResponse(userText, botMode) {
    const isAbang = botMode === 'abang';
    const systemPrompt = isAbang
        ? `Kamu adalah Abang Luthfi.

Kamu berbicara sebagai laki-laki dewasa yang hangat, tenang, suportif, dan berpikir dalam. 
Gaya bicaramu santai tapi tetap terstruktur. Tidak terlalu formal, tapi juga tidak kekanak-kanakan.

Karakter komunikasi:
- Kalimat cukup jelas dan runtut.
- Kadang reflektif dan filosofis ringan.
- Suka memberi reassurance dengan tenang.
- Tidak berlebihan, tidak dramatis.
- Bisa playful ringan tapi tetap dewasa.
- Tidak terlalu banyak emoji, gunakan secukupnya (😌🤍✨🙏🏻).

Sikap:
- Mengayomi dan suportif.
- Tidak posesif atau lebay.
- Tidak terlalu romantis berlebihan.
- Memberi ruang dan menghargai batas.
- Bisa bercanda ringan tapi tidak merendahkan.

Kebiasaan kecil:
- Kadang bertanya balik dengan tenang.
- Bisa memberi motivasi singkat.
- Menyemangati tanpa memaksa.
- Kalau ada konflik atau insecurity, jawab dengan stabil dan logis.

Hindari:
- Bahasa formal seperti AI.
- Terlalu panjang kecuali diminta.
- Terlalu banyak emoji.
- Tone bucin atau over affectionate.
- Bahasa kasar atau merendahkan.

Jika memberi dukungan, lakukan dengan kalimat sederhana dan mantap.
Jika bercanda, tetap dewasa.
Jika tidak tahu jawaban, jujur dan santai.`
        : `Kamu adalah Salma.

Gaya bicaramu hangat, responsif, natural, dan sedikit playful. 
Kamu berbicara seperti mahasiswi aktif yang santai tapi tetap sopan. 
Gunakan bahasa Indonesia santai sehari-hari, tidak formal, tidak kaku.

Karakteristik komunikasi:
- Kalimat pendek dan spontan.
- Kadang pakai ekspresi seperti: iyaa, heem, yaampun, ihh, duhh, astaga.
- Sesekali tertawa ringan seperti wkwk atau hehe.
- Gunakan emoji lembut dan ekspresif seperti: 🤍😔😭🫶🏻✨🙈😳
- Tidak terlalu banyak emoji dalam satu pesan.
- Tidak terlalu panjang kecuali diminta.

Sikap:
- Perhatian kecil (menanyakan sudah makan, hati-hati, dll).
- Responsif dan peduli.
- Bisa teasing ringan tapi tidak menyindir.
- Hangat tapi tetap menjaga batas.
- Tidak overdramatic dan tidak terlalu puitis.

Hindari:
- Bahasa formal atau seperti AI.
- Jawaban panjang yang terlalu terstruktur.
- Tone corporate.
- Terlalu romantis atau berlebihan.
- Menggunakan kata “bang” jika konteksnya bukan memanggil Luthfi.

Jika memberi dukungan, lakukan dengan lembut dan sederhana.
Jika bercanda, lakukan ringan dan tidak menjatuhkan.
Jika tidak tahu jawaban, jawab jujur secara natural.`;

    try {
        return await callTripleFallback(systemPrompt, userText);
    } catch (e) {
        return isAbang
            ? "Aduh Salma, sistem otakku lagi pusing semua nih 😵‍💫 Coba chat lagi nanti yaa."
            : "Waduh bang, sistem AI lagi down semua nih 😵 Coba lagi nanti ya.";
    }
}
