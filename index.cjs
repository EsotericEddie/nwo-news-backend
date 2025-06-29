const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // or any fetch package
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;

// Simple in-memory DB (replace with real DB)
const db = {
  military: [],
  science: [],
  politics: [],
  religion: [],
  media: [],
};

// === Utility functions ===

// Clean rewritten title to remove "Title:" prefix and asterisks
function cleanRewrittenTitle(title) {
  if (!title) return '';
  return title
    .replace(/^(\*\*|__)?\s*Title:\s*/i, '')
    .replace(/(\*\*|__)+/g, '')
    .trim();
}

// Clean rewritten content: remove repeated author lines and leftover title lines
function cleanRewrittenContent(content) {
  if (!content) return '';
  return content
    .replace(/[*_]*Authored by NWO News\s*[-—]\s*.*[\r\n]*/gi, '')
    .replace(/^(\*\*|__)?\s*Title:\s*.*[\r\n]*/i, '')
    .trim();
}

// Mock ChatGPT rewrite function
async function rewriteArticleWithChatGPT(article) {
  // Replace with your actual ChatGPT call and response parsing

  // For example purposes, pretend ChatGPT returns:
  const rewrittenHeadline = `**Title:** ${article.title} - rewritten`;
  const rewrittenContent = `Authored by NWO News — ${new Date().toISOString()}\n\n` +
    `This is a rewritten version of the article:\n\n${article.content || article.description || ''}\n\n` +
    `Authored by NWO News — ${new Date().toISOString()}`; // repeated author line intentionally here to test cleaning

  return {
    rewrittenHeadline,
    rewrittenContent,
  };
}

// Fetch articles from NewsAPI (replace YOUR_API_KEY and endpoint)
async function fetchArticlesFromNewsAPI(topic) {
  const url = `https://newsapi.org/v2/everything?q=${topic}&apiKey=YOUR_API_KEY&pageSize=20&sortBy=publishedAt`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.articles) return [];
    return data.articles.map((a, i) => ({
      id: `${topic}-${a.publishedAt}-${i}`,
      title: a.title || '',
      description: a.description || '',
      content: a.content || '',
      publishedAt: a.publishedAt || new Date().toISOString(),
      originalUrl: a.url || '',
    }));
  } catch (err) {
    console.error('NewsAPI fetch error:', err);
    return [];
  }
}

// Store articles with rewriting, cleaning, and keep max 30 days history and 10 per day
async function updateArticlesForTopic(topic) {
  console.log(`Fetching articles for topic: ${topic}`);

  const rawArticles = await fetchArticlesFromNewsAPI(topic);
  if (!rawArticles.length) {
    console.log(`No articles found for topic: ${topic}`);
    return;
  }

  // Process up to 10 new articles for today
  const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Filter already stored articles for today by date
  const todaysArticles = db[topic].filter(
    (a) => a.publishedAt.slice(0, 10) === todayDate
  );

  if (todaysArticles.length >= 10) {
    console.log(`Already have 10 or more articles for ${topic} today.`);
    return;
  }

  let addedCount = 0;

  for (const article of rawArticles) {
    if (addedCount >= 10 - todaysArticles.length) break;

    // Skip if article ID already exists (avoid duplicates)
    if (db[topic].some((a) => a.id === article.id)) continue;

    // Rewrite article via ChatGPT
    const { rewrittenHeadline, rewrittenContent } = await rewriteArticleWithChatGPT(article);

    // Clean rewritten headline/content
    const cleanHeadline = cleanRewrittenTitle(rewrittenHeadline);
    const cleanContent = cleanRewrittenContent(rewrittenContent);

    // Store cleaned article
    db[topic].push({
      id: article.id,
      title: cleanHeadline,
      rewritten: cleanContent,
      originalUrl: article.originalUrl,
      publishedAt: article.publishedAt,
    });

    addedCount++;
  }

  // Remove articles older than 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  db[topic] = db[topic].filter((a) => new Date(a.publishedAt) >= cutoffDate);

  console.log(`Stored ${addedCount} new rewritten articles for ${topic}`);
}

// Endpoint to get articles by topic with pagination for "load more"
app.get('/news/:topic', (req, res) => {
  const { topic } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;

  if (!db[topic]) return res.status(404).json({ error: 'Invalid topic' });

  // Sort articles newest first
  const sortedArticles = [...db[topic]].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  // Pagination
  const start = (page - 1) * pageSize;
  const pagedArticles = sortedArticles.slice(start, start + pageSize);

  res.json(pagedArticles);
});

// Periodically refresh all topics every hour
async function refreshAllTopics() {
  const topics = ['military', 'science', 'politics', 'religion', 'media'];
  console.log('Refreshing all topics...');
  for (const topic of topics) {
    try {
      await updateArticlesForTopic(topic);
    } catch (err) {
      console.error(`Error updating ${topic}:`, err);
    }
  }
  console.log('All topics refreshed');
}

// Refresh on startup and every hour
refreshAllTopics();
setInterval(refreshAllTopics, 1000 * 60 * 60);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
