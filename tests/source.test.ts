/**
 * Tests for @metaxia/scriptures-source-byztxt-tr
 */

// Import the source package (auto-registers)
import '../src/index.js';

// Import shared test utilities
import { testSourcePackage } from '@metaxia/scriptures-core/tests/shared';

// Run standard source package tests
testSourcePackage(
  'byztxt-TR',
  {
    language: 'Greek',
    license: 'Public Domain',
  },
  {
    book: 'John',
    chapter: 1,
    verse: 1,
    textContains: 'λογος',
  }
);
