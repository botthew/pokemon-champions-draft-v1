import test from 'node:test';
import assert from 'node:assert/strict';

import { nextPickFromQueue } from '../docs/queue.js';

function mapFromMons(mons) {
  return new Map(mons.map(m => [Number(m.dex), m]));
}

test('picks first available in order', () => {
  const poolByDex = mapFromMons([
    { dex: 1, points: 10 },
    { dex: 2, points: 12 },
  ]);
  const r = nextPickFromQueue([2, 1], { poolByDex, draftedDex: new Set(), remainingBudget: 110, skipInvalid: true });
  assert.equal(r.action, 'pick');
  assert.equal(r.pickDex, 2);
  assert.deepEqual(r.queueAfter, [1]);
});

test('skips unavailable (drafted) by default and picks next', () => {
  const poolByDex = mapFromMons([
    { dex: 1, points: 10 },
    { dex: 2, points: 12 },
  ]);
  const r = nextPickFromQueue([2, 1], { poolByDex, draftedDex: new Set([2]), remainingBudget: 110, skipInvalid: true });
  assert.equal(r.action, 'pick');
  assert.equal(r.pickDex, 1);
  assert.deepEqual(r.removed, [2]);
});

test('stop mode: if top is unavailable, do nothing', () => {
  const poolByDex = mapFromMons([{ dex: 1, points: 10 }]);
  const r = nextPickFromQueue([999, 1], { poolByDex, draftedDex: new Set(), remainingBudget: 110, skipInvalid: false });
  assert.equal(r.action, 'none');
  assert.equal(r.reason, 'unavailable');
  assert.deepEqual(r.queueAfter, [999, 1]);
});

test('skips over-budget entries when skipInvalid=true', () => {
  const poolByDex = mapFromMons([
    { dex: 1, points: 200 },
    { dex: 2, points: 10 },
  ]);
  const r = nextPickFromQueue([1, 2], { poolByDex, draftedDex: new Set(), remainingBudget: 50, skipInvalid: true });
  assert.equal(r.action, 'pick');
  assert.equal(r.pickDex, 2);
  assert.deepEqual(r.removed, [1]);
});

test('stop mode: if top is over budget, do nothing', () => {
  const poolByDex = mapFromMons([
    { dex: 1, points: 200 },
    { dex: 2, points: 10 },
  ]);
  const r = nextPickFromQueue([1, 2], { poolByDex, draftedDex: new Set(), remainingBudget: 50, skipInvalid: false });
  assert.equal(r.action, 'none');
  assert.equal(r.reason, 'over_budget');
});

test('dedupes queue preserving order', () => {
  const poolByDex = mapFromMons([
    { dex: 1, points: 10 },
    { dex: 2, points: 10 },
  ]);
  const r = nextPickFromQueue([1, 1, 2, 2], { poolByDex, draftedDex: new Set(), remainingBudget: 110, skipInvalid: true });
  assert.equal(r.action, 'pick');
  assert.equal(r.pickDex, 1);
  assert.deepEqual(r.queueAfter, [2]);
});
