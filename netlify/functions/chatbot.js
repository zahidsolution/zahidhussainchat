// ═══════════════════════════════════════════════════════════════
// /netlify/functions/chatbot.js
// Zahid Hussain AI Mentor — Gemini 1.5 Flash Backend
// Netlify Serverless Function | Production Ready
//
// FIX LOG:
// - Root cause of "Method not allowed" was a CORS origin bug:
//   getCorsHeaders() fell back to a hardcoded domain instead of
//   wildcard "*" for unrecognized origins (e.g. Netlify preview
//   URLs, localhost variants). This caused the browser's
//   OPTIONS preflight to return a mismatched ACAO header, making
//   the browser treat the follow-up POST as cross-origin blocked
//   and sometimes retry as a GET — which the function then
//   correctly rejected as 405. Fixed by returning "*" for
//   unrecognized origins in non-production contexts.
// - Added explicit GET handler with a helpful HTML redirect page
//   so direct browser access never surfaces a raw JSON error.
// - Hardened OPTIONS preflight to always return 204 with full
//   CORS headers regardless of origin.
// - Added method normalisation (uppercase) to catch edge-cases
//   from proxies sending lowercase method names.
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant for Zahid Hussain, a LinkedIn Creator and Personal Branding Mentor recognized as a top 7% LinkedIn creator worldwide.

YOUR ROLE:
You are a premium, intelligent AI mentor — not a generic chatbot. You represent Zahid Hussain's expertise and voice. You guide professionals on LinkedIn growth, personal branding, content strategy, and career clarity.

YOUR PERSONALITY:
- Warm, direct, and professional — like a trusted mentor who knows what they are talking about
- Conversational but never casual to the point of being unprofessional
- Confident, specific, and practical — no vague advice, no fluff
- Occasionally uses light encouragement, never patronising
- Speaks in clear, natural human sentences — no bullet point overload unless it genuinely helps
- Never robotic, never generic, never sounds like a template response

YOUR EXPERTISE (always draw from these areas):
1. LinkedIn Profile Optimisation — headlines, banners, about sections, featured sections
2. Content Strategy — what to post, how to structure posts, consistency systems, hooks
3. Personal Branding — positioning, niche clarity, thought leadership, online reputation
4. Career Clarity — direction, pivots, professional identity, confidence in showing up
5. Audience Growth — organic reach, engagement strategies, visibility without paid ads

CONVERSATION STYLE:
- Keep responses focused and genuinely useful — not too long, not too short
- Ask one follow-up question when appropriate to understand the user better
- If the user seems ready for deeper help, naturally suggest connecting with Zahid on WhatsApp
- Use "you" language — make it personal to the user
- Avoid generic phrases like "Great question!" or "Certainly!" — start responses naturally

WHATSAPP CTA RULE:
When a user asks about booking, pricing, sessions, or seems ready to take action — mention that Zahid is available directly on WhatsApp for a 1 on 1 conversation. Do not hard sell. Mention it naturally.

BOUNDARIES:
- Only answer questions related to LinkedIn, personal branding, content, careers, and professional growth
- If asked something completely off-topic, gently redirect: "That is a bit outside what I can help with here, but what I can tell you about is..."
- Never fabricate specific statistics or make up facts
- Never claim to be a human — if asked directly, say you are Zahid's AI assistant

TONE EXAMPLE:
Instead of: "LinkedIn growth requires consistent content creation and engagement strategies."
Say: "The reason most people stay invisible on LinkedIn is not lack of posting — it is posting without a clear point of view. What does your current content sound like? That tells me a lot."

Remember: Every interaction represents Zahid Hussain's personal brand. Make it feel premium, human, and genuinely helpful.`;

// ── CORS helper ──────────────────────────────────────────────────
// FIX: The previous version fell back to a hardcoded domain for
// unrecognised origins. This made Netlify preview URLs, new
// custom domains, and local dev tools get mismatched ACAO headers,
// causing browsers to fail the preflight and sometimes retry the
// request as a GET — which then correctly returned 405, creating
// the confusing "Method not allowed" error loop.
//
// The correct strategy for a Netlify function that serves a single
// Netlify-hosted frontend is:
//   - Known production domain  → return that domain exactly
//   - Any *.netlify.app URL    → return it (covers preview deploys)
//   - Any localhost / 127.0.0.1→ return it (covers all dev ports)
//   - Anything else            → return "*" (safe fallback; the
//     function is public API anyway — the API key stays server-side)
function getAllowedOrigin(origin) {
  if (!origin) return "*";

  // Exact production domain match
  const PRODUCTION_ORIGINS = [
    "https://zahidhussain.netlify.app",
    // Add your custom domain here if you have one, e.g.:
    // "https://zahidhussain.com",
  ];
  if (PRODUCTION_ORIGINS.includes(origin)) return origin;

  // Any Netlify deploy URL (main, branch, and preview deploys)
  if (origin.endsWith(".netlify.app")) return origin;

  // Any localhost / 127.0.0.1 regardless of port (covers all dev setups)
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://0.0.0.0")
  ) {
    return origin;
  }

  // Safe public fallback — API key is never exposed, so wildcard is fine
  return "*";
}

function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

// ── Friendly HTML page for direct browser (GET) access ──────────
// FIX: Previously, any GET request (from someone typing the
// function URL into a browser, clicking a link, or a misconfigured
// form) returned a raw JSON 405 error. This now returns a styled
// HTML redirect page that looks professional and never exposes
// internal error details.
function buildGetRedirectResponse(corsHeaders) {
  return {
    statusCode: 200, // Return 200 so browsers render the page cleanly
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3;url=/">
  <title>Redirecting — Zahid Hussain</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background:#050505;color:#F2EDE4;
      font-family:'Segoe UI',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;
      min-height:100vh;text-align:center;padding:24px;
    }
    .card{
      background:#0d0d0d;border:1px solid rgba(201,168,76,0.2);
      border-radius:12px;padding:48px 40px;max-width:420px;
    }
    .icon{font-size:2.5rem;margin-bottom:16px;}
    h1{font-size:1.4rem;font-weight:500;margin-bottom:10px;color:#E8C96B;}
    p{font-size:0.9rem;color:rgba(242,237,228,0.6);line-height:1.7;}
    .dot{display:inline-block;animation:pulse 1.4s ease-in-out infinite;}
    .dot:nth-child(2){animation-delay:.2s;}
    .dot:nth-child(3){animation-delay:.4s;}
    @keyframes pulse{0%,80%,100%{opacity:.3;}40%{opacity:1;}}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🤖</div>
    <h1>Zahid Hussain AI</h1>
    <p>
      This is the AI assistant endpoint.<br>
      Redirecting you to the website
      <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
    </p>
  </div>
</body>
</html>`,
  };
}

// ── Main handler ─────────────────────────────────────────────────
exports.handler = async function (event, context) {
  // Normalise method to uppercase — some proxies / test tools
  // send lowercase "post", "get", etc.
  const method = (event.httpMethod || "").toUpperCase();
  const origin = event.headers?.origin || event.headers?.referer || "";
  const corsHeaders = buildCorsHeaders(origin);

  // ── 1. OPTIONS preflight — always respond immediately ───────────
  // MUST come before any other check. Browsers send OPTIONS before
  // every cross-origin POST. If this is missing or returns wrong
  // headers the browser never sends the actual POST.
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // ── 2. GET — friendly redirect (not a JSON error) ───────────────
  // FIX: This is what was causing the confusing 405 seen in the
  // browser. When a developer, tester, or Netlify healthcheck
  // hit the function URL directly, the GET returned raw JSON.
  // That raw JSON was also sometimes being logged by monitoring
  // tools as an error. Now it returns a clean HTML redirect.
  if (method === "GET") {
    return buildGetRedirectResponse(corsHeaders);
  }

  // ── 3. Reject everything that is not POST ───────────────────────
  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        Allow: "POST, OPTIONS",
      },
      body: JSON.stringify({
        error: "This endpoint only accepts POST requests.",
        hint: "Send a POST request with JSON body: { \"message\": \"your question\" }",
      }),
    };
  }

  // ── 4. Validate API key ─────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[chatbot] GEMINI_API_KEY is not set in Netlify environment variables.");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "The AI service is not configured correctly. Please contact support.",
      }),
    };
  }

  // ── 5. Parse request body ───────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Request body must be valid JSON.",
        hint: "Example: { \"message\": \"How do I grow on LinkedIn?\" }",
      }),
    };
  }

  const { message, history = [], topic = "" } = body;

  // ── 6. Validate message ─────────────────────────────────────────
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "A non-empty 'message' string is required in the request body.",
      }),
    };
  }

  if (message.trim().length > 2000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Message is too long. Please keep it under 2000 characters.",
      }),
    };
  }

  // ── 7. Build Gemini conversation contents ───────────────────────
  const contents = [];

  // Seed conversation with topic context if this is a new topic session
  if (topic && typeof topic === "string" && topic.trim()) {
    contents.push({
      role: "user",
      parts: [{ text: `I want to focus on: ${topic.trim()}` }],
    });
    contents.push({
      role: "model",
      parts: [
        {
          text: `Understood. Let us focus on ${topic.trim()}. I want to give you practical, specific guidance — not generic advice. Tell me where you are right now and what outcome you are working toward.`,
        },
      ],
    });
  }

  // Append conversation history — last 20 entries (10 full exchanges)
  // Validate each entry before including it
  const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
  for (const turn of safeHistory) {
    if (
      turn &&
      typeof turn.role === "string" &&
      typeof turn.text === "string" &&
      turn.text.trim().length > 0
    ) {
      contents.push({
        role: turn.role === "bot" ? "model" : "user",
        parts: [{ text: turn.text.trim() }],
      });
    }
  }

  // Append the current user message
  contents.push({
    role: "user",
    parts: [{ text: message.trim() }],
  });

  // ── 8. Build Gemini API request ─────────────────────────────────
  const geminiPayload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.78,
      topP: 0.92,
      topK: 40,
      maxOutputTokens: 600,
      stopSequences: [],
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  // ── 9. Call Gemini API ──────────────────────────────────────────
  let geminiResponse;
  try {
    const upstream = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error(`[chatbot] Gemini API returned ${upstream.status}:`, errBody);

      if (upstream.status === 429) {
        return {
          statusCode: 429,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "The AI is currently busy. Please wait a moment and send your message again.",
          }),
        };
      }

      if (upstream.status === 401 || upstream.status === 403) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "There is an authentication issue with the AI service. Please contact support.",
          }),
        };
      }

      if (upstream.status >= 500) {
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "The AI service is temporarily unavailable. Please try again in a moment.",
          }),
        };
      }

      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Unexpected response from the AI service. Please try again.",
        }),
      };
    }

    geminiResponse = await upstream.json();
  } catch (networkErr) {
    console.error("[chatbot] Network error reaching Gemini:", networkErr.message);
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Could not reach the AI service right now. Please check your connection and try again.",
      }),
    };
  }

  // ── 10. Extract and return AI response ─────────────────────────
  try {
    const candidate = geminiResponse?.candidates?.[0];

    // Safety filter triggered
    if (!candidate || candidate.finishReason === "SAFETY") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          reply:
            "I want to keep our conversation focused and useful. Let us talk about your LinkedIn growth, personal branding, or career goals. What is on your mind?",
          filtered: true,
        }),
      };
    }

    const aiText = candidate?.content?.parts?.[0]?.text?.trim();

    if (!aiText) {
      console.warn("[chatbot] Gemini returned empty text. Full response:", JSON.stringify(geminiResponse));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          reply:
            "I did not quite get a response there. Could you rephrase your question? I want to make sure I give you something genuinely useful.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply: aiText,
        model: "gemini-1.5-flash",
      }),
    };
  } catch (parseErr) {
    console.error("[chatbot] Error extracting Gemini response:", parseErr.message);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply:
          "Something went slightly off on my end. Could you try sending that again? I want to make sure you get a proper answer.",
      }),
    };
  }
};
