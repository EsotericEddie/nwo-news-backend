
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/rewrite', async (req, res) => {
  const { article } = req.body;
  const prompt = `Rewrite the following news article for our platform 'New World Order News'. Maintain facts but reframe it with critical analysis of globalist, military, and media agendas. Source must be cited at the end. Text: ${article}`;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 800
    });

    res.json({ rewritten: completion.data.choices[0].message.content });
  } catch (error) {
    res.status(500).send("Error generating rewritten article");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
