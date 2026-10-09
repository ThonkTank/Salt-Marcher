import { parseArgs } from 'node:util';

// The shared RFB transport accepts one value per option. Reject ambiguous
// commands before inspecting a session or opening a connection.
export function assertSingleInputOptions(args) {
  const names = ['session', 'shot', 'click', 'move', 'key', 'text', 'drag',
    'wheel', 'button', 'hold', 'drag-key', 'settle-ms', 'click-ms'];
  const { tokens } = parseArgs({ args, tokens: true,
    options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  const seen = new Set();
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name)) throw new Error(`Repeated --${token.name}; use separate RFB calls`);
    seen.add(token.name);
  }
}
