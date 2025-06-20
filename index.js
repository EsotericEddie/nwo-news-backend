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

    const rewrittenArticles = sampleArticles.map((article) => ({
      id: article.id,
      title: article.title,
      source: article.source,
      rewritten: `Rewritten: ${article.original}`, // TEMP: Replace with GPT rewrite if needed
    }));

    res.json(rewrittenArticles);
  } catch (err) {
    console.error("Error serving /news:", err);
    res.status(500).json({ error: "Failed to get news." });
  }
});
