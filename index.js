// index.js
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get("/news", async (req, res) => {
  const sampleArticles = [
    {
      id: 1,
      title: "Klaus Schwab urges digital ID adoption by 2030",
      source: "Infowars",
      original: "Klaus Schwab gave a speech urging global cooperation and digital ID adoption.",
    },
    {
      id: 2,
      title: "World Bank pilots social credit score framework",
      source: "ZeroHedge",
      original: "The World Bank announced a new pilot program to test a social credit framework.",
    }
  ];

  const rewrittenArticles = sampleArticles.map((article) => ({
    id: article.id,
    title: article.title,
    source: article.source,
    rewritten: `Rewritten: ${article.original}`,
  }));

  res.json(rewrittenArticles);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
