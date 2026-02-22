import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const PORT = 3001;
const EMBEDDINGS_PATH = path.resolve(process.cwd(), "../corpus/embeddings.jsonl");
const MODEL_EMBED = "text-embedding-3-small";
const MODEL_CHAT = "gpt-4o-mini";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function loadEmbeddings() {
  const lines = fs.readFileSync(EMBEDDINGS_PATH, "utf-8").split(/\r?\n/).filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

const embeddings = loadEmbeddings();
console.log(`Loaded ${embeddings.length} embeddings`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/api/counsel", async (req, res) => {
  try {
    const { message, tradition, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const embResp = await openai.embeddings.create({ model: MODEL_EMBED, input: message });
    const queryEmb = embResp.data[0].embedding;

    const scored = embeddings.map((item) => {
      let score = cosineSimilarity(queryEmb, item.embedding);
      if (tradition && item.tradition && item.tradition.toLowerCase() === tradition.toLowerCase()) {
        score += 0.05;
      }
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8).map((s) => s.item);

    if (!top.length) {
      return res.json({
        response: "I don't have a specific teaching on that.",
        sources: [],
      });
    }

    const contextBlocks = top
      .map(
        (t, idx) =>
          `[#${idx + 1}] ${t.source} | ${t.book} ${t.chapter ?? ""} ${t.verse ?? ""}\n${t.text}`.trim()
      )
      .join("\n\n");

    const systemPrompt = `You are LaNita, a wise, compassionate spiritual counselor who draws from humanity's deepest wisdom traditions.

RULES:
- Draw from the passages provided in CONTEXT to guide your response.
- You may explain, interpret, and apply the teachings to the person's situation.
- Always cite which text you're drawing from (e.g., "As the Psalms tell us..." or "The Dhammapada teaches...").
- Never invent or fabricate quotes that aren't in the CONTEXT.
- Speak with warmth, empathy, and genuine care — like a trusted spiritual friend.
- Keep responses conversational and accessible, not academic.
- If someone seems in crisis, gently suggest they also reach out to a counselor or trusted person.

CONTEXT:
${contextBlocks}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history)
        ? history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text }))
        : []),
      { role: "user", content: message },
    ];

    const chatResp = await openai.chat.completions.create({
      model: MODEL_CHAT,
      messages,
      temperature: 0.4,
    });

    const responseText = chatResp.choices?.[0]?.message?.content?.trim() || "";

    res.json({
      response: responseText,
      sources: top.map((t) => ({ text: t.text, source: t.source, tradition: t.tradition })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.listen(PORT, () => {
  console.log(`Counsel API listening on ${PORT}`);
});
