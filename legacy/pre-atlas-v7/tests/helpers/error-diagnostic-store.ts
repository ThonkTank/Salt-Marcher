import { appendFileSync } from 'node:fs';
function failure() {
  const root = Object.assign(new TypeError('Root detail'), { code: 'ROOT_CODE' });
  return Object.assign(new Error('Canonical rejection', { cause: root }), {
    name: 'FixtureStoreError',
    code: 'STORE_CODE',
  });
}
/** Controlled storage boundary; the real worker dispatcher and client remain in use. */
export class CampaignStore {
  constructor(
    private filename: string,
    private version: string,
  ) {
    if (version === 'startup-error') throw failure();
  }
  create(mode: string) {
    if (mode === 'reject') throw failure();
    if (mode === 'string') throw 'plain rejection';
    if (mode === 'hostile')
      throw {
        toString() {
          throw Error('do not call');
        },
      };
    appendFileSync(this.filename + '.attempts', 'write\n');
    if (mode === 'unserializable') return () => {};
    if (mode === 'exit') process.exit(23);
    return { id: 'fixture', name: mode };
  }
  list() {
    return { campaigns: [] };
  }
  close() {
    if (this.version === 'close-error') throw failure();
  }
}
