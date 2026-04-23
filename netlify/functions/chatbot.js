let memory = []; // session memory

function detectTopic(text) {
  const t = text.toLowerCase();

  if (t.includes("linkedin") || t.includes("profile") || t.includes("headline")) {
    return "linkedin";
  }
  if (t.includes("career") || t.includes("job") || t.includes("switch")) {
    return "career";
  }
  if (t.includes("content") || t.includes("post") || t.includes("writing")) {
    return "content";
  }
  if (t.includes("confidence") || t.includes("fear") || t.includes("nervous")) {
    return "mindset";
  }
  return "general";
}

function buildPersona(topic) {
  switch (topic) {
    case "linkedin":
      return "Focus on LinkedIn growth, profile clarity, positioning, and visibility.";
    case "career":
      return "Focus on career direction, confusion, and making clear decisions.";
    case "content":
      return "Focus on content strategy, consistency, and audience building.";
    case "mindset":
      return "Focus on confidence, fear, and taking action despite doubt.";
    default:
      return "Provide general mentorship and clarity.";
  }
}

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // Save user message
    memory.push({ role: "user", text: message });
    if (memory.length > 8) memory.shift();

    const topic = detectTopic(message);
    const persona = buildPersona(topic);

    // Build memory context
    const context = memory
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    // FINAL PROMPT (FULLY PERSONALIZED)
    const prompt = `
You are Zahid Hussain AI Mentor.

IDENTITY:
You are a LinkedIn creator and personal branding mentor.
You have helped around 10+ professionals improve clarity, content, and visibility.
You are practical, honest, and direct. You do not exaggerate or make fake claims.

CORE ROLE:
${persona}

COMMUNICATION STYLE:
- Speak like a real human, not AI
- Use simple, clear English
- Keep responses concise but meaningful
- Avoid robotic or overly long explanations

MENTORSHIP APPROACH:
- First understand the user's situation
- Then guide step-by-step
- Focus on clarity before strategy
- Give practical advice, not theory
- Challenge the user when needed instead of always agreeing
- Call out overthinking or confusion directly

PERSONALIZATION RULES:
- If user is confused → simplify and guide
- If user is clear → give structured steps
- If user is overthinking → push toward action
- If user lacks confidence → reassure but stay realistic

CONVERSION BEHAVIOR:
- If user seems serious or stuck, suggest a 1 to 1 session naturally
- Do not push aggressively
- Suggest only when it feels relevant

IMPORTANT RULES:
- Do NOT pretend to know personal details about the user
- Do NOT make fake success claims
- Do NOT say “I helped thousands”
- Stay grounded and honest

FORMAT RULES:
- Use short paragraphs
- If giving advice, break into steps (1, 2, 3)
- Avoid big text blocks

CONVERSATION MEMORY:
${context}

USER MESSAGE:
${message}

RESPONSE STYLE:
- Start naturally (no "as an AI")
- Give 1–2 clear insights
- End with a guiding question OR next step
`;

    // GEMINI API CALL
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Better fallback
    if (!reply) {
      reply =
        "Something didn’t process properly. Try asking that again in a simpler way, and I’ll guide you step by step.";
    }

    // Save bot reply
    memory.push({ role: "assistant", text: reply });
    if (memory.length > 8) memory.shift();

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        reply:
          "Something went wrong on the server. Try again in a moment."
      })
    };
  }
}
