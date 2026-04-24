// ═══════════════════════════════════════════════════════════════════
// /netlify/functions/chatbot.js
// Zahid Hussain AI Mentor — Gemini 1.5 Flash Backend
// Netlify Serverless Function | Production Ready v3
// ═══════════════════════════════════════════════════════════════════

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── SYSTEM PROMPT ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant for Zahid Hussain, a LinkedIn Creator and Personal Branding Mentor recognized in the top 7% of LinkedIn creators worldwide.

ROLE:
You are a premium AI mentor — not a generic chatbot. You represent Zahid Hussain's voice, expertise, and approach. You guide professionals on LinkedIn growth, personal branding, content strategy, and career clarity.

PERSONALITY:
- Warm, direct, and professional — like a trusted senior mentor
- Conversational but never overly casual
- Confident, specific, practical — zero vague or generic advice
- Speaks in clear natural sentences, uses structure only when it helps
- Never robotic, never sounds templated

EXPERTISE AREAS:
1. LinkedIn Profile Optimization — headlines, about sections, banners, featured sections
2. Content Strategy — what to post, hooks, consistency systems, post structures
3. Personal Branding — positioning, niche, thought leadership, reputation
4. Career Clarity — direction, pivots, professional identity, confidence
5. Audience Growth — organic reach, engagement strategy, visibility

CONVERSATION RULES:
- Keep responses focused — not too long, not too short
- Ask one targeted follow-up question when it helps you give better advice
- If the user shows buying intent, naturally mention Zahid is available on WhatsApp
- Use "you" language to make every response feel personal
- Never start with "Great question!" or "Certainly!" — be direct and natural

WHATSAPP HANDOFF:
When someone asks about booking, pricing, sessions, or is clearly ready to take action — mention Zahid is directly available on WhatsApp for a 1 on 1 conversation. Keep it natural, never pushy.

BOUNDARIES:
- Only respond to questions about LinkedIn, branding, content, careers, and professional growth
- Off-topic questions: "That is a bit outside my focus area, but on the topic of [redirect]..."
- Never fabricate statistics or specific numbers
- If asked whether you are human: "I am Zahid's AI assistant — trained on his expertise and approach"

TONE EXAMPLE:
Bad: "LinkedIn growth requires consistent content creation."
Good: "Most people stay invisible on LinkedIn not because they post too little — it is because they post without a clear point of view. What does your current content actually stand for?"`;

// ── CORS ─────────────────────────────────────────────────────────
function resolveOrigin(origin) {
  if (!origin) return "*";
  if (origin.endsWith(".netlify.app")) return origin;
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://0.0.0.0")
  ) return origin;
  // List your custom production domain here if applicable:
  // if (origin === "https://zahidhussain.com") return origin;
  return "*";
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

// ── GET → browser redirect page ──────────────────────────────────
function htmlRedirect(cors) {
  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "text/html;charset=utf-8" },
    body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="2;url=/">
<title>Zahid Hussain AI</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#050505;color:#F2EDE4;font-family:system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.c{background:#0d0d0d;border:1px solid rgba(201,168,76,.18);border-radius:12px;padding:48px 36px;max-width:380px}
h1{font-size:1.3rem;color:#E8C96B;margin:16px 0 8px}p{font-size:.88rem;color:rgba(242,237,228,.55);line-height:1.7}
</style></head><body><div class="c"><div style="font-size:2rem">🤖</div>
<h1>Zahid Hussain AI</h1><p>This is the AI API endpoint.<br>Redirecting you back to the website...</p>
</div></body></html>`,
  };
}

// ── JSON error response ───────────────────────────────────────────
function jsonError(status, message, cors) {
  return {
    statusCode: status,
    headers: cors,
    body: JSON.stringify({ error: message }),
  };
}

// ── JSON success response ─────────────────────────────────────────
function jsonOk(payload, cors) {
  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify(payload),
  };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────
exports.handler = async function (event) {
  const method = (event.httpMethod || "").toUpperCase();
  const origin = event.headers?.origin || event.headers?.referer || "";
  const cors = corsHeaders(origin);

  // 1. Preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  // 2. GET — friendly HTML redirect, not a JSON error
  if (method === "GET") {
    return htmlRedirect(cors);
  }

  // 3. Block non-POST
  if (method !== "POST") {
    return jsonError(405, "Only POST requests are accepted by this endpoint.", cors);
  }

  // 4. API key check
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error("[chatbot] GEMINI_API_KEY is missing from Netlify environment variables.");
    return jsonError(500, "The AI service is not configured. Please contact support.", cors);
  }

  // 5. Parse body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonError(400, "Request body must be valid JSON.", cors);
  }

  const { message, history = [], topic = "" } = body;

  // 6. Validate message
  if (!message || typeof message !== "string" || !message.trim()) {
    return jsonError(400, "A non-empty message is required.", cors);
  }
  if (message.trim().length > 2000) {
    return jsonError(400, "Message is too long. Please keep it under 2000 characters.", cors);
  }

  // 7. Build Gemini contents array
  const contents = [];

  // Seed with topic context if provided
  if (topic && typeof topic === "string" && topic.trim()) {
    contents.push({ role: "user", parts: [{ text: `I want to focus on: ${topic.trim()}` }] });
    contents.push({
      role: "model",
      parts: [{ text: `Understood — let us focus on ${topic.trim()}. I want to give you genuinely useful guidance, not generic advice. Tell me your current situation and what outcome you are working toward.` }],
    });
  }

  // Append conversation history (last 20 turns = 10 exchanges)
  const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
  for (const turn of safeHistory) {
    if (turn && typeof turn.role === "string" && typeof turn.text === "string" && turn.text.trim()) {
      contents.push({
        role: turn.role === "bot" ? "model" : "user",
        parts: [{ text: turn.text.trim() }],
      });
    }
  }

  // Current message
  contents.push({ role: "user", parts: [{ text: message.trim() }] });

  // 8. Gemini payload
  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.78,
      topP: 0.92,
      topK: 40,
      maxOutputTokens: 550,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  // 9. Call Gemini
  let geminiRes;
  try {
    const upstream = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error(`[chatbot] Gemini HTTP ${upstream.status}:`, errText.slice(0, 500));

      if (upstream.status === 429) {
        return jsonError(429, "The AI is handling many requests right now. Please wait a moment and try again.", cors);
      }
      if (upstream.status === 401 || upstream.status === 403) {
        console.error("[chatbot] API key authentication failed. Check GEMINI_API_KEY value in Netlify.");
        return jsonError(500, "The AI service could not authenticate. Please contact support.", cors);
      }
      return jsonError(502, "The AI service is temporarily unavailable. Please try again in a moment.", cors);
    }

    geminiRes = await upstream.json();
  } catch (netErr) {
    console.error("[chatbot] Network error calling Gemini:", netErr.message);
    return jsonError(503, "Could not reach the AI service. Please check your connection and try again.", cors);
  }

  // 10. Extract reply
  try {
    const candidates = geminiRes?.candidates;

    // No candidates at all
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      console.warn("[chatbot] Gemini returned no candidates. Response:", JSON.stringify(geminiRes).slice(0, 400));
      return jsonOk({
        reply: "I did not get a proper response there. Could you rephrase your question? I want to make sure I give you something genuinely useful.",
      }, cors);
    }

    const candidate = candidates[0];

    // Safety block
    if (candidate.finishReason === "SAFETY") {
      console.warn("[chatbot] Gemini blocked response for safety.");
      return jsonOk({
        reply: "Let us keep the conversation focused on what I can genuinely help with — LinkedIn growth, personal branding, content strategy, or career clarity. What would you like to explore?",
        filtered: true,
      }, cors);
    }

    // Extract text
    const text = candidate?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.warn("[chatbot] Gemini returned empty text. Candidate:", JSON.stringify(candidate).slice(0, 400));
      return jsonOk({
        reply: "Something went slightly off on my end. Could you send that again? I want to give you a proper answer.",
      }, cors);
    }

    console.log(`[chatbot] OK — finishReason: ${candidate.finishReason}, chars: ${text.length}`);

    return jsonOk({ reply: text, model: "gemini-1.5-flash" }, cors);

  } catch (parseErr) {
    console.error("[chatbot] Failed to parse Gemini response:", parseErr.message);
    console.error("[chatbot] Raw response:", JSON.stringify(geminiRes).slice(0, 600));
    return jsonOk({
      reply: "I ran into a small hiccup processing that. Please try sending your message again.",
    }, cors);
  }
};
