import express from 'express';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const TOPICS = ['military','science','politics','religion','media'];
const STORAGE_DIR = './news_storage';

if (!OPENAI_API_KEY || !NEWS_API_KEY) process.exit(1);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

// Cleanup old files
function pruneOld() {
  const files = fs.readdirSync(STORAGE_DIR);
  const cutoff = Date.now() - 30*24*60*60*1000;
  files.forEach(f => {
    const ts = fs.statSync(path.join(STORAGE_DIR,f)).mtime.getTime();
    if (ts < cutoff) fs.unlinkSync(path.join(STORAGE_DIR,f));
  });
}

// fetch + rewrite
async function fetchAndSaveDaily() {
  for (let topic of TOPICS) {
    const resp = await axios.get(`https://newsapi.org/v2/top-headlines?q=${topic}&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`);
    const raw = resp.data.articles;
    const rewrittenList = [];
    for (let art of raw) {
      const prompt = `Rewrite article in conspiratorial style...`;
      const msg = (await openai.chat.completions.create({ model:'gpt-4o', messages:[{role:'user',content:prompt}], max_tokens:1000 })).choices[0].message.content.trim();
      const cleaned = msg.replace(/Authored by NWO News\s*—.*[\r\n]*/g, '').trim();
      const firstLine = cleaned.split('\n')[0];
      rewrittenList.push({
        id: art.url,
        rewrittenTitle: firstLine,
        rewritten: cleaned,
        publishedAt: new Date().toISOString(),
      });
    }
    const fn = path.join(STORAGE_DIR, `${topic}_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(fn, JSON.stringify(rewrittenList));
  }
  pruneOld();
}

// cron at 7 AM PST and hourly
cron.schedule('0 7 * * *', fetchAndSaveDaily);
cron.schedule('0 * * * *', fetchAndSaveDaily);
fetchAndSaveDaily();

app.get('/news/:topic', (req,res)=>{
  const topic = req.params.topic;
  const page = Math.max(1, parseInt(req.query.page)||1);
  const files = fs.readdirSync(STORAGE_DIR).filter(f=>f.startsWith(topic+'_')).sort().reverse();
  const all = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(STORAGE_DIR,f))));
  const pageSize=10;
  const paged = all.slice((page-1)*pageSize, page*pageSize);
  res.json({ articles:paged, page, total: all.length });
});

app.listen(PORT, ()=>console.log(`Backend listening on ${PORT}`));
