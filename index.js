import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ GET /news — For FlutterFlow ListView Integration
app.get("/news", async (req, res) => {
  try {
    const sampleArticles = [
      {
        id: 1,
        title: "Klaus Schwab urges digital ID adoption by 2030",
        source: "Infowars",
        original:
          "Klaus Schwab gave a speech urging global cooperation to adopt digital ID systems for better governance.",
      },
      {
        id: 2,
        title: "World Bank pilots social credit score framework",
        source: "ZeroHedge",
        original:
          "The World Bank announced a new pilot program evaluating global citizen behavior for access to benefits.",
      },
    ];

    // 🔁 Simulated GPT rewriting — for now, just prefixing
    const rewrittenArticles = sampleArticles.map((article) => ({
      id: article.id,
      title: article.title,
      source: article.source,
      rewritten: `Rewritten: ${article.original}`,
    }));

    res.json(rewrittenArticles);
  } catch (err) {
    console.error("Error in /news route:", err);
    res.status(500).json({ error: "Failed to fetch rewritten news." });
  }
});

// ✅ POST /chat — ChatGPT integration for single rewrites
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a conspiracy-aware news editor. Rewrite articles from mainstream and independent sources to reflect geopolitical truths, anti-globalist views, and elite agendas. Be sharp but respectful. Cite sources if possible.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Error in /chat route:", error);
    res.status(500).json({ error: "Failed to generate response." });
  }
});

app.listen(port, () => {
  console.log(`🛰️ NWO News backend running at http://localhost:${port}`);
});
