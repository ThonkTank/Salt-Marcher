import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertPackageSource } from '../../tools/release-desktop.mjs';

const { schema } = JSON.parse(readFileSync('src/app/data-format.json', 'utf8'));
const info = {
  applicationVersion: '1.2.3',
  commit: 'qualified-source',
  product: 'saltmarcher-workbench',
  schema: { min: schema, max: schema, target: schema },
};
test('release package accepts the canonical data format without inspecting Store source text', () => {
  assert.doesNotThrow(() => assertPackageSource(info, '1.2.3', 'qualified-source', schema));
});
for (const change of [
  { applicationVersion: '1.2.2' },
  { commit: 'other-source' },
  { product: 'old-saltmarcher' },
])
  test(`release package rejects a different ${Object.keys(change)[0]}`, () => {
    assert.throws(
      () => assertPackageSource({ ...info, ...change }, '1.2.3', 'qualified-source', schema),
      /Releasequellstand/,
    );
  });
for (const invalid of [NaN, undefined, 0, -1, 1.5, String(schema)])
  test(`release rejects invalid canonical schema ${String(invalid)}`, () => {
    assert.throws(
      () => assertPackageSource(info, '1.2.3', 'qualified-source', invalid),
      /Formatdeklaration/,
    );
  });
for (const boundary of [
  undefined,
  { target: schema + 1, max: schema },
  { target: schema, max: schema + 1 },
])
  test(`release rejects mismatched package boundaries ${JSON.stringify(boundary)}`, () => {
    assert.throws(
      () => assertPackageSource({ ...info, schema: boundary }, '1.2.3', 'qualified-source', schema),
      /Formatdeklaration/,
    );
  });
