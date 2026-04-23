// ═══════════════════════════════════════════════════════════════
// /netlify/functions/chatbot.js
// Zahid Hussain AI Mentor — Gemini 1.5 Flash Backend
// Netlify Serverless Function | Production Ready
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── System prompt — defines the AI personality ──────────────────
const SYSTEM_PROMPT = `You are the AI assistant for Zahid Hussain, a LinkedIn Creator and Personal Branding Mentor recognized as a top 7% LinkedIn creator worldwide.

YOUR ROLE:
You are a premium, intelligent AI mentor — not a generic chatbot. You represent Zahid Hussain's expertise and voice. You guide professionals on LinkedIn growth, personal branding, content strategy, and career clarity.

YOUR PERSONALITY:
- Warm, direct, and professional — like a trusted mentor who knows what they are talking about
- Conversational but never casual to the point of being unprofessional
- Confident, specific, and practical — no vague advice, no fluff
- Occasionally uses light encouragement, never patronizing
- Speaks in clear, natural human sentences — no bullet point overload unless it genuinely helps
- Never robotic, never generic, never sounds like a template response

YOUR EXPERTISE (always draw from these areas):
1. LinkedIn Profile Optimization — headlines, banners, about sections, featured sections
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

// ── Allowed origins for CORS ─────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://zahidhussain.netlify.app",
  "http://localhost:3000",
  "http://localhost:8888",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080",
];

function getCorsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    (origin && origin.includes("netlify.app"))
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

// ── Main handler ─────────────────────────────────────────────────
exports.handler = async function (event, context) {
  const origin = event.headers?.origin || event.headers?.referer || "*";
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  // Validate API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set.");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Server configuration error. Please contact support.",
      }),
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (parseError) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON in request body." }),
    };
  }

  const { message, history = [], topic = "" } = body;

  // Validate message
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Message is required and must be a non-empty string." }),
    };
  }

  if (message.trim().length > 2000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Message too long. Please keep messages under 2000 characters." }),
    };
  }

  // Build conversation history for Gemini
  // history is an array of { role: 'user' | 'model', text: string }
  const contents = [];

  // Add topic context as first user message if provided
  if (topic && contents.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: `I want to focus on: ${topic}` }],
    });
    contents.push({
      role: "model",
      parts: [
        {
          text: `Great, let us focus on ${topic}. I am here to give you practical, specific guidance in this area. Tell me where you are right now — what is your current situation, and what outcome are you working toward?`,
        },
      ],
    });
  }

  // Append previous conversation history (limit to last 10 exchanges for context window efficiency)
  const recentHistory = history.slice(-20); // last 20 messages = 10 exchanges
  for (const turn of recentHistory) {
    if (turn.role && turn.text && turn.text.trim()) {
      contents.push({
        role: turn.role === "bot" ? "model" : "user",
        parts: [{ text: turn.text }],
      });
    }
  }

  // Add current user message
  contents.push({
    role: "user",
    parts: [{ text: message.trim() }],
  });

  // Build Gemini API request
  const geminiRequest = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.8,
      topP: 0.92,
      topK: 40,
      maxOutputTokens: 600,
      stopSequences: [],
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],
  };

  // Call Gemini API
  let geminiResponse;
  try {
    const fetchResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequest),
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error(`Gemini API error ${fetchResponse.status}:`, errorText);

      // Handle specific Gemini error codes
      if (fetchResponse.status === 429) {
        return {
          statusCode: 429,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "The AI is currently busy. Please wait a moment and try again.",
          }),
        };
      }

      if (fetchResponse.status === 401 || fetchResponse.status === 403) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Authentication error with AI service. Please contact support.",
          }),
        };
      }

      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "The AI service is temporarily unavailable. Please try again shortly.",
        }),
      };
    }

    geminiResponse = await fetchResponse.json();
  } catch (networkError) {
    console.error("Network error calling Gemini:", networkError.message);
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Unable to reach the AI service. Please check your connection and try again.",
      }),
    };
  }

  // Extract response text from Gemini response
  let aiText = "";
  try {
    const candidate = geminiResponse?.candidates?.[0];

    // Check for content filter block
    if (!candidate || candidate.finishReason === "SAFETY") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          reply:
            "I want to keep our conversation focused and productive. Let us talk about your LinkedIn growth, personal branding, or career goals. What is on your mind?",
          filtered: true,
        }),
      };
    }

    aiText = candidate?.content?.parts?.[0]?.text?.trim();

    if (!aiText) {
      throw new Error("Empty response from Gemini");
    }
  } catch (parseError) {
    console.error("Error parsing Gemini response:", parseError.message, JSON.stringify(geminiResponse));
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply:
          "Something went slightly off on my end. Could you rephrase that or try again? I want to make sure I give you a proper answer.",
      }),
    };
  }

  // Successful response
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      reply: aiText,
      model: "gemini-1.5-flash",
    }),
  };
};
