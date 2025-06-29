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
  console.error('❌ Missing API keys');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let rewrittenArticles = {};
for (const t of TOPICS) rewrittenArticles[t] = [];

async function fetchBreakingNews(topic) {
  const url = `https://newsapi.org/v2/top-headlines?q=${topic}&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  try {
    const response = await axios.get(url);
    console.log(`✅ NewsAPI: ${response.data.articles.length} articles for ${topic}`);
    return response.data.articles || [];
  } catch (e) {
    console.error('NewsAPI fetch error:', e.message);
    return [];
  }
}

async function rewriteArticleWithGPT(article, topic) {
  const prompt = `
You are an investigative journalist at a conspiratorial news outlet called "NWO News".

Rewrite this article in a conspiratorial tone. Include:
1. A **new provocative headline**.
2. **Byline**: Author: NWO News
3. **Timestamp**: ${new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'})}
4. Full-body conspiratorial rewrite (WW3, psyops, satanic, etc. depending on topic).
5. Cited sources at the end.

Original:
Title: ${article.title}
Content: ${article.content || article.description || ''}
Source: ${article.source.name}
URL: ${article.url}
`;
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
    });
    const full = res.choices[0].message.content;
    const firstLine = full.split('\n')[0].replace(/^(Headline:\s*)/, '').trim();
    return {
      id: article.url,
      title: firstLine,
      source: article.source.name,
      originalUrl: article.url,
      publishedAt: new Date().toISOString(),
      rewritten: full,
      topic,
      timestamp: Date.now(),
    };
  } catch (e) {
    console.error('GPT rewrite error:', e.message);
    return null;
  }
}

async function refreshAll() {
  console.log('🔄 Refreshing...');
  for (const topic of TOPICS) {
    const raw = await fetchBreakingNews(topic);
    let list = await Promise.all(raw.map(a => rewriteArticleWithGPT(a, topic)));
    list = list.filter(x => x).slice(0, 10);

    const prev = rewrittenArticles[topic] || [];
    rewrittenArticles[topic] = [...list, ...prev]
      .sort((a,b)=> b.timestamp - a.timestamp)
      .slice(0, 300);  // keep ~30 days if hourly
    console.log(`📝 ${topic}: ${rewrittenArticles[topic].length} total stored`);
  }
  console.log('✅ Done');
}

cron.schedule('0 7 * * *', refreshAll);
cron.schedule('0 * * * *', async () => {
  console.log('⏱ Hourly breaking refresh');
  for (const t of TOPICS) {
    const raw = await fetchBreakingNews(t);
    const topRawUrls = new Set(raw.map(a=>a.url));
    const filtered = raw.filter(a => {
      const exists = rewrittenArticles[t].find(r=>r.id===a.url);
      return !exists && topRawUrls.size>1;
    }).slice(0,2);
    const rewritten = await Promise.all(filtered.map(a => rewriteArticleWithGPT(a,t)));
    rewrittenArticles[t] = [...rewritten.filter(x=>x), ...rewrittenArticles[t]].slice(0,300);
    console.log(`📝 ${t}: +${filtered.length}`);
  }
  console.log('🔥 Hourly refresh complete');
});
refreshAll();

app.get('/news/:topic', (req, res) => {
  const t = req.params.topic;
  if (!TOPICS.includes(t)) return res.status(400).json({ error: 'Invalid topic' });
  res.json(rewrittenArticles[t].slice(0,10));
});

app.get('/news/:topic/:id', (req, res) => {
  const t = req.params.topic;
  const id = decodeURIComponent(req.params.id);
  if (!TOPICS.includes(t)) return res.status(400).json({ error: 'Invalid topic' });
  const art = rewrittenArticles[t].find(a => a.id === id);
  return art ? res.json(art) : res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, ()=> console.log(`🚀 Listening on ${PORT}`));
