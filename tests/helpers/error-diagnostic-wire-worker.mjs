import { parentPort, workerData } from 'node:worker_threads';
import { appendFileSync } from 'node:fs';
// A malformed result exercises the real client's decoding boundary.
parentPort.on('message', (message) => {
  if (message.kind === 'close') {
    parentPort.postMessage({ kind: 'closed' });
    parentPort.close();
    return;
  }
  appendFileSync(workerData.filename + '.attempts', 'write\n');
  parentPort.postMessage({
    kind: 'result',
    id: message.id,
    value: { value: { bytes: 'not bytes' }, buffers: [['bytes']] },
  });
});
parentPort.postMessage({ kind: 'ready' });
