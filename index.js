import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 10000;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const CATEGORY_KEYWORDS = {
  military: [
    'war', 'covert operations', 'cold war', 'meetings between world leaders', 'international skirmishes',
    'confrontations', 'new laws', 'martial law', 'military threats', 'intelligence operations',
    'expansion of power', 'threats', 'military industrial complex'
  ],
  science: [
    'human body discoveries', 'anthropology', 'climate', 'nature', 'celestial', 'vaccinations',
    'human-technology fusion', 'psychology', 'mind', 'consciousness', 'psychedelics',
    'technological advancements', 'quantum science', 'strange phenomena', 'simulation theory'
  ],
  politics: [
    'regime changes', 'new laws', 'protests', 'civil unrest', 'social changes', 'community activism',
    'police brutality', 'police state', 'strict governance', 'government failures', 'secret societies',
    'world meetings', 'new leaders', 'guerilla warfare', 'psyops', 'covert operations',
    'finance world ties', 'political ties'
  ],
  religion: [
    'spirituality', 'new age', 'institutional religions', 'vatican', 'christianity', 'islam', 'judaism',
    'religious fighting', 'religious extremists', 'prophecy', 'religious leaders', 'religion and politics',
    'aliens', 'demons', 'spiritual attacks', 'antichrist', 'middle east crisis', 'secret societies',
    'crop circles', 'strange phenomena'
  ],
  media: [
    'hollywood', 'celebrities', 'influencers', 'content creators', 'legacy media', 'scandals',
    'occult symbolism', 'occult parties', 'sex rings', 'human trafficking', 'jeffrey epstein',
    'satanic symbolism', 'satanic rituals', 'predictive programming', 'significant events'
  ],
};

function generateQuery(keywords) {
  return keywords.map(k => `"${k}"`).join(' OR ');
}

function cleanHeadline(rawTitle) {
  if (!rawTitle) return '';
  let title = rawTitle.replace(/^(\*\*|Title:\s*)+/, '').replace(/\*+/g, '').trim();
  title = title.replace(/\s[-—]\s.*$/, '');
  return title;
}

function cleanRewrittenContent(text) {
  if (!text) return '';
  let cleaned = text.replace(/[*\s]*Authored by NWO News\s*—.*[\r\n]*/g, '');
  cleaned = cleaned.replace(/Title:\s*/gi, '');
  return cleaned.trim();
}

function saveArticles(category, dateKey, articles) {
  const filePath = path.join(DATA_DIR, `${category}-${dateKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf-8');
}

function loadArticles(category, dateKey) {
  const filePath = path.join(DATA_DIR, `${category}-${dateKey}.json`);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function getLastNDates(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function generateRewritePrompt(article) {
  return `Rewrite the following news article into a conspiracy-themed, detailed, engaging, and informative article about the "New World Order".

Focus on the global plan involving the military industrial complex, media, institutional religions, and advanced tech to form a centralized surveillance government.

Headline: "${article.title}"  
Source: ${article.source.name}  
Date: ${article.publishedAt}  

Content:  
${article.content || article.description || ''}

Begin rewrite in multiple paragraphs. At the end, include:

Sources:
- ${article.title} (${article.url})`;
}

async function fetchCategoryArticles(category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];

  const query = generateQuery(keywords);
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=20&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`NewsAPI error for ${category}:`, res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return data.articles || [];
  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    return [];
  }
}

async function rewriteArticleWithOpenAI(article, openai) {
  const prompt = generateRewritePrompt(article);

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const rewrittenText = completion.data.choices[0].message.content;
    let rewrittenHeadline = '';
    let rewrittenContent = '';

    if (rewrittenText) {
      const splitIndex = rewrittenText.indexOf('\n\n');
      if (splitIndex > 0) {
        rewrittenHeadline = rewrittenText.slice(0, splitIndex).trim();
        rewrittenContent = rewrittenText.slice(splitIndex).trim();
      } else {
        rewrittenHeadline = rewrittenText.trim().split('\n')[0];
        rewrittenContent = rewrittenText.trim();
      }
    }

    rewrittenHeadline = cleanHeadline(rewrittenHeadline);
    rewrittenContent = cleanRewrittenContent(rewrittenContent);

    rewrittenContent += `\n\nSources:\n- ${article.title} (${article.url})`;

    return { rewrittenHeadline, rewrittenContent };
  } catch (error) {
    console.error('OpenAI rewriting error:', error);
    return { rewrittenHeadline: article.title, rewrittenContent: article.content || article.description || '' };
  }
}

async function updateCategoryArticles(category) {
  const today = new Date().toISOString().slice(0, 10);
  let todaysArticles = loadArticles(category, today);

  if (todaysArticles.length >= 10) {
    console.log(`Already 10+ articles for ${category} today.`);
    return;
  }

  const fetched = await fetchCategoryArticles(category);
  if (!fetched.length) {
    console.log(`No articles fetched for ${category}.`);
    return;
  }

  const existingUrls = new Set(todaysArticles.map(a => a.url));
  const newArticles = [];
  const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

  for (const article of fetched) {
    if (newArticles.length + todaysArticles.length >= 10) break;
    if (existingUrls.has(article.url)) continue;

    const { rewrittenHeadline, rewrittenContent } = await rewriteArticleWithOpenAI(article, openai);

    newArticles.push({
      id: article.url,
      title: rewrittenHeadline,
      source: article.source.name,
      publishedAt: article.publishedAt,
      rewritten: rewrittenContent,
      originalUrl: article.url,
    });
  }

  const combined = [...todaysArticles, ...newArticles];
  saveArticles(category, today, combined);

  const oldDates = getLastNDates(31).slice(30);
  for (const old of oldDates) {
    const file = path.join(DATA_DIR, `${category}-${old}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  console.log(`Stored ${combined.length} articles for ${category} (${today})`);
}

app.get('/news/:category', (req, res) => {
  const category = req.params.category.toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  if (!CATEGORY_KEYWORDS[category]) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const dates = getLastNDates(30);
  let all = [];

  for (const dateKey of dates) {
    const loaded = loadArticles(category, dateKey);
    if (Array.isArray(loaded)) all = all.concat(loaded);
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const start = (page - 1) * pageSize;
  res.json(all.slice(start, start + pageSize));
});

app.post('/refresh', async (req, res) => {
  try {
    const categories = Object.keys(CATEGORY_KEYWORDS);
    for (const cat of categories) {
      await updateCategoryArticles(cat);
    }
    res.json({ message: 'All categories refreshed.' });
  } catch (e) {
    console.error('Refresh error:', e);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ NWO News backend running on port ${PORT}`);
  console.log(`🔁 Visit /refresh to manually trigger article updates`);
});
