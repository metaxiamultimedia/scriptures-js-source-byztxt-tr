/**
 * Import script for ByzTxt Textus Receptus (Greek NT) data.
 *
 * Downloads the ZIP archive from GitHub byztxt project, extracts .UTR files,
 * transliterates Latin to Greek, and converts to JSON format.
 *
 * Usage: npx tsx scripts/import.ts
 */

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createUnzip } from 'zlib';
import { Extract } from 'unzipper';
import { computeGreek } from '@metaxia/scriptures-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const BASE_ZIP_URL = 'https://codeload.github.com/byztxt/greektext-textus-receptus/zip/refs/heads/master';

const SOURCE_DIR = join(ROOT_DIR, 'source');
const PARSED_DIR = join(SOURCE_DIR, 'parsed');
const DATA_DIR = join(ROOT_DIR, 'data', 'byztxt-TR');

// Book mapping from byztxt abbreviations to OSIS
const BOOK_MAP: Record<string, string> = {
  'MT': 'Matt', 'MR': 'Mark', 'LU': 'Luke', 'JOH': 'John',
  'AC': 'Acts', 'RO': 'Rom', '1CO': '1Cor', '2CO': '2Cor',
  'GA': 'Gal', 'EPH': 'Eph', 'PHP': 'Phil', 'COL': 'Col',
  '1TH': '1Thess', '2TH': '2Thess', '1TI': '1Tim', '2TI': '2Tim',
  'TIT': 'Titus', 'PHM': 'Phlm', 'HEB': 'Heb',
  'JAS': 'Jas', '1PE': '1Pet', '2PE': '2Pet',
  '1JO': '1John', '2JO': '2John', '3JO': '3John',
  'JUDE': 'Jude', 'RE': 'Rev',
};

// Transliteration mapping from byztxt Latin to Greek
const LATIN_TO_GREEK: Record<string, string> = {
  'a': 'α', 'b': 'β', 'g': 'γ', 'd': 'δ', 'e': 'ε', 'z': 'ζ',
  'h': 'η', 'q': 'θ', 'i': 'ι', 'k': 'κ', 'l': 'λ', 'm': 'μ',
  'n': 'ν', 'j': 'ξ', 'o': 'ο', 'p': 'π', 'r': 'ρ', 's': 'σ',
  't': 'τ', 'u': 'υ', 'f': 'φ', 'c': 'χ', 'y': 'ψ', 'w': 'ω',
  'v': 'ς',  // final sigma
  'A': 'Α', 'B': 'Β', 'G': 'Γ', 'D': 'Δ', 'E': 'Ε', 'Z': 'Ζ',
  'H': 'Η', 'Q': 'Θ', 'I': 'Ι', 'K': 'Κ', 'L': 'Λ', 'M': 'Μ',
  'N': 'Ν', 'J': 'Ξ', 'O': 'Ο', 'P': 'Π', 'R': 'Ρ', 'S': 'Σ',
  'T': 'Τ', 'U': 'Υ', 'F': 'Φ', 'C': 'Χ', 'Y': 'Ψ', 'W': 'Ω',
  'V': 'Σ',  // final sigma uppercase
};

interface WordEntry {
  position: number;
  text: string;
  lemma?: string[] | null;
  morph?: string | null;
  strongs?: string;
  metadata: Record<string, unknown>;
  gematria: Record<string, number>;
}

interface VerseData {
  text: string;
  words: WordEntry[];
  gematria: Record<string, number>;
  metadata?: Record<string, unknown>;
}

function transliterateToGreek(text: string): string {
  let result = '';
  for (const char of text) {
    result += LATIN_TO_GREEK[char] || char;
  }
  return result;
}

async function downloadAndExtract(): Promise<void> {
  if (existsSync(PARSED_DIR)) {
    const files = await readdir(PARSED_DIR);
    if (files.some(f => f.endsWith('.UTR'))) {
      console.log('  → Using cached source files');
      return;
    }
  }

  await mkdir(SOURCE_DIR, { recursive: true });
  await mkdir(PARSED_DIR, { recursive: true });

  console.log('  → Downloading byztxt ZIP archive...');
  const response = await fetch(BASE_ZIP_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const zipPath = join(SOURCE_DIR, 'byztxt.zip');
  const buffer = await response.arrayBuffer();
  await writeFile(zipPath, Buffer.from(buffer));

  console.log('  → Extracting ZIP archive...');

  // Use unzipper to extract
  const unzipper = await import('unzipper');
  const zip = await unzipper.Open.file(zipPath);

  for (const entry of zip.files) {
    if (entry.path.includes('/parsed/') && entry.path.endsWith('.UTR')) {
      const fileName = entry.path.split('/').pop()!;
      const content = await entry.buffer();
      await writeFile(join(PARSED_DIR, fileName), content);
    }
  }

  console.log('  ✓ Extracted source files');
}

interface ParsedWord {
  position: number;
  text: string;
  lemma?: string[];
  strongs?: string;
  morph?: string;
  metadata: Record<string, unknown>;
}

interface ParsedVerse {
  chapter: number;
  verse: number;
  words: ParsedWord[];
}

function parseUtrFile(content: string, book: string): ParsedVerse[] {
  const verses: ParsedVerse[] = [];
  const tokens = content.split(/\s+/).filter(Boolean);

  let chapter: number | null = null;
  let verse: number | null = null;
  let words: ParsedWord[] = [];
  let pos = 1;

  const verseRe = /^(\d+):(\d+)$/;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const match = verseRe.exec(tok);

    if (match) {
      // Save previous verse
      if (chapter !== null && verse !== null && words.length > 0) {
        verses.push({ chapter, verse, words });
      }

      chapter = parseInt(match[1], 10);
      verse = parseInt(match[2], 10);
      words = [];
      pos = 1;
      i++;
      continue;
    }

    // Skip bare Strong's numbers - source data anomaly where a Strong's
    // number appears without a preceding Greek word.
    // Example: 1 Corinthians 2:13 source has:
    //   "pneumatikoiv 4152 {A-DPN} 4152 {A-DPM} pneumatika 4152 {A-APN}"
    // The second "4152 {A-DPM}" is a bare Strong's number with no Greek word.
    if (/^\d+$/.test(tok)) {
      // Consume the morph tag if present
      if (i + 1 < tokens.length && tokens[i + 1].startsWith('{')) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // Word token
    const word = tok;
    i++;

    let lemma: string | undefined;
    if (i < tokens.length && /^\d+$/.test(tokens[i])) {
      lemma = tokens[i];
      i++;
      // Skip parsing number if present
      if (i < tokens.length && /^\d+$/.test(tokens[i])) {
        i++;
      }
    }

    let morph: string | undefined;
    if (i < tokens.length && tokens[i].startsWith('{')) {
      morph = tokens[i].replace(/[{}]/g, '');
      i++;
    }

    // Convert to Greek
    const greekText = transliterateToGreek(word);

    const entry: ParsedWord = {
      position: pos++,
      text: greekText,
      metadata: {},
    };

    if (lemma) {
      entry.lemma = [`G${lemma}`];
      entry.strongs = `G${lemma}`;
    }

    if (morph) {
      entry.morph = `robinson:${morph}`;
    }

    words.push(entry);
  }

  // Save last verse
  if (chapter !== null && verse !== null && words.length > 0) {
    verses.push({ chapter, verse, words });
  }

  return verses;
}

function detectAndFlagColophon(words: ParsedWord[]): { words: ParsedWord[]; colophonInfo: Record<string, unknown> | null } {
  if (!words.length) return { words: [], colophonInfo: null };

  // Find pipe delimiter
  const pipeIndex = words.findIndex(w => w.text === '|');
  if (pipeIndex === -1) return { words, colophonInfo: null };

  // Find bracket start after pipe
  let bracketStart = -1;
  for (let i = pipeIndex + 1; i < words.length; i++) {
    if (words[i].text.startsWith('[')) {
      bracketStart = i;
      break;
    }
  }

  if (bracketStart === -1) {
    // No colophon, just remove pipes
    return {
      words: words.filter(w => w.text !== '|'),
      colophonInfo: null,
    };
  }

  // Find bracket end
  let bracketEnd = -1;
  for (let i = bracketStart; i < words.length; i++) {
    if (words[i].text.includes(']')) {
      bracketEnd = i;
      break;
    }
  }

  if (bracketEnd === -1) {
    return {
      words: words.filter(w => w.text !== '|'),
      colophonInfo: null,
    };
  }

  // Build result
  const resultWords: ParsedWord[] = [];
  let colophonStartPos: number | null = null;
  let colophonEndPos: number | null = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Skip pipes
    if (word.text === '|') continue;

    // Clean brackets
    word.text = word.text.replace(/[\[\]]/g, '');

    // Flag colophon words
    if (i >= bracketStart && i <= bracketEnd) {
      word.metadata.colophon = true;
      word.metadata.colophon_type = 'subscription';
      if (colophonStartPos === null) {
        colophonStartPos = resultWords.length + 1;
      }
    }

    resultWords.push(word);

    if (i === bracketEnd) {
      colophonEndPos = resultWords.length;
    }
  }

  // Renumber positions
  resultWords.forEach((w, idx) => {
    w.position = idx + 1;
  });

  const colophonInfo = colophonStartPos ? {
    word_range: [colophonStartPos, colophonEndPos],
    type: 'subscription',
  } : null;

  return { words: resultWords, colophonInfo };
}

async function saveVerse(book: string, chapter: number, verse: number, words: ParsedWord[], colophonInfo: Record<string, unknown> | null): Promise<void> {
  const verseDir = join(DATA_DIR, book, String(chapter));
  await mkdir(verseDir, { recursive: true });

  const wordEntries: WordEntry[] = words.map(w => ({
    position: w.position,
    text: w.text,
    lemma: w.lemma || null,
    morph: w.morph || null,
    strongs: w.strongs,
    metadata: w.metadata,
    gematria: computeGreek(w.text),
  }));

  // Calculate gematria excluding colophon words
  const totals: Record<string, number> = {};
  for (const entry of wordEntries) {
    if (!entry.metadata.colophon) {
      for (const [k, v] of Object.entries(entry.gematria)) {
        totals[k] = (totals[k] || 0) + v;
      }
    }
  }

  let text = wordEntries.map(w => w.text).join(' ');
  text = text.replace(/\s+([,.;:!?])/g, '$1');

  const data: VerseData = {
    text,
    words: wordEntries,
    gematria: totals,
  };

  if (colophonInfo) {
    data.metadata = {
      has_colophon: true,
      colophon_word_range: colophonInfo.word_range,
      colophon_type: colophonInfo.type,
    };
  }

  const filePath = join(verseDir, `${verse}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function saveMetadata(): Promise<void> {
  const metadata = {
    abbreviation: 'TR',
    name: 'Textus Receptus (Robinson)',
    language: 'Greek',
    license: 'Public Domain',
    source: 'byztxt',
    urls: ['https://github.com/byztxt/greektext-textus-receptus'],
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    join(DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
}

async function main(): Promise<void> {
  console.log('ByzTxt Textus Receptus Importer');
  console.log('================================\n');

  try {
    await downloadAndExtract();

    const files = await readdir(PARSED_DIR);
    const utrFiles = files.filter(f => f.endsWith('.UTR')).sort();

    console.log(`  → Processing ${utrFiles.length} books...`);
    let totalVerses = 0;

    for (let i = 0; i < utrFiles.length; i++) {
      const fileName = utrFiles[i];
      const bookKey = fileName.replace('.UTR', '');
      const book = BOOK_MAP[bookKey];

      if (!book) continue;

      if ((i + 1) % 5 === 1 || i === utrFiles.length - 1) {
        console.log(`  → Processing ${i + 1}/${utrFiles.length}: ${book}`);
      }

      const content = await readFile(join(PARSED_DIR, fileName), 'utf-8');
      const verses = parseUtrFile(content, book);

      for (const v of verses) {
        const { words, colophonInfo } = detectAndFlagColophon(v.words);
        await saveVerse(book, v.chapter, v.verse, words, colophonInfo);
        totalVerses++;
      }
    }

    await saveMetadata();

    console.log(`\n✓ Successfully imported ${totalVerses} verses to ${DATA_DIR}`);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
