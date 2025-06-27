import express from 'express';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

if (!OPENAI_API_KEY || !NEWS_API_KEY) {
  console.error('ERROR: Missing OPENAI_API_KEY or NEWS_API_KEY environment variables.');
  process.exit(1);
}

const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

const TOPICS = ['world', 'politics', 'technology', 'health', 'finance'];

let rewrittenArticles = {
  world: [],
  politics: [],
  technology: [],
  health: [],
  finance: [],
};

async function fetchBreakingNews(topic) {
  const url = `https://newsapi.org/v2/top-headlines?category=${topic}&pageSize=10&apiKey=${NEWS_API_KEY}`;
  try {
    const response = await axios.get(url);
    return response.data.articles;
  } catch (e) {
    console.error(`NewsAPI fetch error for topic ${topic}:`, e.message);
    return [];
  }
}

async function rewriteArticleWithGPT(article) {
  const prompt = `Rewrite the following news article from a conspiratorial New World Order perspective, emphasizing hidden agendas, power dynamics, and global control themes:\n\nTitle: ${article.title}\nContent: ${article.content || article.description || article.title}`;

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
    });
    const rewritten = completion.data.choices[0].message.content.trim();
    return {
      id: article.url,
      title: article.title,
      source: article.source.name,
      originalUrl: article.url,
      rewritten,
    };
  } catch (e) {
    console.error('OpenAI rewrite error:', e.message);
    return null;
  }
}

async function refreshArticles() {
  console.log('Refreshing articles...');
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
  console.log('Articles refreshed');
}

cron.schedule('0 3 * * *', () => {
  refreshArticles();
});

refreshArticles();

app.get('/news/:topic', (req, res) => {
  const topic = req.params.topic;
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  res.json(rewrittenArticles[topic]);
});

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

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
