import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Simulate the placeholder display logic from PlaceholderNode
 * This matches the logic in src/components/editor/nodes/PlaceholderNode.tsx
 */
function getPlaceholderDisplay(placeholderValue, index) {
  // Handle null/undefined values
  if (!placeholderValue) {
    return (index + 1).toString();
  }

  // Extract the number from the placeholder value and add 1 for 1-based indexing
  const match = placeholderValue.match(/\{(\d+)\}/);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return num.toString();
  }
  // Fallback to index + 1 if pattern doesn't match
  return (index + 1).toString();
}

describe('PlaceholderNode display logic', () => {
  test('displays placeholder {0} as 1', () => {
    const display = getPlaceholderDisplay('{0}', 0);
    assert.equal(display, '1');
  });

  test('displays placeholder {1} as 2', () => {
    const display = getPlaceholderDisplay('{1}', 1);
    assert.equal(display, '2');
  });

  test('displays placeholder {2} as 3', () => {
    const display = getPlaceholderDisplay('{2}', 2);
    assert.equal(display, '3');
  });

  test('handles non-standard placeholder format with fallback', () => {
    const display = getPlaceholderDisplay('CUSTOM_PLACEHOLDER', 5);
    assert.equal(display, '6'); // Falls back to index + 1
  });

  test('correctly displays reordered placeholders in translation', () => {
    // When translation has placeholders in order: {2}, {0}, {1}
    // They should display as: 3, 1, 2
    const placeholders = [
      { value: '{2}', index: 0 },
      { value: '{0}', index: 1 },
      { value: '{1}', index: 2 }
    ];

    const displays = placeholders.map(p => getPlaceholderDisplay(p.value, p.index));
    assert.deepEqual(displays, ['3', '1', '2']);
  });

  test('handles companion JSON with reordered placeholders', () => {
    // When companion JSON has placeholders: {1}, {2}, {0}
    // They should display as: 2, 3, 1
    const placeholders = [
      { value: '{1}', index: 0 },
      { value: '{2}', index: 1 },
      { value: '{0}', index: 2 }
    ];

    const displays = placeholders.map(p => getPlaceholderDisplay(p.value, p.index));
    assert.deepEqual(displays, ['2', '3', '1']);
  });

  test('real-world scenario: flight delay notification placeholders', () => {
    // Job.json placeholder definitions:
    // {0}: Amount of delay time in hours
    // {1}: Departure city (Mexico City)
    // {2}: Arrival city (Monterrey)

    // Translation has reordered them to: {2}, {0}, {1}
    // This means: "arrival city", "delay hours", "departure city"
    const translationPlaceholders = [
      { value: '{2}', index: 0, desc: 'Arrival city' },
      { value: '{0}', index: 1, desc: 'Delay hours' },
      { value: '{1}', index: 2, desc: 'Departure city' }
    ];

    const displays = translationPlaceholders.map(p => getPlaceholderDisplay(p.value, p.index));

    // Should display as 3, 1, 2 to indicate which original placeholder each one is
    assert.deepEqual(displays, ['3', '1', '2']);

    // Verify each displays the correct identity
    assert.equal(displays[0], '3', 'First position should show placeholder 3 (arrival city)');
    assert.equal(displays[1], '1', 'Second position should show placeholder 1 (delay hours)');
    assert.equal(displays[2], '2', 'Third position should show placeholder 2 (departure city)');
  });

  test('maintains placeholder identity regardless of position', () => {
    // Test multiple reorderings to ensure consistency
    const testCases = [
      {
        order: ['{0}', '{1}', '{2}'],
        expected: ['1', '2', '3'],
        description: 'Original order'
      },
      {
        order: ['{2}', '{0}', '{1}'],
        expected: ['3', '1', '2'],
        description: 'Rotated order'
      },
      {
        order: ['{1}', '{2}', '{0}'],
        expected: ['2', '3', '1'],
        description: 'Different rotation'
      },
      {
        order: ['{2}', '{1}', '{0}'],
        expected: ['3', '2', '1'],
        description: 'Reversed order'
      }
    ];

    testCases.forEach(testCase => {
      const displays = testCase.order.map((value, index) =>
        getPlaceholderDisplay(value, index)
      );
      assert.deepEqual(
        displays,
        testCase.expected,
        `Failed for ${testCase.description}: expected ${testCase.expected.join(', ')} but got ${displays.join(', ')}`
      );
    });
  });

  test('handles mixed placeholder types', () => {
    // Some placeholders might not match the {n} pattern
    const placeholders = [
      { value: '{0}', index: 0 },
      { value: 'CUSTOM', index: 1 },
      { value: '{2}', index: 2 },
      { value: '{invalid}', index: 3 }
    ];

    const displays = placeholders.map(p => getPlaceholderDisplay(p.value, p.index));

    // {0} -> 1, CUSTOM -> fallback to index+1 (2), {2} -> 3, {invalid} -> fallback (4)
    assert.deepEqual(displays, ['1', '2', '3', '4']);
  });

  test('handles edge cases with placeholder values', () => {
    // Test various edge cases
    assert.equal(getPlaceholderDisplay('{10}', 0), '11', 'Double digit placeholder');
    assert.equal(getPlaceholderDisplay('{99}', 0), '100', 'Large placeholder number');
    assert.equal(getPlaceholderDisplay('{}', 5), '6', 'Empty braces falls back to index');
    assert.equal(getPlaceholderDisplay('{abc}', 3), '4', 'Non-numeric content falls back');
    assert.equal(getPlaceholderDisplay(null, 2), '3', 'Null value falls back to index');
    assert.equal(getPlaceholderDisplay(undefined, 1), '2', 'Undefined falls back to index');
  });
});