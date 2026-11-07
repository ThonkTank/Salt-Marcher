import assert from 'node:assert/strict';
import test from 'node:test';
import { format } from 'prettier';
import { sourceAssignedLiteral } from '../helpers/source.mjs';

test('form probes read the exact literal and reject missing or dynamic markup', async () => {
  const source = 'class Form { mount(){ this.panel.innerHTML=`<p>Kept text</p>`; } }';
  for (const code of [source, await format(source, { parser: 'typescript', printWidth: 30 })]) {
    assert.equal(sourceAssignedLiteral(code, 'this.panel.innerHTML'), '<p>Kept text</p>');
    assert.throws(
      () => sourceAssignedLiteral(code, 'this.other.innerHTML'),
      /Expected one assignment/,
    );
  }
  assert.throws(
    () => sourceAssignedLiteral('this.panel.innerHTML=`${dynamic}`', 'this.panel.innerHTML'),
    /Expected literal markup/,
  );
  assert.throws(
    () =>
      sourceAssignedLiteral(
        'this.panel.innerHTML="a";this.panel.innerHTML="b"',
        'this.panel.innerHTML',
      ),
    /Expected one assignment/,
  );
});
