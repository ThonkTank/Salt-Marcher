import { wheelZoomFactor } from './atlas-navigation-scale';
import { atlasFieldValue, atlasUnits, FOOT, setAtlasFieldValue } from './atlas-units';

export type BrushSizeMode = 'screen' | 'world';
type Size = { screen: number; world: number; scale: number };
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
export class BrushSizes {
  mode: BrushSizeMode = 'screen';
  private sizes = new Map<string, Size>();
  constructor(saved?: string | null) {
    try {
      const value = JSON.parse(saved ?? 'null');
      if (value?.version !== 1) return;
      this.mode = value.mode === 'world' ? 'world' : 'screen';
      for (const [key, s] of Object.entries(value.sizes ?? {}) as [string, Size][])
        if (s && positive(s.screen) && positive(s.world) && positive(s.scale))
          this.sizes.set(key, { ...s });
    } catch {
      /* Optional preferences never affect campaign data. */
    }
  }
  size(key: string, scale: number): Size {
    if (!positive(scale)) throw Error('Pinselmaßstab prüfen.');
    let s = this.sizes.get(key);
    if (!s) {
      s = { screen: 48, world: 48 * scale, scale };
      this.sizes.set(key, s);
    }
    s.scale = scale;
    if (this.mode === 'screen') s.world = s.screen * scale;
    else s.screen = s.world / scale;
    return s;
  }
  set(key: string, scale: number, value: number) {
    if (!positive(value)) return;
    const s = this.size(key, scale);
    if (this.mode === 'screen') {
      s.screen = Math.max(4, Math.min(200, value));
      s.world = s.screen * scale;
    } else {
      s.world = value;
      s.screen = value / scale;
    }
  }
  setMode(mode: BrushSizeMode) {
    this.mode = mode;
  }
  preset(key: string, scale: number, pixels: number) {
    this.set(key, scale, this.mode === 'screen' ? pixels : pixels * scale);
  }
  serialize() {
    return JSON.stringify({ version: 1, mode: this.mode, sizes: Object.fromEntries(this.sizes) });
  }
}
let shared: BrushSizes | undefined;
function model() {
  if (!shared) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('atlas-brush-sizes-v1');
    } catch {
      /* optional */
    }
    shared = new BrushSizes(saved);
  }
  return shared;
}
const controls = new Set<BrushSizeControl>();
const bindings = new WeakMap<HTMLInputElement, BrushSizeControl>();
export function brushSizeControl(field: HTMLInputElement) {
  return bindings.get(field);
}

/** The original field remains the canonical world-unit adapter for existing commands. */
export class BrushSizeControl {
  readonly root: HTMLLabelElement;
  private caption = document.createElement('span');
  private unit = document.createElement('small');
  private slider = document.createElement('input');
  private number = document.createElement('input');
  private fixed = document.createElement('input');
  private key = '';
  private scale = 1;
  private locked = false;
  constructor(
    readonly field: HTMLInputElement,
    private changed: () => void,
  ) {
    this.root = field.closest('label')!;
    this.root.classList.add('atlas-brush-range', 'atlas-brush-size');
    this.caption.append(document.createTextNode('Radius '), this.unit);
    this.root.replaceChildren(this.caption, field, this.slider, this.number);
    field.hidden = true;
    this.root.title = 'Pinselradius: Shift + Mausrad über der Karte';
    this.slider.type = 'range';
    this.slider.id = field.id + '-slider';
    this.slider.setAttribute('aria-label', 'Pinselradius');
    this.number.type = 'number';
    this.number.step = 'any';
    this.number.id = field.id + '-value';
    this.number.setAttribute('aria-label', 'Pinselradius eingeben');
    const toggle = document.createElement('span');
    toggle.className = 'atlas-brush-fixed';
    this.fixed.type = 'checkbox';
    this.fixed.id = field.id + '-fixed';
    this.fixed.setAttribute('aria-label', 'Feste Kartengröße');
    toggle.append(this.fixed, document.createTextNode(' Feste Kartengröße'));
    this.root.append(toggle);
    toggle.onclick = (e) => {
      if (e.target !== this.fixed) {
        e.preventDefault();
        if (!this.fixed.disabled) this.fixed.click();
      }
    };
    const update = (slider: boolean) => {
      if (this.locked) {
        this.render();
        return;
      }
      const factor = model().mode === 'world' && atlasUnits() === 'dnd' ? FOOT : 1;
      model().set(
        this.key,
        this.scale,
        slider && model().mode === 'world'
          ? 10 ** Number(this.slider.value)
          : Number(slider ? this.slider.value : this.number.value) * factor,
      );
      this.save();
      this.render();
      this.field.dispatchEvent(new Event('brush-size-change'));
      this.changed();
    };
    this.slider.oninput = (e) => {
      e.stopPropagation();
      update(true);
    };
    this.slider.onchange = (e) => e.stopPropagation();
    this.number.onchange = (e) => {
      e.stopPropagation();
      update(false);
    };
    this.number.oninput = (e) => e.stopPropagation();
    this.fixed.oninput = (e) => e.stopPropagation();
    this.fixed.onchange = (e) => {
      e.stopPropagation();
      if ([...controls].some((c) => c.locked)) {
        this.render();
        return;
      }
      for (const c of controls) if (c.key) model().size(c.key, c.scale);
      model().setMode(this.fixed.checked ? 'world' : 'screen');
      this.save();
      for (const c of controls) {
        c.render();
        c.changed();
      }
    };
    bindings.set(field, this);
    controls.add(this);
  }
  sync(key: string, scale: number, locked: boolean) {
    if (!positive(scale)) return;
    if (!this.locked) {
      this.key = key;
      this.scale = scale;
    }
    this.locked = locked;
    this.render();
  }
  preset(pixels: number) {
    if (this.locked) return;
    model().preset(this.key, this.scale, pixels);
    this.save();
    this.render();
    this.changed();
  }
  /** Shift may map a physical vertical wheel to deltaX on some platforms. */
  wheel(event: WheelEvent, height: number): boolean {
    if (!event.shiftKey || !this.key) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.locked) return true;
    const delta = event.deltaY || event.deltaX;
    if (!Number.isFinite(delta) || !delta) return true;
    const m = model(),
      s = m.size(this.key, this.scale),
      value = m.mode === 'world' ? s.world : s.screen;
    m.set(this.key, this.scale, value / wheelZoomFactor(delta, event.deltaMode, height));
    this.save();
    this.render();
    this.field.dispatchEvent(new Event('brush-size-change'));
    this.changed();
    return true;
  }
  private save() {
    try {
      localStorage.setItem('atlas-brush-sizes-v1', model().serialize());
    } catch {
      /* Session preference remains usable. */
    }
  }
  private render() {
    if (!this.key) return;
    const m = model(),
      s = m.size(this.key, this.scale),
      world = m.mode === 'world',
      factor = world && atlasUnits() === 'dnd' ? FOOT : 1;
    // Camera frames synchronize every brush. Keep caption nodes stable so a
    // later viewport read does not force style work for newly inserted controls.
    const unit = world ? (atlasUnits() === 'dnd' ? 'ft' : 'm') : 'px';
    if (this.unit.textContent !== unit) this.unit.textContent = unit;
    this.slider.min = world
      ? String(Math.min(-3, Math.log10(s.world)))
      : String(Math.min(4, s.screen));
    this.slider.max = world
      ? String(Math.max(8, Math.log10(s.world)))
      : String(Math.max(200, s.screen));
    this.slider.step = world ? '0.01' : '1';
    this.slider.value = String(world ? Math.log10(s.world) : s.screen);
    this.slider.setAttribute(
      'aria-valuetext',
      String(Number((world ? s.world / factor : s.screen).toPrecision(6))) +
        (world ? (atlasUnits() === 'dnd' ? ' ft' : ' m') : ' px'),
    );
    if (document.activeElement !== this.number)
      this.number.value = String(Number((world ? s.world / factor : s.screen).toPrecision(5)));
    this.number.min = world ? '0.000001' : this.slider.min;
    this.number.max = world ? '' : this.slider.max;
    this.fixed.checked = world;
    for (const input of [this.slider, this.number, this.fixed]) input.disabled = this.locked;
    if (Number(atlasFieldValue(this.field)) !== s.world) setAtlasFieldValue(this.field, s.world);
  }
  dispose() {
    controls.delete(this);
    bindings.delete(this.field);
  }
}
