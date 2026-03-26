import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Simulates the placeholder mapping logic from InitializePlugin
 * Maps translation placeholders to their corresponding source positions
 */
function mapTranslationPlaceholdersToSource(sourceItems, translationItems) {
  // Build a list of source placeholders with their positions
  const sourcePlaceholders = [];
  let sourceIndex = 0;
  sourceItems.forEach(item => {
    if (typeof item !== 'string') {
      sourcePlaceholders.push({ item, index: sourceIndex });
      sourceIndex++;
    }
  });

  // Map translation placeholders
  const mappedIndices = [];
  let currentPosition = 0;

  translationItems.forEach(item => {
    if (typeof item !== 'string') {
      // Find the matching source placeholder
      let index = currentPosition;

      if (sourcePlaceholders.length > 0) {
        // For handling duplicates, find and remove the first matching item
        const matchIndex = sourcePlaceholders.findIndex(sp =>
          sp.item.v === item.v &&
          sp.item.t === item.t
        );

        if (matchIndex !== -1) {
          index = sourcePlaceholders[matchIndex].index;
          sourcePlaceholders.splice(matchIndex, 1);
        }
      }

      mappedIndices.push(index);
      currentPosition++;
    }
  });

  return mappedIndices;
}

/**
 * Converts 0-based indices to 1-based display numbers
 */
function getDisplayNumbers(indices) {
  return indices.map(i => i + 1);
}

describe('Placeholder Mapping Logic', () => {
  test('source placeholders use position-based numbering', () => {
    const source = [
      'Text before ',
      { v: '{0}', t: 'x' },
      ' middle ',
      { v: '{1}', t: 'x' },
      ' end'
    ];

    // Extract source placeholder indices
    const indices = [];
    let index = 0;
    source.forEach(item => {
      if (typeof item !== 'string') {
        indices.push(index);
        index++;
      }
    });

    assert.deepEqual(indices, [0, 1]);
    assert.deepEqual(getDisplayNumbers(indices), [1, 2]);
  });

  test('translation placeholders map to source positions', () => {
    const source = [
      { v: '{0}', t: 'x', s: 'hours' },
      { v: '{1}', t: 'x', s: 'from city' },
      { v: '{2}', t: 'x', s: 'to city' }
    ];

    // Translation reorders them: {1}, {2}, {0}
    const translation = [
      { v: '{1}', t: 'x', s: 'from city' },
      { v: '{2}', t: 'x', s: 'to city' },
      { v: '{0}', t: 'x', s: 'hours' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [1, 2, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [2, 3, 1]);
  });

  test('handles placeholders without numeric values in v field', () => {
    const source = [
      { v: '<b>', t: 'bx' },
      { v: '<i>', t: 'bx' },
      { v: '</b>', t: 'ex' },
      { v: '</i>', t: 'ex' }
    ];

    // Translation reorders tags
    const translation = [
      { v: '<i>', t: 'bx' },
      { v: '<b>', t: 'bx' },
      { v: '</b>', t: 'ex' },
      { v: '</i>', t: 'ex' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // <i> is at position 1, <b> at 0, </b> at 2, </i> at 3
    assert.deepEqual(indices, [1, 0, 2, 3]);
    assert.deepEqual(getDisplayNumbers(indices), [2, 1, 3, 4]);
  });

  test('handles duplicate placeholders correctly', () => {
    const source = [
      { v: '<b>', t: 'bx' },  // First bold open - index 0
      { v: '</b>', t: 'ex' }, // First bold close - index 1
      { v: '<b>', t: 'bx' },  // Second bold open - index 2
      { v: '</b>', t: 'ex' }  // Second bold close - index 3
    ];

    const translation = [
      { v: '<b>', t: 'bx' },  // Should map to first <b> (index 0)
      { v: '<b>', t: 'bx' },  // Should map to second <b> (index 2)
      { v: '</b>', t: 'ex' }, // Should map to first </b> (index 1)
      { v: '</b>', t: 'ex' }  // Should map to second </b> (index 3)
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [0, 2, 1, 3]);
    assert.deepEqual(getDisplayNumbers(indices), [1, 3, 2, 4]);
  });

  test('handles mixed placeholder types', () => {
    const source = [
      { v: '{0}', t: 'x' },
      { v: '<b>', t: 'bx' },
      { v: '{1}', t: 'x' },
      { v: '</b>', t: 'ex' },
      { v: '<i>', t: 'bx' },
      { v: '</i>', t: 'ex' }
    ];

    const translation = [
      { v: '<b>', t: 'bx' },
      { v: '<i>', t: 'bx' },
      { v: '{1}', t: 'x' },
      { v: '</i>', t: 'ex' },
      { v: '</b>', t: 'ex' },
      { v: '{0}', t: 'x' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // <b> at 1, <i> at 4, {1} at 2, </i> at 5, </b> at 3, {0} at 0
    assert.deepEqual(indices, [1, 4, 2, 5, 3, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [2, 5, 3, 6, 4, 1]);
  });

  test('handles missing placeholders in translation', () => {
    const source = [
      { v: '{0}', t: 'x' },
      { v: '{1}', t: 'x' },
      { v: '{2}', t: 'x' }
    ];

    // Translation missing {1}
    const translation = [
      { v: '{2}', t: 'x' },
      { v: '{0}', t: 'x' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [2, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [3, 1]);
  });

  test('handles extra placeholders in translation', () => {
    const source = [
      { v: '{0}', t: 'x' },
      { v: '{1}', t: 'x' }
    ];

    // Translation has an extra placeholder not in source
    const translation = [
      { v: '{1}', t: 'x' },
      { v: '{99}', t: 'x' },  // Not in source
      { v: '{0}', t: 'x' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // {1} maps to 1, {99} falls back to position (1), {0} maps to 0
    assert.deepEqual(indices, [1, 1, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [2, 2, 1]);
  });

  test('handles duplicate tags with different types correctly', () => {
    const source = [
      { v: 'span', t: 'bx' },  // Opening span
      { v: 'span', t: 'ex' },  // Closing span
      { v: 'span', t: 'bx' },  // Another opening span
      { v: 'span', t: 'ex' }   // Another closing span
    ];

    const translation = [
      { v: 'span', t: 'bx' },  // Should map to first opening (0)
      { v: 'span', t: 'bx' },  // Should map to second opening (2)
      { v: 'span', t: 'ex' },  // Should map to first closing (1)
      { v: 'span', t: 'ex' }   // Should map to second closing (3)
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [0, 2, 1, 3]);
    assert.deepEqual(getDisplayNumbers(indices), [1, 3, 2, 4]);
  });

  test('preserves order when translation matches source exactly', () => {
    const source = [
      { v: 'a', t: 'x' },
      { v: 'b', t: 'x' },
      { v: 'c', t: 'x' },
      { v: 'd', t: 'x' }
    ];

    const translation = [
      { v: 'a', t: 'x' },
      { v: 'b', t: 'x' },
      { v: 'c', t: 'x' },
      { v: 'd', t: 'x' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [0, 1, 2, 3]);
    assert.deepEqual(getDisplayNumbers(indices), [1, 2, 3, 4]);
  });

  test('handles completely reversed translation', () => {
    const source = [
      { v: 'first', t: 'x' },
      { v: 'second', t: 'x' },
      { v: 'third', t: 'x' }
    ];

    const translation = [
      { v: 'third', t: 'x' },
      { v: 'second', t: 'x' },
      { v: 'first', t: 'x' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, [2, 1, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [3, 2, 1]);
  });
});

describe('Real-world Scenarios', () => {
  test('flight delay notification', () => {
    const source = [
      "We've detected a delay of more than ",
      { v: '{0}', t: 'x', s: '2' },
      " hours for your flight from ",
      { v: '{1}', t: 'x', s: 'Mexico City' },
      " to ",
      { v: '{2}', t: 'x', s: 'Monterrey' },
      "."
    ];

    const translation = [
      "เราตรวจพบว่าเที่ยวบินของคุณจาก ",
      { v: '{1}', t: 'x', s: 'Mexico City' },
      " ไปยัง ",
      { v: '{2}', t: 'x', s: 'Monterrey' },
      " ล่าช้ากว่า ",
      { v: '{0}', t: 'x', s: '2' },
      " ชั่วโมง"
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // {1} is at index 1, {2} at index 2, {0} at index 0 in source
    assert.deepEqual(indices, [1, 2, 0]);
    assert.deepEqual(getDisplayNumbers(indices), [2, 3, 1]);
  });

  test('HTML content with multiple formatting tags', () => {
    const source = [
      "This is ",
      { v: '<b>', t: 'bx' },
      "bold and ",
      { v: '<i>', t: 'bx' },
      "italic",
      { v: '</i>', t: 'ex' },
      { v: '</b>', t: 'ex' },
      " text with ",
      { v: '<u>', t: 'bx' },
      "underline",
      { v: '</u>', t: 'ex' },
      "."
    ];

    // Translation with reordered tags
    const translation = [
      "Questo è testo ",
      { v: '<u>', t: 'bx' },
      "sottolineato",
      { v: '</u>', t: 'ex' },
      " e ",
      { v: '<b>', t: 'bx' },
      { v: '<i>', t: 'bx' },
      "corsivo grassetto",
      { v: '</i>', t: 'ex' },
      { v: '</b>', t: 'ex' },
      "."
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // Source positions: <b>=0, <i>=1, </i>=2, </b>=3, <u>=4, </u>=5
    // Translation order: <u>=4, </u>=5, <b>=0, <i>=1, </i>=2, </b>=3
    assert.deepEqual(indices, [4, 5, 0, 1, 2, 3]);
    assert.deepEqual(getDisplayNumbers(indices), [5, 6, 1, 2, 3, 4]);
  });

  test('complex nested tags with duplicates', () => {
    const source = [
      { v: '<p>', t: 'bx' },
      { v: '<b>', t: 'bx' },
      { v: '</b>', t: 'ex' },
      { v: '<b>', t: 'bx' },
      { v: '</b>', t: 'ex' },
      { v: '</p>', t: 'ex' }
    ];

    const translation = [
      { v: '<p>', t: 'bx' },
      { v: '<b>', t: 'bx' },
      { v: '<b>', t: 'bx' },
      { v: '</b>', t: 'ex' },
      { v: '</b>', t: 'ex' },
      { v: '</p>', t: 'ex' }
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // <p>=0, first <b>=1, second <b>=3, first </b>=2, second </b>=4, </p>=5
    assert.deepEqual(indices, [0, 1, 3, 2, 4, 5]);
    assert.deepEqual(getDisplayNumbers(indices), [1, 2, 4, 3, 5, 6]);
  });
});

describe('Edge Cases', () => {
  test('empty source and translation', () => {
    const indices = mapTranslationPlaceholdersToSource([], []);
    assert.deepEqual(indices, []);
    assert.deepEqual(getDisplayNumbers(indices), []);
  });

  test('only text content, no placeholders', () => {
    const source = ['Hello world'];
    const translation = ['Bonjour le monde'];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, []);
    assert.deepEqual(getDisplayNumbers(indices), []);
  });

  test('source has placeholders but translation has none', () => {
    const source = [
      'Text ',
      { v: '{0}', t: 'x' },
      ' more'
    ];
    const translation = ['Translated text'];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    assert.deepEqual(indices, []);
    assert.deepEqual(getDisplayNumbers(indices), []);
  });

  test('translation has placeholders but source has none', () => {
    const source = ['Plain text'];
    const translation = [
      'Text ',
      { v: '{0}', t: 'x' },
      ' added'
    ];

    const indices = mapTranslationPlaceholdersToSource(source, translation);
    // Falls back to position-based indexing
    assert.deepEqual(indices, [0]);
    assert.deepEqual(getDisplayNumbers(indices), [1]);
  });
});