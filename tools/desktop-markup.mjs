import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/** One source reader for the desktop build and DOM tests; no runtime templating. */
export function readWorkspaceMarkup(root = process.cwd()) {
  const sourceRoot = realpathSync(path.join(root, 'src/app'));
  const seen = new Set();
  function read(filename, chain = []) {
    const label = path.relative(root, filename);
    if (!filename.endsWith('.html')) throw Error(`${label}: expected an HTML fragment`);
    let actual;
    try {
      actual = realpathSync(filename);
    } catch (error) {
      throw Error(`${label}: cannot read workspace fragment (${error.code})`);
    }
    if (!actual.startsWith(sourceRoot + path.sep))
      throw Error(`${label}: workspace fragment must stay inside src/app`);
    if (chain.includes(actual)) throw Error(`${label}: cyclic workspace include`);
    if (seen.has(actual)) throw Error(`${label}: duplicate workspace include`);
    seen.add(actual);
    const text = readFileSync(actual, 'utf8');
    return text.replace(/<!--\s*workspace:[\s\S]*?-->/g, (marker, offset) => {
      const location = `${label}:${text.slice(0, offset).split('\n').length}`;
      const match = /^<!--\s*workspace:include\s+([^\s]+)\s*-->$/.exec(marker);
      if (!match) throw Error(`${location}: invalid workspace include marker`);
      const reference = match[1];
      if (path.isAbsolute(reference) || /[:\\?#]/.test(reference))
        throw Error(`${location}: expected a relative local HTML path`);
      try {
        return read(path.resolve(path.dirname(actual), reference), [...chain, actual]).trimEnd();
      } catch (error) {
        throw Error(`${location}: ${error.message}`);
      }
    });
  }
  const result = read(path.join(sourceRoot, 'workspace/index.html'));
  if (/<!--\s*workspace:/.test(result)) throw Error('Unclosed workspace include marker');
  return result;
}
