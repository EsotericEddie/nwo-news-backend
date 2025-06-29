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

// Enhanced keyword map per topic
const TOPIC_KEYWORDS = {
  military: 'war OR military OR army OR martial law OR aliens',
  science: 'medicine OR technology OR psychology OR psychedelics OR AI OR neuroscience',
  politics: 'false flag OR psyop OR corruption OR deep state OR secret society OR government',
  religion: '3rd temple OR messiah OR satanic OR religious war OR demons OR antichrist OR end times',
  media: 'hollywood OR symbolism OR pedophile OR mkultra OR brainwashing OR entertainment'
};

async function fetchBreakingNews(topic) {
  const keywords = TOPIC_KEYWORDS[topic] || topic;
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keywords)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;

  try {
    const response = await axios.get(url);
    console.log(`✅ NewsAPI returned ${response.data.articles.length} for topic: ${topic}`);
    return response.data.articles;
  } catch (e) {
    console.error(`NewsAPI fetch error for topic ${topic}:`, e.response?.data || e.message);
    return [];
  }
}

function getPromptForTopic(topic, article) {
  const base = `
You are an investigative journalist at a conspiratorial news outlet called "NWO News".
Rewrite the article below in a professional, journalistic tone with a conspiratorial perspective.

Requirements:
- A provocative headline
- 'Authored by NWO News'
- A timestamp (use today's full date, e.g., June 28, 2025)
- Rewritten body that fits this conspiratorial narrative:
`;

  const themes = {
    military: "Potential World War 3, secret military operations, alien encounters, or martial law rollouts.",
    science: "Mass mind control, digital surveillance, depopulation experiments, and forced compliance through tech or medicine.",
    politics: "Globalist manipulation, deep state, Illuminati psyops, and false flag political events.",
    religion: "End-times prophecies, demonic portals, secret societies, messianic deception, or New Age antichrist agendas.",
    media: "Hollywood brainwashing, occult rituals, child exploitation rings, MK-Ultra mind control, or satanic symbolism."
  };

  return `${base}${themes[topic] || ''}

Original Article:
Title: ${article.title}
Content: ${article.content || article.description || article.title}
Source: ${article.source.name}
Published at: ${article.publishedAt}
URL: ${article.url}`;
}

async function rewriteArticleWithGPT(article, topic) {
  const prompt = getPromptForTopic(topic, article);

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
      const rewritten = await rewriteArticleWithGPT(art, topic);
      if (rewritten) rewrittenList.push(rewritten);
      if (rewrittenList.length >= 5) break; // Limit to 5 per topic
    }

    if (rewrittenList.length === 0) {
      console.warn(`⚠️ No rewritten articles found for topic: ${topic}`);
    }

    rewrittenArticles[topic] = rewrittenList;
    console.log(`📝 Stored ${rewrittenList.length} rewritten articles for ${topic}`);
  }
  console.log('✅ All topics refreshed');
}

cron.schedule('0 3 * * *', refreshArticles); // Refresh once daily at 3AM UTC
refreshArticles();

// API Routes

app.get('/news/:topic', (req, res) => {
  const topic = req.params.topic.toLowerCase();
  if (!TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  res.json(rewrittenArticles[topic] || []);
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

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
