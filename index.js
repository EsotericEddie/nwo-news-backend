app.get("/news", async (req, res) => {
  const sampleArticles = [
    {
      id: 1,
      title: "Klaus Schwab urges digital ID adoption by 2030",
      source: "Infowars",
      original: "Klaus Schwab gave a speech urging global cooperation...",
    },
    {
      id: 2,
      title: "World Bank pilots social credit score framework",
      source: "ZeroHedge",
      original: "The World Bank announced a new pilot program...",
    },
  ];

  const rewrittenArticles = sampleArticles.map((article) => ({
    id: article.id,
    title: article.title,
    source: article.source,
    rewritten: `Rewritten: ${article.original}`,
  }));

  res.json(rewrittenArticles);
});
