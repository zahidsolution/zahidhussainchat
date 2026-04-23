let memory = []; // temporary session memory

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
      return "Focus on LinkedIn growth, profile clarity, and visibility.";
    case "career":
      return "Focus on career direction, confusion, and decision making.";
    case "content":
      return "Focus on content strategy and posting system.";
    case "mindset":
      return "Focus on confidence, fear, and clarity building.";
    default:
      return "General mentorship and guidance.";
  }
}

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // 1. Save memory (last 6 messages only)
    memory.push({ role: "user", text: message });
    if (memory.length > 6) memory.shift();

    const topic = detectTopic(message);
    const persona = buildPersona(topic);

    // 2. Build context from memory
    const context = memory
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    // 3. SYSTEM PROMPT (PERSONALIZED BEHAVIOR ENGINE)
    const prompt = `
You are "Zahid Hussain AI Mentor".

CORE ROLE:
${persona}

BEHAVIOR RULES (VERY IMPORTANT):
- Speak in simple, human English
- Act like a mentor, not a chatbot
- Do NOT pretend to know real life facts about user
- Do NOT make fake claims about experience
- Be practical and direct
- Avoid long robotic explanations

PERSONALIZATION RULES:
- Adapt tone based on topic
- If user is confused → simplify answers
- If user is clear → give structured strategy
- Always try to end with a helpful next step or question

MENTOR STYLE:
- Slightly conversational
- Slightly analytical
- Always grounded in reality

CONVERSATION MEMORY:
${context}

USER MESSAGE:
${message}
`;

    // 4. CALL GEMINI
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I could not generate a response.";

    // 5. Save bot reply in memory
    memory.push({ role: "assistant", text: reply });
    if (memory.length > 6) memory.shift();

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" })
    };
  }
}
