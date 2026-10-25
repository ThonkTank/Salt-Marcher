export const ATLAS_FONT_STACK = Object.freeze(['Atlas Noto Sans', 'Atlas Noto Symbols'] as const);
export const ATLAS_FONT_FAMILY = ATLAS_FONT_STACK[0];
export const ATLAS_SYMBOLS_FAMILY = ATLAS_FONT_STACK[1];
export const ATLAS_FONT_DIRECTORY = 'atlas-fonts/';
export const ATLAS_MARKER_IMAGE_ID = 'atlas-marker-pin';

export const ATLAS_FONT_FILES = Object.freeze({
  sans: 'NotoSans-VF.ttf',
  symbols: 'NotoSansSymbols-VF.ttf',
});

/** Explicit supported slices from the vendored font cmaps. This is not an
 * all-Unicode claim; scripts outside these slices remain unqualified. */
export const ATLAS_FONT_COVERAGE = Object.freeze({
  sans: Object.freeze([
    'U+0020-007E',
    'U+00A0-024F',
    'U+0300-036F',
    'U+0370-0377',
    'U+037A-037F',
    'U+0384-038A',
    'U+038C',
    'U+038E-03A1',
    'U+03A3-03E1',
    'U+03F0-03FF',
    'U+0400-052F',
    'U+1AB0-1AC0',
    'U+1AC5',
    'U+1AC7-1ACE',
    'U+1E00-1EFF',
  ]),
  symbols: Object.freeze([
    'U+2190-2199',
    'U+2300-230F',
    'U+2311-2317',
    'U+231C-2335',
    'U+237C-239A',
    'U+23AF-23DB',
    'U+23E2-23E8',
    'U+2460-24FF',
    'U+25CC',
    'U+260A-260D',
    'U+2613',
    'U+2624-262F',
    'U+2638-263B',
    'U+263D-2653',
    'U+2669-267E',
    'U+2690-269D',
    'U+26A2-26A9',
    'U+26AD-26BC',
    'U+26CE',
    'U+26E2-26FF',
    'U+271D-2721',
    'U+2776-2793',
    'U+2921-2922',
  ]),
});

export interface AtlasFontDocument {
  location?: Pick<Location, 'protocol' | 'host' | 'href'>;
  fonts: Pick<FontFaceSet, 'add' | 'load'>;
}

export interface AtlasFontOptions {
  /** Asset root, normally `new URL('./', location.href).href`. */
  base: string;
  document: AtlasFontDocument;
  fetcher?: typeof fetch;
  FontFaceConstructor?: typeof FontFace;
}

function checkedAssetUrl(base: string, file: string, document?: AtlasFontDocument): string {
  const root = new URL(base);
  if (root.username || root.password || root.protocol !== 'campaign:' || root.host !== 'app') {
    throw new Error('Atlas fonts must use the local application asset origin');
  }
  const url = new URL(`${ATLAS_FONT_DIRECTORY}${file}`, root);
  if (
    document?.location &&
    (url.protocol !== document.location.protocol || url.host !== document.location.host)
  ) {
    throw new Error('Atlas fonts must share the application origin');
  }
  return url.href;
}

const loadedFonts = new WeakMap<object, Map<string, Promise<void>>>();

/** Load the bundled faces before building any glyph textures. No network fallback. */
export function preloadAtlasFonts(options: AtlasFontOptions): Promise<void> {
  const { document } = options;
  let byBase = loadedFonts.get(document as object);
  if (!byBase) {
    byBase = new Map();
    loadedFonts.set(document as object, byBase);
  }
  const cached = byBase.get(options.base);
  if (cached) return cached;

  const ready = loadAtlasFonts(options);
  byBase.set(options.base, ready);
  void ready.catch(() => byBase!.delete(options.base));
  return ready;
}

async function loadAtlasFonts(options: AtlasFontOptions): Promise<void> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const FontFaceConstructor = options.FontFaceConstructor ?? globalThis.FontFace;
  if (
    typeof FontFaceConstructor !== 'function' ||
    typeof options.document.fonts.add !== 'function' ||
    typeof options.document.fonts.load !== 'function'
  ) {
    throw new Error('Atlas local fonts require the browser Font Loading API');
  }

  const entries = [
    [ATLAS_FONT_FAMILY, ATLAS_FONT_FILES.sans],
    [ATLAS_SYMBOLS_FAMILY, ATLAS_FONT_FILES.symbols],
  ] as const;
  for (const [family, file] of entries) {
    const url = checkedAssetUrl(options.base, file, options.document);
    const response = await fetcher(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Atlas font request failed (${response.status}): ${file}`);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error(`Atlas font asset is empty: ${file}`);
    const face = new FontFaceConstructor(family, bytes, { style: 'normal', weight: '100 900' });
    await face.load();
    options.document.fonts.add(face);
    await options.document.fonts.load(
      `400 24px "${family}"`,
      family === ATLAS_FONT_FAMILY ? 'ÄÖÜ äöü ß Ελληνικά Кириллица' : '← ↔ ☓',
    );
  }
}

/** Small deterministic neutral pin image, rasterized from code rather than an
 * external sprite. Its dimensions are 24×36 CSS pixels at pixelRatio 2. */
export function atlasMarkerImage(): { width: number; height: number; data: Uint8ClampedArray } {
  const width = 48,
    height = 72,
    samples = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  const insideCircle = (x: number, y: number, cx: number, cy: number, radius: number) =>
    (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  const insidePin = (x: number, y: number) => {
    if (insideCircle(x, y, 12, 12, 10)) return true;
    if (y < 12 || y > 34) return false;
    const halfWidth = (34 - y) * (9 / 22);
    return x >= 12 - halfWidth && x <= 12 + halfWidth;
  };
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let red = 0,
        green = 0,
        blue = 0,
        covered = 0;
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / 2;
          const y = (py + (sy + 0.5) / samples) / 2;
          if (!insidePin(x, y)) continue;
          covered++;
          if (insideCircle(x, y, 12, 12, 3.2)) {
            red += 242;
            green += 223;
            blue += 173;
          } else {
            red += 54;
            green += 92;
            blue += 83;
          }
        }
      if (!covered) continue;
      const index = (py * width + px) * 4;
      data[index] = Math.round(red / covered);
      data[index + 1] = Math.round(green / covered);
      data[index + 2] = Math.round(blue / covered);
      data[index + 3] = Math.round((covered * 255) / (samples * samples));
    }
  }
  return { width, height, data };
}
