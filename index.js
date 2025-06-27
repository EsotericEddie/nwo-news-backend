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

const PORT = process.env.PORT || 4000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

if (!OPENAI_API_KEY || !NEWS_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY or NEWS_API_KEY in environment variables.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const TOPICS = ['world', 'politics', 'technology', 'health', 'finance'];

let rewrittenArticles = {
  world: [],
  politics: [],
  technology: [],
  health: [],
  finance: [],
};

// ✅ Fetch raw articles from NewsAPI
async function fetchBreakingNews(topic) {
  const url = `https://newsapi.org/v2/top-headlines?category=${topic}&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  try {
    const response = await axios.get(url);
    return response.data.articles;
  } catch (e) {
    console.error(`NewsAPI fetch error for topic ${topic}:`, e.message);
    return [];
  }
}

// ✅ Rewrite one article using GPT-4o
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
    console.error('OpenAI rewrite error:', e.message);
    return null;
  }
}

// ✅ Refresh articles per topic and rewrite them
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
  }
  console.log('✅ Articles refreshed');
}

// ⏰ Daily job at 3:00 AM UTC
cron.schedule('0 3 * * *', refreshArticles);

// 🔄 Also fetch on startup
refreshArticles();

// 🔗 API: Get 10 articles by topic
app.get('/news/:topic', (req, res) => {
  const topic = req.params.topic;
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  res.json(rewrittenArticles[topic]);
});

// 🔗 API: Get single article by ID (encoded URL)
app.get('/news/:topic/:id', (req, res) => {
  const topic = req.params.topic;
  const id = decodeURIComponent(req.params.id);
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  const article = rewrittenArticles[topic].find((a) => a.id === id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
