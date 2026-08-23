require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const key = process.env.AZURE_TRANSLATOR_KEY;
const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
const location = process.env.AZURE_RESOURCE_LOCATION;

if (!key || !endpoint || !location) {
    console.error('ERROR: Azure Translator API key, endpoint, or location not set in .env file.');
    process.exit(1);
}

app.post('/translate', async (req, res) => {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
        return res.status(400).json({ error: 'Missing text or targetLanguage.' });
    }

    try {
        const response = await axios({
            method: 'post',
            url: `${endpoint}/translate?api-version=3.0&to=${targetLanguage}`,
            headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Ocp-Apim-Subscription-Region': location,
                'Content-type': 'application/json',
                'X-ClientTraceId': uuidv4()
            },
            data: [{
                'text': text
            }],
            responseType: 'json'
        });

        const translatedText = response.data[0].translations[0].text;
        res.json({ translatedText });

    } catch (error) {
        console.error('Azure Translator API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Translation failed.' });
    }
});

app.listen(port, () => {
    console.log(`Azure Translator Proxy running on port ${port}`);
});