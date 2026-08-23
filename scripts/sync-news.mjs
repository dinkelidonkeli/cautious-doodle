// Syncs the "News" section from a Google Drive folder.
//
// Expected layout in the shared Drive folder — one subfolder per news
// item, each containing a text file (plain .txt or a native Google Doc)
// and optionally one image:
//
//   /2026-08-syysjuhlat/
//     uutinen.txt
//     kuva.jpg
//
// Flow: list subfolders -> skip ones already processed -> for each new
// one, download its text + image -> ask Claude to turn the text into a
// short news-card {title, label, body} -> save the image under
// images/news/ -> prepend the card to assets/data/news.json.
//
// Requires (as env vars / GitHub Actions secrets):
//   GDRIVE_API_KEY    Google Drive API key (folder must be shared as
//                      "anyone with the link can view")
//   GDRIVE_FOLDER_ID  the parent Drive folder's ID (from its URL)
//   ANTHROPIC_API_KEY Claude API key

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const NEWS_PATH = path.join(process.cwd(), 'assets/data/news.json');
const STATE_PATH = path.join(process.cwd(), 'assets/data/news-sync-state.json');
const IMAGES_DIR = path.join(process.cwd(), 'images/news');
const CLAUDE_MODEL = 'claude-sonnet-5';

const { GDRIVE_API_KEY, GDRIVE_FOLDER_ID, ANTHROPIC_API_KEY } = process.env;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

async function main() {
  if (!GDRIVE_API_KEY || !GDRIVE_FOLDER_ID || !ANTHROPIC_API_KEY) {
    console.log('Missing GDRIVE_API_KEY, GDRIVE_FOLDER_ID or ANTHROPIC_API_KEY — skipping sync (not configured yet).');
    return;
  }

  const folders = await listSubfolders(GDRIVE_FOLDER_ID);
  if (folders.length === 0) {
    console.log('No subfolders found in the Drive folder — nothing to do.');
    return;
  }

  const state = await readJson(STATE_PATH, { processedFolderIds: [], syncedAt: null });
  const processed = new Set(state.processedFolderIds || []);
  const newFolders = folders.filter((f) => !processed.has(f.id));

  if (newFolders.length === 0) {
    console.log('No new folders since last sync — nothing to do.');
    return;
  }

  console.log(`Found ${newFolders.length} new folder(s): ${newFolders.map((f) => f.name).join(', ')}`);

  const news = await readJson(NEWS_PATH, []);
  let anySucceeded = false;

  for (const folder of newFolders) {
    try {
      const item = await processFolder(folder);
      if (item) {
        news.unshift(item);
        console.log(`Added news card: "${item.title}" (from "${folder.name}")`);
      }
    } catch (err) {
      console.error(`Failed to process folder "${folder.name}": ${err.message}`);
      // Skip this folder but keep going with the rest; don't mark it as
      // processed so it gets retried on the next run.
      continue;
    }
    processed.add(folder.id);
    anySucceeded = true;
  }

  if (!anySucceeded) {
    console.log('No folders were successfully processed this run — leaving state untouched.');
    return;
  }

  await writeFile(NEWS_PATH, JSON.stringify(news, null, 2) + '\n');
  await writeFile(STATE_PATH, JSON.stringify({
    processedFolderIds: [...processed],
    syncedAt: new Date().toISOString()
  }, null, 2) + '\n');
}

async function processFolder(folder) {
  const files = await listFiles(folder.id);

  const textFile = files.find((f) =>
    f.mimeType === 'application/vnd.google-apps.document' || f.mimeType.startsWith('text/'));
  const imageFile = files.find((f) => f.mimeType.startsWith('image/'));

  if (!textFile) {
    console.log(`Folder "${folder.name}" has no text file — skipping.`);
    return null;
  }

  const rawText = await downloadDriveFileText(textFile);
  if (!rawText || !rawText.trim()) {
    console.log(`Folder "${folder.name}"'s text file is empty — skipping.`);
    return null;
  }

  console.log(`Asking Claude to draft the news card for "${folder.name}"...`);
  const card = await draftNewsCard(rawText);

  let imagePath = null;
  if (imageFile) {
    imagePath = await downloadDriveImage(imageFile, folder.name);
  }

  return {
    title: card.title,
    label: card.label,
    body: card.body,
    image: imagePath,
    date: new Date().toISOString().slice(0, 10)
  };
}

async function listSubfolders(parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const fields = encodeURIComponent('files(id,name,createdTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime&pageSize=50&fields=${fields}&key=${GDRIVE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive files.list (folders) failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.files || [];
}

async function listFiles(parentId) {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=20&fields=${fields}&key=${GDRIVE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive files.list (contents) failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.files || [];
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

async function downloadDriveImage(file, folderName) {
  const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive image download failed: ${res.status} ${await res.text()}`);
  }

  const ext = EXT_BY_MIME[file.mimeType] || path.extname(file.name).replace('.', '') || 'jpg';
  const filename = `${slugify(folderName)}.${ext}`;

  await mkdir(IMAGES_DIR, { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(IMAGES_DIR, filename), buffer);

  return `images/news/${filename}`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'news-item';
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
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`Anthropic API call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error(`Claude's response was cut off (hit max_tokens) before finishing the JSON.`);
  }

  // content can include non-text blocks (e.g. thinking) before the actual
  // text reply, so find the first text block rather than assuming index 0.
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  const text = textBlock?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not find JSON in Claude's response. Full response: ${JSON.stringify(data).slice(0, 2000)}`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
