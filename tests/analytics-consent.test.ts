import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ANALYTICS_CONSENT_KEY,
  CONSENT_MAX_AGE,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from '../src/analytics-consent';

const now = Date.UTC(2026, 8, 11);
test('analytics consent requires an explicit boolean and expires after a year', () => {
  for (const allowed of [true, false]) {
    const record = { version: 1, allowed, savedAt: now - 1000 };
    assert.deepEqual(readAnalyticsConsent({ getItem: () => JSON.stringify(record) }, now), record);
  }
  for (const value of [
    'broken',
    'null',
    '[]',
    '{}',
    JSON.stringify({ version: 1, allowed: 'true', savedAt: now }),
    JSON.stringify({ version: 2, allowed: true, savedAt: now }),
    JSON.stringify({ version: 1, allowed: true, savedAt: now + 1 }),
    JSON.stringify({
      version: 1,
      allowed: true,
      savedAt: now - CONSENT_MAX_AGE,
    }),
  ])
    assert.equal(readAnalyticsConsent({ getItem: () => value }, now), null);
});
test('blocked consent storage fails closed and saving never touches notebook progress', () => {
  assert.equal(
    readAnalyticsConsent({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
    null,
  );
  const record = { version: 1 as const, allowed: false, savedAt: now };
  assert.equal(
    saveAnalyticsConsent(
      {
        setItem: () => {
          throw new Error('quota');
        },
      },
      record,
    ),
    false,
  );
  let saved: [string, string] | undefined;
  assert.equal(
    saveAnalyticsConsent(
      {
        setItem: (key, value) => {
          saved = [key, value];
        },
      },
      record,
    ),
    true,
  );
  assert.deepEqual(saved, [ANALYTICS_CONSENT_KEY, JSON.stringify(record)]);
});
