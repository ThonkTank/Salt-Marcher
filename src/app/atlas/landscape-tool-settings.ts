import { brushSizeControl } from './atlas-brush-size';
import type { HeightStroke } from './terrain-brush';
import { TERRAIN_FORM_SEED, type TerrainForm } from './terrain-form-brush';
import { atlasFieldValue } from './atlas-units';
import { newLine, lineParts, roadStyles, type LandscapeLine } from './landscape-line';
import type { BrushMode, LandscapeColor } from './landscape-brush';
import type { LandscapeRecord } from './atlas-landscape';
const field = (root: ParentNode, id: string) =>
  root.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
const check = (root: ParentNode, id: string) => root.querySelector<HTMLInputElement>('#' + id)!;
export function lineControls(
  root: HTMLElement,
  prefix: string,
  value: LandscapeLine,
  river: boolean,
  changed: () => void,
) {
  root.innerHTML =
    `<strong>${prefix === 'land-new' ? 'Vorgaben für neue Verläufe' : 'Eigenschaften der Auswahl'}</strong><label>Kurve<select id="${prefix}-curve"><option value="smooth">Geschwungen</option><option value="linear">Gerade Teilstücke</option></select></label><label>Farbe<input id="${prefix}-color" type="color"></label><label>Rauheit<input id="${prefix}-roughness" type="range" min="0" max="${river ? 3 : 1}" step="0.01"></label>` +
    (river
      ? `<label>Mäanderabstand<input id="${prefix}-meander" type="range" min="0" max="1" step="0.01"></label><label><input id="${prefix}-fade" type="checkbox"> Quelle schmal auslaufen lassen</label>`
      : `<label>Straßenstil<select id="${prefix}-style">${roadStyles.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><svg id="${prefix}-preview" viewBox="0 0 200 44" role="img" aria-label="Vorschau des Straßenstils" style="width:100%;height:44px;background:#edf0df"></svg><label><input id="${prefix}-over" type="checkbox"> Über Ortssymbolen zeichnen</label>`);
  for (const [id, v] of [
    ['curve', value.curve],
    ['color', value.color],
    ['roughness', value.roughness],
    ['meander', value.meander],
    ['style', value.style],
  ] as const) {
    const f = field(root, prefix + '-' + id);
    if (f) f.value = String(v);
  }
  const fade = check(root, prefix + '-fade'),
    over = check(root, prefix + '-over');
  if (fade) fade.checked = value.fadeIn;
  if (over) over.checked = value.overSymbols;
  const preview = () => {
    const svg = root.querySelector('#' + prefix + '-preview');
    if (!svg) return;
    svg.replaceChildren();
    const line = readLineControls(root, prefix, value),
      record = {
        kind: 'road',
        width: 5,
        points: [
          { x: 12, y: 30 },
          { x: 85, y: 15 },
          { x: 185, y: 28 },
        ],
        line,
      } as LandscapeRecord;
    for (const part of lineParts(record)) {
      const n = document.createElementNS(
        'http://www.w3.org/2000/svg',
        part.polygons ? 'polygon' : 'polyline',
      );
      n.setAttribute(
        'points',
        (part.polygons?.[0]?.outer ?? part.points).map((p) => p.x + ',' + p.y).join(' '),
      );
      n.setAttribute('fill', part.polygons ? part.color : 'none');
      n.setAttribute('stroke', part.color);
      n.setAttribute('stroke-width', String(part.width));
      if (part.dash) n.setAttribute('stroke-dasharray', part.dash.join(' '));
      if (part.dashOffset) n.setAttribute('stroke-dashoffset', String(part.dashOffset));
      n.setAttribute('stroke-linecap', 'round');
      n.setAttribute('stroke-linejoin', 'round');
      n.setAttribute('opacity', String(part.opacity));
      svg.append(n);
    }
  };
  root.oninput = () => {
    preview();
    changed();
  };
  root.onchange = () => {
    preview();
    changed();
  };
  preview();
}
export function readLineControls(
  root: ParentNode,
  prefix: string,
  base: LandscapeLine,
): LandscapeLine {
  const result = { ...base };
  for (const key of ['curve', 'color', 'style'] as const) {
    const f = field(root, prefix + '-' + key);
    if (f) (result as any)[key] = f.value;
  }
  for (const key of ['roughness', 'meander'] as const) {
    const f = field(root, prefix + '-' + key);
    if (f) result[key] = Number(f.value);
  }
  const fade = check(root, prefix + '-fade'),
    over = check(root, prefix + '-over');
  if (fade) result.fadeIn = fade.checked;
  if (over) result.overSymbols = over.checked;
  return result;
}
export class LandscapeToolSettings {
  readonly lineRoot = document.createElement('div');
  readonly brushRoot = document.createElement('div');
  readonly precisionRoot = document.createElement('div');
  private radius: HTMLInputElement;
  private radiusHome: Comment;
  private heightSettings: Record<string, { strength: string; feather: string }> = {
    height: { strength: '300', feather: '0.8' },
    smooth: { strength: '300', feather: '0.8' },
  };
  private last = '';
  private lines = { road: newLine('road'), river: newLine('river') };
  eyedropper = false;
  constructor(
    panel: HTMLElement,
    private changed: () => void,
    private canChange: () => boolean = () => true,
  ) {
    this.radius = panel.querySelector<HTMLInputElement>('#land-radius')!;
    this.radiusHome = document.createComment('brush-radius');
    this.radius.closest('label')!.before(this.radiusHome);
    this.lineRoot.id = 'land-line-options';
    this.brushRoot.id = 'land-brush-options';
    panel.querySelector('#land-width')!.closest('label')!.after(this.lineRoot);
    panel.querySelector('#land-radius')!.closest('label')!.before(this.brushRoot);
    this.brushRoot.innerHTML = `<div id="land-height-options"><div id="land-height-direction" role="group" aria-label="Wirkung"><span>Wirkung</span><input id="land-height-mode" type="hidden" value="raise"><div class="toolbar"><button type="button" data-direction="raise" aria-pressed="true">Erhöhen</button><button type="button" data-direction="lower" aria-pressed="false">Absenken</button><button type="button" data-direction="roughen" aria-pressed="false">Aufrauen</button></div></div><label class="atlas-brush-range"><span>Stärke <small>m/s</small></span><input id="land-height-strength-slider" aria-label="Stärke" type="range" min="-3" max="5" step="0.01" value="2.47712125472"><input id="land-height-strength" type="number" min="0.001" step="any" max="100000" value="300"></label><label class="atlas-brush-range"><span>Weicher Rand</span> <output id="land-height-feather-value">80 %</output><input id="land-height-feather" type="range" min="0" max="1" step="0.05" value="0.8"></label><label><input id="land-preserve-details" type="checkbox" checked> Feine Geländedetails erhalten</label><small>Ausgeschaltet werden feinere Formen im Pinselbereich allmählich abgetragen.</small><div id="land-shape-options"><label class="atlas-brush-range"><span>Roughness</span> <output id="land-roughness-value">0 · gleichmäßig</output><input id="land-coast-roughness" type="range" min="0" max="2" step="0.1" value="0"></label><label><input id="land-height-target-enabled" type="checkbox"> Zielhöhe begrenzen</label><label>Zielhöhe in m<input id="land-height-target" type="number" step="any" min="-1000000" max="1000000" value="300"></label></div></div><div id="land-freshwater-options"><label>Wirkung<select id="land-freshwater-operation"><option value="add">Süßwasser hinzufügen</option><option value="erase">Süßwasser radieren</option></select></label><label>Wasserstand in m<input id="land-water-level" type="number" placeholder="Am ersten Punkt + 1 m" step="any"></label></div><div id="land-color-options"><label>Ziel<select id="land-color-target"><option value="ground">Landfarbe</option><option value="water">Wasserfarbe</option></select></label><label>Wirkung<select id="land-color-operation"><option value="paint">Farbe auftragen</option><option value="erase">Farbe radieren</option></select></label><label>Pinselspitze<select id="land-tip"><option value="soft">Weich</option><option value="round">Fest rund</option><option value="textured">Strukturiert</option></select></label><label>Farbe<input id="land-paint-color" type="color" value="#739355"></label><div id="land-palette" class="toolbar"></div><button id="land-palette-add" type="button">Farbe merken</button><button id="land-pipette" type="button">Farbe aufnehmen</button><label>Deckkraft<input id="land-paint-opacity" type="range" min="0.1" max="1" step="0.05" value="1"></label><label>Auftragsstärke<input id="land-paint-flow" type="range" min="0.1" max="1" step="0.05" value="1"></label><label>Auftrag<select id="land-fill"><option value="stroke">Pinselzug</option><option value="connected">Zusammenhängende Fläche füllen</option><option value="all">Alle Landflächen füllen</option></select></label></div>`;
    this.precisionRoot.id = 'land-height-precision';
    this.precisionRoot.className = 'caption';
    this.precisionRoot.innerHTML =
      '<output id="land-brush-resolution"></output><p id="land-height-protection" role="status" hidden></p>';
    const forms = document.createElement('div');
    forms.id = 'land-height-forms';
    forms.setAttribute('role', 'group');
    forms.setAttribute('aria-label', 'Geländeform');
    forms.innerHTML =
      '<input id="land-height-form" type="hidden" value=""><div class="atlas-form-buttons">' +
      TERRAIN_FORMS.map(
        (p) =>
          `<button type="button" data-form="${p.form}" aria-pressed="false">${p.name}</button>`,
      ).join('') +
      '</div>';
    this.brushRoot.querySelector('#land-height-direction')!.before(forms);
    for (const b of forms.querySelectorAll<HTMLButtonElement>('[data-form]'))
      b.onclick = () => {
        if (!this.canChange()) return;
        const p = TERRAIN_FORMS.find((p) => p.form === b.dataset.form)!;
        field(this.brushRoot, 'land-height-form').value = p.form;
        field(this.brushRoot, 'land-height-mode').value = p.form === 'canyon' ? 'lower' : 'raise';
        field(this.brushRoot, 'land-height-feather').value = String(p.feather);
        check(this.brushRoot, 'land-height-target-enabled').checked = false;
        brushSizeControl(this.radius)?.preset(p.radius);
        field(this.brushRoot, 'land-height-strength').value = String(
          Number(
            Math.max(
              0.001,
              Math.min(100000, Number(atlasFieldValue(this.radius)) * p.rate),
            ).toPrecision(3),
          ),
        );
        this.show(this.last);
        this.changed();
      };
    for (const b of this.brushRoot.querySelectorAll<HTMLButtonElement>('[data-direction]'))
      b.onclick = () => {
        if (!this.canChange()) return;
        field(this.brushRoot, 'land-height-form').value = '';
        field(this.brushRoot, 'land-height-mode').value = b.dataset.direction!;
        this.show(this.last);
        this.changed();
      };
    const strength = field(this.brushRoot, 'land-height-strength'),
      slider = field(this.brushRoot, 'land-height-strength-slider');
    slider.oninput = () => {
      if (this.canChange())
        strength.value = String(Number((10 ** Number(slider.value)).toPrecision(3)));
    };
    this.radius.addEventListener('brush-size-change', () => {
      this.show(this.last);
    });
    this.brushRoot.oninput = this.brushRoot.onchange = () => {
      if (!this.canChange()) return;
      this.show(this.last);
      this.changed();
    };
    const palette = this.brushRoot.querySelector('#land-palette')!,
      add = (color: string) => {
        if (palette.querySelector(`[data-color="${color}"]`)) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.color = color;
        b.title = color;
        b.setAttribute('aria-label', 'Farbe ' + color);
        b.textContent = '●';
        b.style.color = color;
        b.onclick = () => {
          field(this.brushRoot, 'land-paint-color').value = color;
          this.changed();
        };
        palette.append(b);
      };
    ['#739355', '#d8c397', '#aa8170', '#629ebc', '#f1ead8'].forEach(add);
    try {
      const saved = JSON.parse(localStorage.getItem('atlas-color-palette-v1') ?? '[]');
      if (Array.isArray(saved))
        saved
          .slice(0, 48)
          .filter((c) => typeof c === 'string' && /^#[a-f0-9]{6}$/i.test(c))
          .forEach(add);
    } catch {
      /* A palette is optional; authored color remains in the campaign. */
    }
    this.brushRoot.querySelector<HTMLButtonElement>('#land-palette-add')!.onclick = () => {
      add(field(this.brushRoot, 'land-paint-color').value);
      try {
        localStorage.setItem(
          'atlas-color-palette-v1',
          JSON.stringify(
            [...palette.querySelectorAll<HTMLElement>('[data-color]')]
              .map((b) => b.dataset.color)
              .slice(-48),
          ),
        );
      } catch {
        /* Current-session palette remains available. */
      }
    };
    this.brushRoot.querySelector<HTMLButtonElement>('#land-pipette')!.onclick = () => {
      this.eyedropper = true;
      this.changed();
    };
  }
  mode(): BrushMode {
    if (this.last === 'color')
      return field(this.brushRoot, 'land-color-operation').value === 'erase'
        ? 'color-erase'
        : field(this.brushRoot, 'land-color-target').value === 'water'
          ? 'water-color'
          : 'ground-color';
    if (this.last === 'freshwater')
      return field(this.brushRoot, 'land-freshwater-operation').value === 'erase'
        ? 'freshwater-erase'
        : 'freshwater';
    return 'terrain';
  }
  height(): Omit<HeightStroke, 'samples' | 'radius'> {
    const mode =
      this.last === 'smooth'
        ? 'smooth'
        : (field(this.brushRoot, 'land-height-mode').value as 'raise' | 'lower' | 'roughen');
    const form =
      this.last === 'height'
        ? (field(this.brushRoot, 'land-height-form').value as TerrainForm | '')
        : '';
    return {
      mode,
      preserveDetails: check(this.brushRoot, 'land-preserve-details').checked !== false,
      ...(form ? { form, seed: TERRAIN_FORM_SEED } : {}),
      strength: Number(field(this.brushRoot, 'land-height-strength').value),
      feather: Number(field(this.brushRoot, 'land-height-feather').value),
      ...(!form && (mode === 'raise' || mode === 'lower')
        ? {
            roughness: this.roughness(),
            ...(check(this.brushRoot, 'land-height-target-enabled').checked
              ? { targetM: Number(atlasFieldValue(field(this.brushRoot, 'land-height-target'))) }
              : {}),
          }
        : {}),
    };
  }
  roughness() {
    return Number(field(this.brushRoot, 'land-coast-roughness').value);
  }
  fill() {
    return this.last === 'color' && field(this.brushRoot, 'land-fill').value !== 'stroke';
  }
  color(radius: number, seed: number): LandscapeColor {
    return {
      version: 2,
      target: field(this.brushRoot, 'land-color-target').value as 'water' | 'ground',
      operation: field(this.brushRoot, 'land-color-operation').value as 'paint' | 'erase',
      color: field(this.brushRoot, 'land-paint-color').value,
      opacity: Number(field(this.brushRoot, 'land-paint-opacity').value),
      flow: Number(field(this.brushRoot, 'land-paint-flow').value),
      tip: field(this.brushRoot, 'land-tip').value as LandscapeColor['tip'],
      radius,
      seed,
      fill: this.fill(),
      fillScope: field(this.brushRoot, 'land-fill').value === 'all' ? 'all' : 'connected',
    };
  }
  sample(color: string) {
    field(this.brushRoot, 'land-paint-color').value = color;
    this.eyedropper = false;
    this.changed();
  }
  line(kind: 'road' | 'river', seed: number) {
    return {
      ...(this.last === kind
        ? readLineControls(this.lineRoot, 'land-new', this.lines[kind])
        : this.lines[kind]),
      seed,
    };
  }
  show(tool: string) {
    if (tool !== this.last) {
      if (this.last === 'height' || this.last === 'smooth')
        this.heightSettings[this.last] = {
          strength: field(this.brushRoot, 'land-height-strength').value,
          feather: field(this.brushRoot, 'land-height-feather').value,
        };
      if (tool === 'height' || tool === 'smooth') {
        const saved = this.heightSettings[tool]!;
        field(this.brushRoot, 'land-height-strength').value = saved.strength;
        field(this.brushRoot, 'land-height-feather').value = saved.feather;
      }
      if (this.last === 'road' || this.last === 'river')
        this.lines[this.last] = readLineControls(this.lineRoot, 'land-new', this.lines[this.last]);
      this.eyedropper = false;
      this.last = tool;
      if (tool === 'road' || tool === 'river')
        lineControls(this.lineRoot, 'land-new', this.lines[tool], tool === 'river', this.changed);
    }
    const selected = tool === 'height' ? field(this.brushRoot, 'land-height-form').value : '';
    for (const b of this.brushRoot.querySelectorAll<HTMLButtonElement>('[data-form]'))
      b.setAttribute('aria-pressed', String(b.dataset.form === selected));
    this.brushRoot.querySelector<HTMLElement>('#land-height-forms')!.hidden = tool !== 'height';
    this.lineRoot.hidden = !['river', 'road'].includes(tool);
    this.brushRoot.hidden = !['height', 'smooth', 'color', 'freshwater'].includes(tool);
    this.brushRoot.querySelector<HTMLElement>('#land-height-options')!.hidden = ![
      'height',
      'smooth',
    ].includes(tool);
    this.brushRoot.querySelector<HTMLElement>('#land-height-direction')!.hidden = tool !== 'height';
    for (const b of this.brushRoot.querySelectorAll<HTMLButtonElement>('[data-direction]'))
      b.setAttribute(
        'aria-pressed',
        String(
          !selected && b.dataset.direction === field(this.brushRoot, 'land-height-mode').value,
        ),
      );
    field(this.brushRoot, 'land-height-strength-slider').value = String(
      Math.log10(Number(field(this.brushRoot, 'land-height-strength').value)),
    );
    const radiusLabel = this.radius.closest('label')!,
      radiusAnchor = ['height', 'smooth'].includes(tool)
        ? field(this.brushRoot, 'land-height-strength').closest('label')!
        : this.brushRoot.parentElement === this.radiusHome.parentElement
          ? this.radiusHome
          : this.brushRoot;
    if (radiusAnchor.nextSibling !== radiusLabel) radiusAnchor.after(radiusLabel);
    this.precisionRoot.hidden = !['height', 'smooth'].includes(tool);
    if (!this.precisionRoot.hidden && radiusLabel.nextSibling !== this.precisionRoot)
      radiusLabel.after(this.precisionRoot);
    field(this.brushRoot, 'land-height-target').closest('label')!.hidden = !check(
      this.brushRoot,
      'land-height-target-enabled',
    ).checked;
    this.brushRoot.querySelector('#land-height-feather-value')!.textContent =
      Math.round(Number(field(this.brushRoot, 'land-height-feather').value) * 100) + ' %';
    this.brushRoot.querySelector<HTMLElement>('#land-shape-options')!.hidden =
      tool !== 'height' ||
      !!selected ||
      field(this.brushRoot, 'land-height-mode').value === 'roughen';
    this.brushRoot.querySelector<HTMLElement>('#land-color-options')!.hidden = tool !== 'color';
    this.brushRoot.querySelector<HTMLElement>('#land-freshwater-options')!.hidden =
      tool !== 'freshwater';
    this.brushRoot.querySelector<HTMLElement>('#land-roughness-value')!.textContent =
      this.roughness().toLocaleString('de-DE');
    const all = this.brushRoot.querySelector<HTMLOptionElement>('#land-fill option[value="all"]')!;
    all.disabled = field(this.brushRoot, 'land-color-target').value === 'water';
    if (all.disabled && field(this.brushRoot, 'land-fill').value === 'all')
      field(this.brushRoot, 'land-fill').value = 'connected';
  }
}

export const TERRAIN_FORMS = [
  { name: 'Hügel', form: 'hills', rate: 0.5, radius: 65, feather: 0.8 },
  { name: 'Berge', form: 'mountains', rate: 0.85, radius: 65, feather: 0.65 },
  { name: 'Schlucht', form: 'canyon', rate: 0.75, radius: 45, feather: 0.6 },
] as const;
