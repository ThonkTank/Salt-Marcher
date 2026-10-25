import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-deck-picking.ts'],
  outfile: '.build/atlas-deck-picking-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { ensureAtlasDeckPickingDepth } = await import('../../.build/atlas-deck-picking-test.mjs');
function buffer(format = 'depth16unorm', color = 'rgba8unorm') {
  const texture = {
    format: color,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  };
  return {
    depthStencilAttachment: { texture: { format } },
    colorAttachments: [{ texture }],
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  };
}
function fixture() {
  const created = [],
    device = {
      isTextureFormatSupported: () => true,
      isTextureFormatRenderable: () => true,
      createFramebuffer(props) {
        const value = buffer(props.depthStencilAttachment, props.colorAttachments[0]);
        value.props = props;
        created.push(value);
        return value;
      },
    };
  const picker = {
    device,
    _resizeBuffer() {},
    pickingFBO: buffer(),
    depthFBO: buffer('depth16unorm', 'rgba32float'),
  };
  return { deck: { deckPicker: picker }, picker, device, created };
}

test('upgrades both picking passes atomically and releases old external color textures', () => {
  const f = fixture(),
    old = [f.picker.pickingFBO, f.picker.depthFBO];
  ensureAtlasDeckPickingDepth(f.deck);
  assert.equal(f.created.length, 2);
  assert.deepEqual(
    f.created.map((b) => b.props.colorAttachments),
    [['rgba8unorm'], ['rgba32float']],
  );
  assert(f.created.every((b) => b.props.depthStencilAttachment === 'depth24plus'));
  assert(old.every((b) => b.destroyed && b.colorAttachments[0].texture.destroyed));
  assert.equal(f.picker.pickingFBO, f.created[0]);
  assert.equal(f.picker.depthFBO, f.created[1]);
  ensureAtlasDeckPickingDepth(f.deck);
  assert.equal(f.created.length, 2);
});

test('allocates before the first Deck pick and does not alter global device methods', () => {
  const f = fixture(),
    factory = f.device.createFramebuffer;
  delete f.picker.pickingFBO;
  delete f.picker.depthFBO;
  ensureAtlasDeckPickingDepth(f.deck);
  assert.equal(f.created.length, 2);
  assert.equal(f.device.createFramebuffer, factory);
});

test('failed allocation preserves usable original buffers and releases only the candidate', () => {
  const f = fixture(),
    old = [f.picker.pickingFBO, f.picker.depthFBO],
    create = f.device.createFramebuffer;
  f.device.createFramebuffer = (props) => {
    if (f.created.length === 1) throw Error('out of GPU memory');
    return create(props);
  };
  assert.throws(() => ensureAtlasDeckPickingDepth(f.deck), /out of GPU memory/);
  assert.equal(f.picker.pickingFBO, old[0]);
  assert.equal(f.picker.depthFBO, old[1]);
  assert(old.every((b) => !b.destroyed));
  assert.equal(f.created[0].destroyed, true);
});

test('missing capabilities and unknown private contracts fail before resource replacement', () => {
  assert.throws(() => ensureAtlasDeckPickingDepth({}), /contract/);
  const f = fixture();
  f.device.isTextureFormatRenderable = () => false;
  assert.throws(() => ensureAtlasDeckPickingDepth(f.deck), /requires 24-bit/);
  assert.equal(f.created.length, 0);
  f.device.isTextureFormatRenderable = () => true;
  f.picker.pickingFBO = buffer('unknown');
  assert.throws(() => ensureAtlasDeckPickingDepth(f.deck), /framebuffer format/);
  assert.equal(f.created.length, 0);
});
