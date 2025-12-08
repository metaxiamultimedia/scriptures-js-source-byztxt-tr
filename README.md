# @metaxia/scriptures-source-byztxt-tr

Byzantine Textus Receptus (Greek) data for [@metaxia/scriptures](https://github.com/metaxiamultimedia/scriptures-js).

## Source

[Byzantine Text Project](https://byztxt.com/)

## Installation

```bash
npm install @metaxia/scriptures @metaxia/scriptures-source-byztxt-tr
```

## Usage

### Auto-Registration

```typescript
// Import to auto-register with @metaxia/scriptures
import '@metaxia/scriptures-source-byztxt-tr';

import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('John', 1, 1, { edition: 'byztxt-TR' });
console.log(verse.text);
// "εν αρχη ην ο λογος και ο λογος ην προς τον θεον και θεος ην ο λογος"
```

### Granular Imports

Import specific portions for smaller bundle sizes:

```typescript
// Single verse
import verse from '@metaxia/scriptures-source-byztxt-tr/books/John/1/1';

// Entire chapter
import chapter from '@metaxia/scriptures-source-byztxt-tr/books/John/1';

// Entire book
import john from '@metaxia/scriptures-source-byztxt-tr/books/John';

// Raw JSON data
import verseData from '@metaxia/scriptures-source-byztxt-tr/data/John/1/1.json';

// Edition metadata
import metadata from '@metaxia/scriptures-source-byztxt-tr/metadata';
```

### Lazy Loading

```typescript
// Register without loading data
import '@metaxia/scriptures-source-byztxt-tr/register';

import { getVerse } from '@metaxia/scriptures';

// Data loads on demand
const verse = await getVerse('John', 1, 1, { edition: 'byztxt-TR' });
```

## Contents

- **Edition**: byztxt-TR
- **Language**: Greek
- **Books**: 27 (Matthew–Revelation)
- **Features**: Morphological tagging, colophon handling

## Data Format

Each verse includes morphological annotations:

```json
{
  "id": "byztxt-TR:John.1.1",
  "text": "εν αρχη ην ο λογος και ο λογος ην προς τον θεον και θεος ην ο λογος",
  "words": [
    {
      "position": 1,
      "text": "εν",
      "morph": "PREP"
    }
  ],
  "gematria": {
    "standard": 3627
  }
}
```

## Colophons

This edition preserves scribal notes (colophons) found at the end of some epistles. Colophon words are marked in metadata:

```json
{
  "text": "... αμην προς τιμοθεον ...",
  "words": [
    { "position": 13, "text": "αμην", "metadata": {} },
    { "position": 14, "text": "προς", "metadata": { "colophon": true } }
  ],
  "metadata": {
    "has_colophon": true,
    "colophon_word_range": [14, 33]
  }
}
```

Verse-level gematria excludes colophon words (original text only).

```typescript
import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('2Timothy', 4, 22, { edition: 'byztxt-TR' });

// Get original words only
const originalWords = verse.words.filter(w => !w.metadata?.colophon);

// Get colophon words
const colophonWords = verse.words.filter(w => w.metadata?.colophon);
```

## License

Public Domain

The Byzantine Textus Receptus text is in the public domain.
