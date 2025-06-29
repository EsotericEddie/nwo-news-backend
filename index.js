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

const fallbackArticles = {
  military: [
    {
      id: 'military-fallback-1',
      title: 'Global Tensions Escalate as NATO Quietly Mobilizes Forces',
      source: 'Fallback Intelligence',
      originalUrl: 'https://nwo-fallback.com/military1',
      publishedAt: new Date().toISOString(),
      rewritten: `# Global Tensions Escalate as NATO Quietly Mobilizes Forces  
**Authored by NWO News** – ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Behind the mainstream media's curtain of silence, NATO troops are being quietly positioned near Eastern Europe’s flashpoints. Multiple sources point to covert preparations for a global conflict — a World War 3 scenario — masked as joint exercises.

Rumors suggest these deployments are connected to unknown aerial phenomena and experimental space surveillance networks. Global military elites are preparing for either alien disclosure or catastrophic false flag triggers.

**Sources:**  
- NATO Insider Brief  
- https://nwo-fallback.com/military1`
    }
  ],
  science: [
    {
      id: 'science-fallback-1',
      title: 'Neural Lace Agenda: Global Rollout of Mind Interface Technology Begins',
      source: 'Fallback Research',
      originalUrl: 'https://nwo-fallback.com/science1',
      publishedAt: new Date().toISOString(),
      rewritten: `# Neural Lace Agenda: Global Rollout of Mind Interface Technology Begins  
**Authored by NWO News** – ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Tech conglomerates are now testing neural interface chips in human trials under the guise of “medical innovation.” These devices allegedly cure paralysis, but hidden documents reveal they're designed to monitor thoughts and enforce compliance.

Digital control of society is no longer theory — it’s being embedded, injected, and sold as salvation.

**Sources:**  
- Internal Tech Memo Leak  
- https://nwo-fallback.com/science1`
    }
  ],
  politics: [
    {
      id: 'politics-fallback-1',
      title: 'False Flag Operation? Explosion at Capitol Raises Eyebrows',
      source: 'Fallback Politics',
      originalUrl: 'https://nwo-fallback.com/politics1',
      publishedAt: new Date().toISOString(),
      rewritten: `# False Flag Operation? Explosion at Capitol Raises Eyebrows  
**Authored by NWO News** – ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Just hours before a controversial surveillance bill was set to be debated, an explosion at the Capitol disrupted proceedings. Mainstream outlets call it "domestic terrorism," but patterns and timing scream false flag.

Insiders claim secret society operatives are pushing the narrative to enable a global technocratic clampdown.

**Sources:**  
- Anonymous DHS Leak  
- https://nwo-fallback.com/politics1`
    }
  ],
  religion: [
    {
      id: 'religion-fallback-1',
      title: '3rd Temple Preparations Revealed: Global Faiths Set for Convergence',
      source: 'Fallback Prophecy Watch',
      originalUrl: 'https://nwo-fallback.com/religion1',
      publishedAt: new Date().toISOString(),
      rewritten: `# 3rd Temple Preparations Revealed: Global Faiths Set for Convergence  
**Authored by NWO News** – ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

New satellite images show construction activity on Temple Mount. Religious leaders are uniting under a “New Age” banner—one prophesied to usher in the rise of the antichrist.

This interfaith convergence appears peaceful, but insiders warn it’s part of a broader occult agenda to deceive the masses.

**Sources:**  
- Satellite Intelligence Archive  
- https://nwo-fallback.com/religion1`
    }
  ],
  media: [
    {
      id: 'media-fallback-1',
      title: 'MK-Ultra Reborn? Hollywood’s Subliminal Assault Exposed',
      source: 'Fallback Media',
      originalUrl: 'https://nwo-fallback.com/media1',
      publishedAt: new Date().toISOString(),
      rewritten: `# MK-Ultra Reborn? Hollywood’s Subliminal Assault Exposed  
**Authored by NWO News** – ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

A whistleblower from a major streaming platform has leaked evidence of subliminal frames and sigils embedded in children's content. The symbols trace back to ancient occult rituals.

This isn’t just predictive programming — it’s psychological warfare aimed at the youngest minds.

**Sources:**  
- Hollywood Insider Reports  
- https://nwo-fallback.com/media1`
    }
  ]
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

    rewrittenArticles[topic] = rewrittenList.length > 0
      ? rewrittenList
      : fallbackArticles[topic];

    console.log(`📝 Stored ${rewrittenArticles[topic].length} articles for ${topic}`);
  }
  console.log('✅ All topics refreshed');
}

cron.schedule('0 3 * * *', refreshArticles);
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
  console.log(`🚀 Backend running on port ${PORT}`);
});
