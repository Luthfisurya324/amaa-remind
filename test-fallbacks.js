import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import * as dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function testFallbacks() {
    console.log("TESTING GROQ FALLBACK 1...");
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: "Kamu Abang Lupi." },
                { role: 'user', content: "Bang, apa kabar hari ini?" }
            ],
            model: 'llama3-8b-8192',
            max_tokens: 100
        });
        console.log("✅ Groq Success:", chatCompletion.choices[0].message.content);
    } catch (e) {
        console.error("❌ Groq Failed:", e.message);
    }

    console.log("\nTESTING MISTRAL FALLBACK 2...");
    try {
        const res = await mistral.chat.complete({
            model: 'mistral-small-latest',
            messages: [
                { role: 'system', content: "Kamu Abang Lupi." },
                { role: 'user', content: "Bang, apa kabar hari ini?" }
            ]
        });
        console.log("✅ Mistral Success:", res.choices[0].message.content);
    } catch (e) {
        console.error("❌ Mistral Failed:", e.message);
    }
}

testFallbacks();
