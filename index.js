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

// ===== NEW GET ENDPOINT for FlutterFlow ListView =====
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

    // Rewrite each article using OpenAI
    const rewrittenArticles = [];

    for (const article of sampleArticles) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are rewriting news articles from independent and mainstream sources to match the tone and mission of New World Order News. Make it sound like conspiracy-literate journalism. Keep it sharp, short, and source-respectful.",
          },
          {
            role: "user",
            content: `Rewrite this article:\n${article.original}`,
          },
        ],
      });

      rewrittenArticles.push({
        id: article.id,
        title: article.title,
        source: article.source,
        rewritten: completion.choices[0].message.content,
      });
    }

    res.json(rewrittenArticles);
  } catch (err) {
    console.error("Error generating rewritten news:", err);
    res.status(500).json({ error: "Failed to fetch rewritten news." });
  }
});

// ===== Original POST /chat endpoint =====
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
