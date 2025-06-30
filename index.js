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
  military: ['war', 'military', 'martial law', 'nuclear', 'conflict'],
  science: ['technology', 'science', 'experiment', 'discovery', 'AI'],
  politics: ['election', 'protest', 'government', 'policy', 'law'],
  religion: ['church', 'spiritual', 'religion', 'faith', 'vatican'],
  media: ['celebrity', 'hollywood', 'media', 'influencer', 'scandal'],
};

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function generateQuery(keywords) {
  return keywords.map(k => `"${k}"`).join(' OR ');
}

function cleanHeadline(raw) {
  return raw?.replace(/^(\*\*|Title:)\s*/i, '').replace(/\*+/g, '').replace(/\s[-—]\s.*$/, '').trim() || '';
}

function cleanRewritten(text) {
  return text
    ?.replace(/[*\s]*Authored by NWO News\s*—.*/gi, '')
    .replace(/Title:\s*/gi, '')
    .trim() || '';
}

function saveArticles(category, date, articles) {
  fs.writeFileSync(path.join(DATA_DIR, `${category}-${date}.json`), JSON.stringify(articles, null, 2), 'utf8');
}

function loadArticles(category, date) {
  try {
    const file = path.join(DATA_DIR, `${category}-${date}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  } catch {
    return [];
  }
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });
}

function promptForRewrite(article) {
  return `Rewrite the following article to reflect a conspiracy perspective centered on the New World Order.
Focus on military-industrial complex, media manipulation, religious control, and technology-driven mind control.

Headline: "${article.title}"  
Source: ${article.source.name}  
Published: ${article.publishedAt}  

Content: ${article.content || article.description || ''}

End with a "Sources:" section that includes the title and article URL.

Begin:`;
}

async function fetchCategoryArticles(category) {
  const query = generateQuery(CATEGORY_KEYWORDS[category]);
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=30&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`✅ NewsAPI returned ${data.articles?.length || 0} articles for: ${category}`);
    return data.articles || [];
  } catch (err) {
    console.error(`❌ Fetch error for ${category}:`, err.message);
    return [];
  }
}

async function rewriteArticle(article) {
  const prompt = promptForRewrite(article);
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const content = res.choices[0].message.content || '';
    const [headline, ...rest] = content.split('\n\n');
    app.listen(PORT, async () => {
  console.log(`🔥 NWO News backend running on port ${PORT}`);
  console.log('🔁 Initial refresh starting...');
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    await updateCategoryArticles(category);
  }
});

   
