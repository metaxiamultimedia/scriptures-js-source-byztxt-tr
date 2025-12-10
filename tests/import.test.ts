/**
 * Tests for the byztxt import script parsing logic.
 */

import { describe, it, expect } from 'vitest';
import { computeGreek } from '@metaxia/scriptures-core';

// Transliteration mapping from byztxt Latin to Greek
const LATIN_TO_GREEK: Record<string, string> = {
  'a': 'α', 'b': 'β', 'g': 'γ', 'd': 'δ', 'e': 'ε', 'z': 'ζ',
  'h': 'η', 'q': 'θ', 'i': 'ι', 'k': 'κ', 'l': 'λ', 'm': 'μ',
  'n': 'ν', 'j': 'ξ', 'o': 'ο', 'p': 'π', 'r': 'ρ', 's': 'σ',
  't': 'τ', 'u': 'υ', 'f': 'φ', 'c': 'χ', 'y': 'ψ', 'w': 'ω',
  'v': 'ς',
};

function transliterateToGreek(text: string): string {
  let result = '';
  for (const char of text) {
    result += LATIN_TO_GREEK[char] || char;
  }
  return result;
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

/**
 * Parse a UTR file content into verses.
 * This is a copy of the parseUtrFile function from import.ts for testing.
 */
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
    if (/^\d+$/.test(tok)) {
      // Consume the morph tag if present
      if (i + 1 < tokens.length && tokens[i + 1].startsWith('{')) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    const word = tok;
    i++;

    let lemma: string | undefined;
    if (i < tokens.length && /^\d+$/.test(tokens[i])) {
      lemma = tokens[i];
      i++;
      if (i < tokens.length && /^\d+$/.test(tokens[i])) {
        i++;
      }
    }

    let morph: string | undefined;
    if (i < tokens.length && tokens[i].startsWith('{')) {
      morph = tokens[i].replace(/[{}]/g, '');
      i++;
    }

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

  if (chapter !== null && verse !== null && words.length > 0) {
    verses.push({ chapter, verse, words });
  }

  return verses;
}

describe('parseUtrFile', () => {
  describe('bare Strong\'s number handling', () => {
    it('should skip bare Strong\'s numbers with morph tags', () => {
      // Simulate the 1 Corinthians 2:13 source data pattern
      const content = '2:13 pneumatikoiv 4152 {A-DPN} 4152 {A-DPM} pneumatika 4152 {A-APN}';

      const verses = parseUtrFile(content, '1Cor');

      expect(verses).toHaveLength(1);
      expect(verses[0].chapter).toBe(2);
      expect(verses[0].verse).toBe(13);

      // Should have 2 words (pneumatikoiv and pneumatika), not 3
      expect(verses[0].words).toHaveLength(2);

      // Both words should be Greek text, not numbers
      expect(verses[0].words[0].text).toBe('πνευματικοις');
      expect(verses[0].words[1].text).toBe('πνευματικα');

      // No word should have numeric text
      for (const word of verses[0].words) {
        expect(/^\d+$/.test(word.text)).toBe(false);
      }
    });

    it('should skip multiple consecutive bare Strong\'s numbers', () => {
      // Note: 'v' is final sigma (ς) in byztxt transliteration
      const content = '1:1 kai 2532 {CONJ} 3739 {R-NSN} 3778 {D-NSN} logov 3056 {N-NSM}';

      const verses = parseUtrFile(content, 'Test');

      expect(verses[0].words).toHaveLength(2);
      expect(verses[0].words[0].text).toBe('και');
      expect(verses[0].words[1].text).toBe('λογος');
    });

    it('should handle bare Strong\'s number without morph tag', () => {
      // Note: 'v' is final sigma (ς) in byztxt transliteration
      const content = '1:1 kai 2532 {CONJ} 3739 logov 3056 {N-NSM}';

      const verses = parseUtrFile(content, 'Test');

      expect(verses[0].words).toHaveLength(2);
      expect(verses[0].words[0].text).toBe('και');
      expect(verses[0].words[1].text).toBe('λογος');
    });

    it('should handle bare Strong\'s number at end of verse', () => {
      const content = '1:1 kai 2532 {CONJ} 3739 {R-NSN}';

      const verses = parseUtrFile(content, 'Test');

      expect(verses[0].words).toHaveLength(1);
      expect(verses[0].words[0].text).toBe('και');
    });

    it('should not affect normal word + strongs + morph patterns', () => {
      const content = '1:1 paulov 3972 {N-NSM} klhtov 2822 {A-NSM}';

      const verses = parseUtrFile(content, 'Test');

      expect(verses[0].words).toHaveLength(2);

      expect(verses[0].words[0].text).toBe('παυλος');
      expect(verses[0].words[0].lemma).toEqual(['G3972']);
      expect(verses[0].words[0].strongs).toBe('G3972');
      expect(verses[0].words[0].morph).toBe('robinson:N-NSM');

      expect(verses[0].words[1].text).toBe('κλητος');
      expect(verses[0].words[1].lemma).toEqual(['G2822']);
    });

    it('should handle words with parsing numbers (strongs + parsing_num)', () => {
      const content = '1:1 laloumen 2980 5719 {V-PAI-1P}';

      const verses = parseUtrFile(content, 'Test');

      expect(verses[0].words).toHaveLength(1);
      expect(verses[0].words[0].text).toBe('λαλουμεν');
      expect(verses[0].words[0].lemma).toEqual(['G2980']);
      expect(verses[0].words[0].morph).toBe('robinson:V-PAI-1P');
    });
  });
});

describe('computeGreek (from core)', () => {
  describe('ordinal gematria', () => {
    it('should use Greek alphabet positions, not letter position in word', () => {
      // λογος (logos): λ=11, ο=15, γ=3, ο=15, σ=18 → total=62
      // Bug would give: 1+2+3+4+5 = 15
      const result = computeGreek('λογος');
      expect(result.ordinal).toBe(62);
    });

    it('should calculate ordinal for single letters correctly', () => {
      expect(computeGreek('α').ordinal).toBe(1);   // alpha = 1st letter
      expect(computeGreek('β').ordinal).toBe(2);   // beta = 2nd letter
      expect(computeGreek('ω').ordinal).toBe(24);  // omega = 24th letter
    });

    it('should handle final sigma same as regular sigma', () => {
      // Both σ and ς should be position 18
      expect(computeGreek('σ').ordinal).toBe(18);
      expect(computeGreek('ς').ordinal).toBe(18);
    });

    it('should calculate ordinal for θεος (theos) correctly', () => {
      // θεος: θ=8, ε=5, ο=15, σ=18 → total=46
      const result = computeGreek('θεος');
      expect(result.ordinal).toBe(46);
    });

    it('should be case-insensitive', () => {
      const lower = computeGreek('λογος');
      const upper = computeGreek('ΛΟΓΟΣ');
      expect(lower.ordinal).toBe(upper.ordinal);
    });

    it('should ignore non-Greek characters', () => {
      const withPunct = computeGreek('λογος,');
      const plain = computeGreek('λογος');
      expect(withPunct.ordinal).toBe(plain.ordinal);
    });
  });

  describe('standard gematria (isopsephy)', () => {
    it('should calculate standard values correctly', () => {
      // λογος: λ=30, ο=70, γ=3, ο=70, σ=200 → total=373
      const result = computeGreek('λογος');
      expect(result.standard).toBe(373);
    });
  });
});
