// Syncs the "News" section from a Google Drive folder.
//
// Flow: find the newest file in the Drive folder -> skip if already
// processed -> download its text -> ask Claude to turn it into a short
// news-card {title, label, body} -> prepend it to assets/data/news.json.
//
// Requires (as env vars / GitHub Actions secrets):
//   GDRIVE_API_KEY    Google Drive API key (folder must be shared as
//                      "anyone with the link can view")
//   GDRIVE_FOLDER_ID  the Drive folder's ID (from its URL)
//   ANTHROPIC_API_KEY Claude API key

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NEWS_PATH = path.join(process.cwd(), 'assets/data/news.json');
const STATE_PATH = path.join(process.cwd(), 'assets/data/news-sync-state.json');
const CLAUDE_MODEL = 'claude-sonnet-5';

const { GDRIVE_API_KEY, GDRIVE_FOLDER_ID, ANTHROPIC_API_KEY } = process.env;

async function main() {
  if (!GDRIVE_API_KEY || !GDRIVE_FOLDER_ID || !ANTHROPIC_API_KEY) {
    console.log('Missing GDRIVE_API_KEY, GDRIVE_FOLDER_ID or ANTHROPIC_API_KEY — skipping sync (not configured yet).');
    return;
  }

  const newest = await findNewestDriveFile();
  if (!newest) {
    console.log('No files found in the Drive folder — nothing to do.');
    return;
  }

  const state = await readJson(STATE_PATH, { lastProcessedFileId: null, lastProcessedModifiedTime: null, syncedAt: null });

  if (state.lastProcessedFileId === newest.id) {
    console.log(`Newest file (${newest.name}) already processed — nothing to do.`);
    return;
  }

  console.log(`New file found: "${newest.name}" (${newest.id}). Downloading...`);
  const rawText = await downloadDriveFileText(newest);

  if (!rawText || !rawText.trim()) {
    console.log('File was empty after download — marking as processed and skipping.');
    await writeState(newest);
    return;
  }

  console.log('Asking Claude to draft the news card...');
  const card = await draftNewsCard(rawText);

  const news = await readJson(NEWS_PATH, []);
  news.unshift({
    title: card.title,
    label: card.label,
    body: card.body,
    date: new Date().toISOString().slice(0, 10)
  });
  await writeFile(NEWS_PATH, JSON.stringify(news, null, 2) + '\n');
  console.log(`Added news card: "${card.title}"`);

  await writeState(newest);
}

async function findNewestDriveFile() {
  const q = encodeURIComponent(`'${GDRIVE_FOLDER_ID}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=1&fields=${fields}&key=${GDRIVE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive files.list failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.files && data.files[0] ? data.files[0] : null;
}

async function downloadDriveFileText(file) {
  const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain&key=${GDRIVE_API_KEY}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive file download failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

async function draftNewsCard(rawText) {
  const prompt = `You maintain the short "News" section of a small hobby web app called Cautious Doodle (a word-quiz app for kids). Turn the raw draft below into one news card.

Match the tone of these existing cards:
- title: "Confetti for correct answers", label: "Update", body: "Nailing an answer now triggers a confetti burst plus a random praise image, so quiz streaks feel like an actual celebration."
- title: "Starter word list included", label: "Update", body: "New here? A ready-made English–Finnish word list ships with the app, so you can try a quiz immediately without typing anything."

Rules:
- title: max ~6 words, no trailing punctuation.
- label: 1-3 words, a short category tag (e.g. "Update", "Behind the scenes", "Under construction").
- body: 2-3 short sentences, friendly and concise, written in the same voice as the examples.
- Respond with ONLY a JSON object with exactly the keys "title", "label", "body". No markdown code fences, no extra text.

Raw draft:
"""
${rawText.trim().slice(0, 4000)}
"""`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`Anthropic API call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not find JSON in Claude's response: ${text}`);
  }

  const card = JSON.parse(jsonMatch[0]);
  if (!card.title || !card.label || !card.body) {
    throw new Error(`Claude's response was missing fields: ${JSON.stringify(card)}`);
  }
  return card;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeState(file) {
  await writeFile(STATE_PATH, JSON.stringify({
    lastProcessedFileId: file.id,
    lastProcessedModifiedTime: file.modifiedTime,
    syncedAt: new Date().toISOString()
  }, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
