import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function generateQuery(keywords) {
  return keywords.map(k => `"${k}"`).join(' OR ');
}

function cleanHeadline(rawTitle) {
  if (!rawTitle) return '';
  let title = rawTitle.replace(/^(\*\*|Title:\s*)+/i, '').replace(/\*+/g, '').trim();
  title = title.replace(/\s[-—]\s.*$/, '');
  return title;
}

function cleanRewrittenContent(text) {
  if (!text) return '';
  return text
    .replace(/[*\s]*Authored by NWO News\s*—.*[\r\n]*/gi, '')
    .replace(/Title:\s*/gi, '')
    .trim();
}

function saveArticles(category, dateKey, articles) {
  const filePath = path.join(DATA_DIR, `${category}-${dateKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf-8');
}

function loadArticles(category, dateKey) {
  const filePath = path.join(DATA_DIR, `${category}-${dateKey}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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
  return `Rewrite the following news article into a conspiracy-themed, detailed, engaging, and informative article about the "New World Order". Emphasize how military, science, politics, media, and religion may be used to manipulate and control society.

Headline: "${article.title}"  
Source: ${article.source.name}  
Published: ${article.publishedAt}  

Content:  
${article.content || article.description || ''}

Your rewrite should include multiple paragraphs and end with a "Sources" section listing the original article and URL.

Begin:
`;
}

async function fetchCategoryArticles(category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];

  const query = generateQuery(keywords);
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=20&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function rewriteArticleWithOpenAI(article) {
  const prompt = generateRewritePrompt(article);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const output = response.choices[0].message.content || '';
    const [firstLine, ...rest] = output.split('\n\n');
    const rewrittenHeadline = cleanHeadline(firstLine.trim());
    const rewrittenContent = cleanRewrittenContent(rest.join('\n\n')) +
      `\n\nSources:\n- ${article.title} (${article.url})`;

    return { rewrittenHeadline, rewrittenContent };
  } catch (err) {
    console.error('OpenAI Error:', err.message);
    return { rewrittenHeadline: cleanHeadline(article.title), rewrittenContent: article.content || '' };
  }
}

async function updateCategoryArticles(category) {
  const today = new Date().toISOString().slice(0, 10);
  let todaysArticles = loadArticles(category, today);
  if (todaysArticles.length >= 10) return;

  const fetched = await fetchCategoryArticles(category);
  if (!fetched.length) return;

  const existingUrls = new Set(todaysArticles.map(a => a.url));
  const newArticles = [];

  for (const article of fetched) {
    if (newArticles.length + todaysArticles.length >= 10) break;
    if (existingUrls.has(article.url)) continue;

    const { rewrittenHeadline, rewrittenContent } = await rewriteArticleWithOpenAI(article);
    newArticles.push({
      id: article.url,
      title: rewrittenHeadline,
      source: article.source.name,
      publishedAt: article.publishedAt,
      rewritten: rewrittenContent,
      originalUrl: article.url,
    });
  }

  const allArticles = [...todaysArticles, ...newArticles];
  saveArticles(category, today, allArticles);

  const oldDates = getLastNDates(31).slice(30);
  oldDates.forEach(date => {
    const oldFile = path.join(DATA_DIR, `${category}-${date}.json`);
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  });

  console.log(`Stored ${allArticles.length} articles for ${category}`);
}

app.get('/news/:category', (req, res) => {
  const category = req.params.category.toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  if (!CATEGORY_KEYWORDS[category]) return res.status(400).json({ error: 'Invalid category' });

  const allDates = getLastNDates(30);
  let all = [];

  for (const dateKey of allDates) {
    const daily = loadArticles(category, dateKey);
    if (Array.isArray(daily)) all = all.concat(daily);
  }

  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const paginated = all.slice((page - 1) * pageSize, page * pageSize);
  res.json(paginated);
});

app.post('/refresh', async (req, res) => {
  try {
    for (const category of Object.keys(CATEGORY_KEYWORDS)) {
      await updateCategoryArticles(category);
    }
    res.json({ message: 'All topics refreshed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ NWO News backend running on port ${PORT}`);
});
