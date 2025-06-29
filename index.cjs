import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 10000;
const NEWS_API_KEY = process.env.NEWS_API_KEY || 'YOUR_NEWSAPI_KEY';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_KEY';

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Categories with rich keyword sets per White Paper
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

// Helper: Generate NewsAPI query string from keywords (OR joined)
function generateQuery(keywords) {
  // Join with OR and group in quotes to catch phrases
  return keywords.map(k => `"${k}"`).join(' OR ');
}

// Helper: Sanitize & clean headline/title
function cleanHeadline(rawTitle) {
  if (!rawTitle) return '';
  // Remove prefixes like **Title:** and asterisks, trim whitespace
  let title = rawTitle.replace(/^(\*\*|Title:\s*)+/, '').replace(/\*+/g, '').trim();
  // Remove any trailing dash and text (e.g. "- Source")
  title = title.replace(/\s[-—]\s.*$/, '');
  return title;
}

// Helper: Remove repeated author lines and metadata from rewritten content
function cleanRewrittenContent(text) {
  if (!text) return '';
  // Remove repeated "Authored by NWO News — ..." lines
  let cleaned = text.replace(/[*\s]*Authored by NWO News\s*—.*[\r\n]*/g, '');
  // Remove any lingering "Title:" or similar prefixes
  cleaned = cleaned.replace(/Title:\s*/gi, '');
  return cleaned.trim();
}

// Storage: Save articles for category and date
function saveArticles(category, dateKey, articles) {
  const filePath = path.join(DATA_DIR, `${category}-${dateKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf-8');
}

// Storage: Load articles for category and date
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

// Helper: List dates for last N days in YYYY-MM-DD
function getLastNDates(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Helper: OpenAI rewriting prompt based on article content + source info
function generateRewritePrompt(article) {
  return `Rewrite the following news article into a conspiracy-themed, detailed, engaging, and informative article about the "New World Order" as defined below.  
Focus on weaving in the conspiratorial narrative and emphasize the involvement of the military industrial complex, mainstream media, institutional religions, and technological and scientific organizations working towards a One World Government with a surveillance state, societal control, spiritual suppression, and manipulation.

Article headline: "${article.title}"  
Article source: ${article.source.name}  
Article published date: ${article.publishedAt}  

Article content:  
${article.content || article.description || ''}

Rewrite in multiple paragraphs, add value, and be creative but believable.

At the end of the rewritten article, include a "Sources:" section listing the original article's title and URL.  

Begin rewrite below:

`;
}

// Fetch articles from NewsAPI with pagination & keyword expansion for category
async function fetchCategoryArticles(category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];

  const query = generateQuery(keywords);

  // NewsAPI free tier limits to 100 results, max 100 per request
  // We'll request top 20 for good selection & freshness, can tweak
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=20&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`NewsAPI error for category ${category}:`, res.status, await res.text());
      return [];
    }
    const data = await res.json();
    if (!data.articles || data.articles.length === 0) return [];
    return data.articles;
  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    return [];
  }
}

// Use OpenAI to rewrite an article (returns {rewritten, rewrittenTitle})
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
    // Expect rewritten text to include rewritten headline and article content

    // Extract rewritten headline and content by parsing the AI output
    // Let's assume first line or first sentence is headline, rest is article body

    // Example heuristic: headline on first line before double newline
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

    // Clean headline
    rewrittenHeadline = cleanHeadline(rewrittenHeadline);

    // Clean content
    rewrittenContent = cleanRewrittenContent(rewrittenContent);

    // Append source attribution
    const sourceAttribution = `\n\nSources:\n- ${article.title} (${article.url})`;
    rewrittenContent += sourceAttribution;

    return { rewrittenHeadline, rewrittenContent };
  } catch (error) {
    console.error('OpenAI rewriting error:', error);
    return { rewrittenHeadline: article.title, rewrittenContent: article.content || article.description || '' };
  }
}

// Store rewritten articles daily with retention policy and pagination support
async function updateCategoryArticles(category) {
  const today = new Date().toISOString().slice(0, 10);

  // Load existing stored articles for today, if any
  let todaysArticles = loadArticles(category, today);

  // If already 10 or more articles stored for today, skip fetching new to avoid API overuse
  if (todaysArticles.length >= 10) {
    console.log(`Category ${category} already has ${todaysArticles.length} articles stored for today.`);
    return;
  }

  // Fetch fresh articles from NewsAPI
  const fetchedArticles = await fetchCategoryArticles(category);
  if (!fetchedArticles.length) {
    console.log(`No new articles fetched for category ${category}.`);
    return;
  }

  // Rewrite up to 10 articles not already stored (avoid duplicates by url)
  const existingUrls = new Set(todaysArticles.map(a => a.url));
  const newArticles = [];

  const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

  for (const article of fetchedArticles) {
    if (newArticles.length + todaysArticles.length >= 10) break;
    if (existingUrls.has(article.url)) continue;

    const { rewrittenHeadline, rewrittenContent } = await rewriteArticleWithOpenAI(article, openai);

    newArticles.push({
      id: article.url, // use URL as unique ID
      title: rewrittenHeadline,
      source: article.source.name,
      publishedAt: article.publishedAt,
      rewritten: rewrittenContent,
      originalUrl: article.url,
    });
  }

  // Combine existing and new articles
  const combinedArticles = [...todaysArticles, ...newArticles];

  // Save today's updated articles
  saveArticles(category, today, combinedArticles);

  // Clean old files older than 30 days
  const retentionDays = 30;
  const oldDates = getLastNDates(retentionDays + 1).slice(retentionDays);
  for (const oldDate of oldDates) {
    const oldFile = path.join(DATA_DIR, `${category}-${oldDate}.json`);
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  }

  console.log(`Stored ${combinedArticles.length} rewritten articles for category ${category} on ${today}`);
}

// API: Get articles with pagination by category & date range
// Query params: category, page (default 1), pageSize (default 10)
app.get('/news/:category', (req, res) => {
  const category = req.params.category.toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  if (!CATEGORY_KEYWORDS[category]) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // Collect all articles for last 30 days for category
  const dates = getLastNDates(30);
  let allArticles = [];

  for (const dateKey of dates) {
    const dayArticles = loadArticles(category, dateKey);
    if (Array.isArray(dayArticles)) allArticles = allArticles.concat(dayArticles);
  }

  // Sort by publishedAt descending
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Pagination slice
  const startIndex = (page - 1) * pageSize;
  const pagedArticles = allArticles.slice(startIndex, startIndex + pageSize);

  res.json(pagedArticles);
});

// API: Trigger manual refresh of all categories (for testing or admin)
app.post('/refresh', async (req, res) => {
  try {
    const categories = Object.keys(CATEGORY_KEYWORDS);
    for (const category of categories) {
      await updateCategoryArticles(category);
    }
    res.json({ message: 'All categories refreshed.' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh categories.' });
  }
});

// Scheduled hourly refresh for breaking news (optional)
// You can implement cron jobs or external schedulers calling the /refresh endpoint hourly.

// Start server
app.listen(PORT, () => {
  console.log(`NWO News backend running on port ${PORT}`);
  console.log('Run POST /refresh to fetch and rewrite articles.');
});

