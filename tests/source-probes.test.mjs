import assert from 'node:assert/strict';
import test from 'node:test';
import { format } from 'prettier';
import { sourceFunctions, aliasSourceImport } from './helpers/source.mjs';

test('function probes survive formatting without including adjacent side effects', async () => {
  const source = `const decoy='function first() {}';/* function first() {} */function first( value : number ){return value+1;}explode();async function second(){return first(2);}`;
  for (const code of [source, await format(source, { parser: 'typescript', printWidth: 30 })]) {
    const selected = sourceFunctions(code, ['first', 'second']);
    assert.match(selected, /return value\s*\+\s*1/);
    assert.match(selected, /return first\(2\)/);
    assert.doesNotMatch(selected, /explode|decoy/);
    assert.throws(() => sourceFunctions(code, ['missing']), /Expected one/);
  }
  assert.throws(() => sourceFunctions('function a(){} function a(){}', ['a']), /Expected one/);
});
test('import probes match module and binding rather than quotes or spacing', async () => {
  const source = `import {other, chooseTextReference} from './text-reference-ui';const text='chooseTextReference';`;
  for (const code of [source, await format(source, { parser: 'typescript', singleQuote: false, printWidth: 25 })]) {
    const aliased = aliasSourceImport(code, './text-reference-ui', 'chooseTextReference', 'realChooseTextReference');
    assert.match(aliased, /chooseTextReference as realChooseTextReference/);
    assert.match(aliased, /const text =?\s*['"]chooseTextReference['"]|const text=['"]chooseTextReference['"]/);
    assert.throws(() => aliasSourceImport(code, './wrong', 'chooseTextReference', 'real'), /Expected one import/);
  }
});
