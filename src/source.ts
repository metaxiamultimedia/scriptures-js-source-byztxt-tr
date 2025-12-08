/**
 * Source configuration and data loading for byztxt-TR.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, readdir } from 'fs/promises';
import type { EditionMetadata, VerseData } from '@metaxia/scriptures-core';

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'data', 'byztxt-TR');
const CACHE_PATH = join(__dirname, '..', 'cache');

/**
 * Edition metadata.
 */
export const metadata: EditionMetadata = {
  abbreviation: 'byztxt-TR',
  name: 'Byzantine Textus Receptus',
  language: 'Greek',
  license: 'Public Domain',
  source: 'Byzantine Text Project',
  urls: ['https://byztxt.com/'],
};

/**
 * Source information for registration.
 */
export const sourceInfo = {
  edition: 'byztxt-TR',
  metadata,
  dataPath: DATA_PATH,
  cachePath: CACHE_PATH,
};

/**
 * New Testament book name to OSIS mapping.
 */
const BOOK_TO_OSIS: Record<string, string> = {
  'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
  'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
  '1 Thessalonians': '1Thess', '2 Thessalonians': '2Thess', '1 Timothy': '1Tim',
  '2 Timothy': '2Tim', 'Titus': 'Titus', 'Philemon': 'Phlm', 'Hebrews': 'Heb',
  'James': 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet', '1 John': '1John',
  '2 John': '2John', '3 John': '3John', 'Jude': 'Jude', 'Revelation': 'Rev',
};

/**
 * Convert book name to directory name (OSIS format).
 */
function toOsis(book: string): string {
  return BOOK_TO_OSIS[book] || book;
}

/**
 * Load a single verse.
 */
export async function loadVerse(book: string, chapter: number, verse: number): Promise<VerseData> {
  const osisBook = toOsis(book);
  const filePath = join(DATA_PATH, osisBook, String(chapter), `${verse}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Verse ${book} ${chapter}:${verse} not found in byztxt-TR`);
  }
}

/**
 * Load all verses in a chapter.
 */
export async function loadChapter(book: string, chapter: number): Promise<VerseData[]> {
  const osisBook = toOsis(book);
  const chapterPath = join(DATA_PATH, osisBook, String(chapter));

  try {
    const files = await readdir(chapterPath);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort((a, b) => {
      const numA = parseInt(a.replace('.json', ''), 10);
      const numB = parseInt(b.replace('.json', ''), 10);
      return numA - numB;
    });

    const verses: VerseData[] = [];
    for (const file of jsonFiles) {
      const content = await readFile(join(chapterPath, file), 'utf-8');
      verses.push(JSON.parse(content));
    }
    return verses;
  } catch (error) {
    throw new Error(`Chapter ${book} ${chapter} not found in byztxt-TR`);
  }
}

/**
 * Load cache data.
 */
export async function loadCache(cacheName: string): Promise<Record<string, unknown>> {
  const filePath = join(CACHE_PATH, `${cacheName}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Cache '${cacheName}' not found`);
  }
}

/**
 * List available books (New Testament only).
 */
export function listBooks(): string[] {
  return Object.keys(BOOK_TO_OSIS);
}
