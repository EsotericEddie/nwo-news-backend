import express from 'express';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const TOPICS = ['military', 'science', 'politics', 'religion', 'media'];

if (!OPENAI_API_KEY || !NEWS_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY or NEWS_API_KEY in environment variables.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let rewrittenArticles = {
  military: [],
  science: [],
  politics: [],
  religion: [],
  media: [],
};

async function fetchBreakingNews(topic) {
  const url = `https://newsapi.org/v2/top-headlines?q=${topic}&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  try {
    const response = await axios.get(url);
    console.log(`✅ NewsAPI returned ${response.data.articles.length} for topic: ${topic}`);
    return response.data.articles;
  } catch (e) {
    console.error(`NewsAPI fetch error for topic ${topic}:`, e.response?.data || e.message);
    return [];
  }
}

async function rewriteArticleWithGPT(article) {
  const prompt = `
You are an investigative journalist at a conspiratorial news outlet called "NWO News".

Rewrite the following article in a professional, journalistic tone with a conspiratorial perspective. Include:

1. A compelling, provocative headline.
2. A byline: "Author: NWO News"
3. A timestamp: today's date in long format (e.g., June 27, 2025)
4. A rewritten full-body article that:
   - Feels legitimate and journalistic
   - Uses critical thinking, hidden agendas, and skepticism of elite power structures
   - Does NOT sound like satire — but like serious alt-journalism
5. End with a list of cited sources (in bullet format), using the article's source name and URL.

Here is the original article:

Title: ${article.title}
Content: ${article.content || article.description || article.title}
Source: ${article.source.name}
Published at: ${article.publishedAt}
URL: ${article.url}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });

    const rewritten = completion.choices[0].message.content.trim();

    return {
      id: article.url,
      title: article.title,
      source: article.source.name,
      originalUrl: article.url,
      publishedAt: new Date().toISOString(),
      rewritten,
    };
  } catch (e) {
    console.error('OpenAI rewrite error:', e.response?.data || e.message);
    return null;
  }
}

async function refreshArticles() {
  console.log('🔄 Refreshing articles...');
  for (const topic of TOPICS) {
    const rawArticles = await fetchBreakingNews(topic);
    const rewrittenList = [];

    for (const art of rawArticles) {
      const rewritten = await rewriteArticleWithGPT(art);
      if (rewritten) rewrittenList.push(rewritten);
      if (rewrittenList.length >= 10) break;
    }

    rewrittenArticles[topic] = rewrittenList;
    console.log(`📝 Stored ${rewrittenList.length} rewritten for ${topic}`);
  }
  console.log('✅ All topics refreshed');
}

// Schedule refreshes:
// At 7 AM PST daily (adjust to UTC if needed)
cron.schedule('0 14 * * *', refreshArticles);  // 7 AM PST = 14:00 UTC

// Refresh every hour for breaking news
cron.schedule('0 * * * *', async () => {
  console.log('🕒 Hourly breaking news refresh...');
  for (const topic of TOPICS) {
    // Fetch raw articles for breaking news, e.g. top 3 only
    const rawArticles = await fetchBreakingNews(topic);
    if (rawArticles.length === 0) continue;
    // We'll rewrite only those that are new (not already in rewrittenArticles)
    const existingUrls = new Set(rewrittenArticles[topic].map((a) => a.id));
    const newArticles = rawArticles.filter((a) => !existingUrls.has(a.url)).slice(0, 3);
    const rewrittenList = [...rewrittenArticles[topic]];

    for (const art of newArticles) {
      const rewritten = await rewriteArticleWithGPT(art);
      if (rewritten) rewrittenList.unshift(rewritten); // add newest at top
      if (rewrittenList.length > 10) rewrittenList.pop(); // keep max 10
    }

    rewrittenArticles[topic] = rewrittenList;
    console.log(`📝 Hourly updated ${rewrittenList.length} articles for ${topic}`);
  }
});

refreshArticles();

app.get('/news/:topic', (req, res) => {
  const topic = req.params.topic.toLowerCase();
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  res.json(rewrittenArticles[topic]);
});

app.get('/news/:topic/:id', (req, res) => {
  const topic = req.params.topic.toLowerCase();
  const id = decodeURIComponent(req.params.id);
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  const article = rewrittenArticles[topic].find((a) => a.id === id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// ====== COMMENTS API ======
// In-memory comments store: { articleId: [ { name, text, timestamp } ] }
const commentsStore = {};

// Get comments for an article
app.get('/comments/:articleId', (req, res) => {
  const articleId = decodeURIComponent(req.params.articleId);
  const comments = commentsStore[articleId] || [];
  res.json(comments);
});

// Post a new comment
app.post('/comments/:articleId', (req, res) => {
  const articleId = decodeURIComponent(req.params.articleId);
  const { name, text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const comment = {
    name: name?.trim() || 'Anonymous',
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  if (!commentsStore[articleId]) {
    commentsStore[articleId] = [];
  }
  commentsStore[articleId].push(comment);

  res.status(201).json(comment);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
