/**
 * Generates encouragement JSON per locale from 365-励志名言.md + English translations.
 *
 * Usage: node scripts/generate-encouragement.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enAuthorByZhAuthor, enByQuote } from './encouragement-en-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../src/lib/i18n/locales');
const sourcePath =
  process.env.ENCOURAGEMENT_SOURCE ??
  join(__dirname, '365-quotes-source.md');

const QUOTE_RE = /^\d+\.\s+"([^"]+)"(?:\s+—\s+(.+))?$/;

function parseMd(content) {
  const quotes = [];
  for (const line of content.split('\n')) {
    const match = line.trim().match(QUOTE_RE);
    if (!match) continue;
    quotes.push({ quote: match[1], author: match[2] ?? null });
  }
  return quotes;
}

function formatMessage(quote, author) {
  return author ? `"${quote}" — ${author}` : `"${quote}"`;
}

function formatEn(quote, author) {
  const enQuote = enByQuote.get(quote);
  if (!enQuote) {
    throw new Error(`Missing English translation for: ${quote}`);
  }
  const enAuthor = author ? enAuthorByZhAuthor.get(author) ?? author : null;
  return formatMessage(enQuote, enAuthor);
}

const content = readFileSync(sourcePath, 'utf8');
const quotes = parseMd(content);

if (quotes.length !== 365) {
  throw new Error(`Expected 365 quotes, got ${quotes.length}`);
}

const zhMessages = quotes.map(({ quote, author }) => formatMessage(quote, author));
const enMessages = quotes.map(({ quote, author }) => formatEn(quote, author));

mkdirSync(join(outDir, 'zh-CN'), { recursive: true });
mkdirSync(join(outDir, 'en-US'), { recursive: true });

writeFileSync(
  join(outDir, 'zh-CN/encouragement.json'),
  JSON.stringify({ messages: zhMessages }, null, 2) + '\n',
);
writeFileSync(
  join(outDir, 'en-US/encouragement.json'),
  JSON.stringify({ messages: enMessages }, null, 2) + '\n',
);

console.log(`Generated ${zhMessages.length} zh-CN and ${enMessages.length} en-US messages.`);
