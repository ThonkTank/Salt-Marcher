import { DISPLAY_HEIGHT_BOUNDARY_EPSILON } from "./raster";

export const heightVertex = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  vUV = aUV;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;

export const heightFragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uHorizontal;
uniform sampler2D uDescriptor;
uniform sampler2D uOverview;
uniform sampler2D uWeights;
uniform sampler2D uReference;
uniform int uLevelCount;
uniform int uHasOverview;
// 0: canonical H + active contribution, 1: fixed-basis live, 2: warm capture.
uniform int uMode;
uniform int uActiveLevel;
uniform int uMinimumLevel;
uniform int uPageStride;
uniform int uPageColumns;
uniform vec4 uDirty;
uniform vec4 uClip;

// A non-overlapping high/low pair keeps coefficient residuals, fractional
// coordinates and the cubic basis throughout accumulation. Absolute world
// coordinates never enter this shader.
vec2 addPair(vec2 a, vec2 b) {
  float s = a.x + b.x;
  float v = s - a.x;
  float e = (a.x - (s - v)) + (b.x - v) + a.y + b.y;
  float h = s + e;
  return vec2(h, e - (h - s));
}
vec2 mulPair(vec2 a, vec2 b) {
  float p = a.x * b.x;
  float ca = 4097.0 * a.x;
  float ah = ca - (ca - a.x);
  float al = a.x - ah;
  float cb = 4097.0 * b.x;
  float bh = cb - (cb - b.x);
  float bl = b.x - bh;
  float e = ((ah * bh - p) + ah * bl + al * bh) + al * bl;
  e += a.x * b.y + a.y * b.x + a.y * b.y;
  float h = p + e;
  return vec2(h, e - (h - p));
}
vec2 scalePair(vec2 a, float b) { return mulPair(a, vec2(b, 0.0)); }
bool negativePair(vec2 a) { return a.x < 0.0 || (a.x == 0.0 && a.y < 0.0); }
bool nearBoundary(vec2 value, float boundary) {
  vec2 distance = addPair(value, vec2(-boundary, 0.0));
  if (negativePair(distance)) distance = -distance;
  vec2 difference = addPair(distance, -vec2(${Math.fround(DISPLAY_HEIGHT_BOUNDARY_EPSILON)}, ${Math.fround(DISPLAY_HEIGHT_BOUNDARY_EPSILON - Math.fround(DISPLAY_HEIGHT_BOUNDARY_EPSILON))}));
  return negativePair(difference) || (difference.x == 0.0 && difference.y == 0.0);
}

void main() {
  ivec2 pixel = clamp(ivec2(floor(vUV * 128.0)), ivec2(0), ivec2(127));
  if (float(pixel.x) < uClip.x || float(pixel.y) < uClip.y || float(pixel.x) >= uClip.z || float(pixel.y) >= uClip.w) {
    finalColor = vec4(0.0);
    return;
  }
  vec4 reference = uMode != 0 ? texelFetch(uReference, pixel, 0) : vec4(0.0);
  if (uMode == 1 && (float(pixel.x) < uDirty.x || float(pixel.y) < uDirty.y || float(pixel.x) >= uDirty.z || float(pixel.y) >= uDirty.w)) {
    finalColor = reference;
    return;
  }
  vec2 total = uMode == 0 ? vec2(-3.125, 0.0) : reference.rg;
  vec2 activeContribution = vec2(0.0);
  for (int level = 0; level < 22; level++) {
    if (level >= uLevelCount) break;
    int ix = int(texelFetch(uWeights, ivec2(pixel.x * 5, level * 2), 0).r);
    int iy = int(texelFetch(uWeights, ivec2(pixel.y * 5, level * 2 + 1), 0).r);
    int pageX = ix / 64;
    int pageY = iy / 64;
    int tableIndex = pageY * uPageStride + pageX;
    vec4 pages = texelFetch(uDescriptor, ivec2(tableIndex / 4, level), 0);
    int page = int(pages[tableIndex % 4]);
    if (page < 0) continue;
    vec4 rows = texelFetch(uDescriptor, ivec2(uPageColumns, level), 0);
    int authorLevel = int(rows.w);
    vec2 wy[4];
    for (int i = 0; i < 4; i++) {
      wy[i] = texelFetch(uWeights, ivec2(pixel.y * 5 + i + 1, level * 2 + 1), 0).rg;
    }
    for (int y = 0; y < 4; y++) {
      int row = int(rows.y) + iy + y - 1 - int(rows.x);
      vec2 horizontal = texelFetch(uHorizontal, ivec2(pixel.x, row), 0).rg;
      vec2 contribution = mulPair(horizontal, wy[y]);
      // Preserve the canonical coarse-to-fine, direct four-row accumulation.
      if (uMode == 0 && authorLevel >= uMinimumLevel)
        total = addPair(total, contribution);
      if (authorLevel == uActiveLevel)
        activeContribution = addPair(activeContribution, contribution);
    }
  }
  if (uHasOverview != 0)
    total = addPair(total, texelFetch(uOverview, pixel, 0).rg);
  if (uMode == 1)
    total = addPair(reference.rg, addPair(activeContribution, -reference.ba));
  finalColor = vec4(total, activeContribution);
}`;

/** Compute each needed four-control horizontal sum once, retaining its two f32 parts. */
export const heightHorizontalFragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uAuthors;
uniform sampler2D uDescriptor;
uniform sampler2D uWeights;
uniform int uPageStride;
uniform int uPageColumns;
${heightFragment.slice(heightFragment.indexOf("vec2 addPair"), heightFragment.indexOf("void main()"))}
void main() {
  int level = int(floor(vUV.y));
  vec3 rows = texelFetch(uDescriptor, ivec2(uPageColumns, level), 0).rgb;
  int row = int(rows.x) + int(floor(fract(vUV.y) * rows.z));
  int pixelX = clamp(int(floor(vUV.x * 128.0)), 0, 127);
  int ix = int(texelFetch(uWeights, ivec2(pixelX * 5, level * 2), 0).r);
  int pageX = ix / 64;
  // The first required row may be -1: it lives in page zero's existing halo.
  int pageY = clamp(int(floor(float(row) / 64.0)), 0, uPageStride - 1);
  int tableIndex = pageY * uPageStride + pageX;
  vec4 pages = texelFetch(uDescriptor, ivec2(tableIndex / 4, level), 0);
  int page = int(pages[tableIndex % 4]);
  if (page < 0) { finalColor = vec4(0.0); return; }
  int localX = ix - pageX * 64;
  int localY = row - pageY * 64;
  int atlasWidth = textureSize(uAuthors, 0).x;
  vec2 horizontal = vec2(0.0);
  for (int x = 0; x < 4; x++) {
    int offset = page * 4624 + (localY + 2) * 68 + localX + x + 1;
    vec2 value = texelFetch(uAuthors, ivec2(offset % atlasWidth, offset / atlasWidth), 0).rg;
    vec2 weight = texelFetch(uWeights, ivec2(pixelX * 5 + x + 1, level * 2), 0).rg;
    horizontal = addPair(horizontal, mulPair(value, weight));
  }
  finalColor = vec4(horizontal, 0.0, 1.0);
}`;

/** Colour classification is a separate cheap pass over the unclamped result. */
export const heightColourFragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uHeights;
uniform sampler2D uFallbackPixels;
uniform sampler2D uFallbackLand;
uniform sampler2D uLandscape;
uniform int uHasLandscape;
uniform int uFallback;
uniform vec4 uClip;
${heightFragment.slice(heightFragment.indexOf("vec2 addPair"), heightFragment.indexOf("void main()"))}
void main() {
  ivec2 pixel = clamp(ivec2(floor(vUV * 128.0)), ivec2(0), ivec2(127));
  if (float(pixel.x) < uClip.x || float(pixel.y) < uClip.y || float(pixel.x) >= uClip.z || float(pixel.y) >= uClip.w) {
    finalColor = vec4(0.0);
    return;
  }
  vec4 landscape = uHasLandscape != 0 ? texelFetch(uLandscape, pixel, 0) : vec4(0.0);
  float coverage = min(1.0, dot(landscape, vec4(1.0)));
  vec3 vegetation = landscape.r * vec3(43.0,91.0,57.0)
    + landscape.g * vec3(105.0,126.0,66.0)
    + landscape.b * vec3(143.0,159.0,82.0)
    + landscape.a * vec3(135.0,132.0,126.0);
  if (uFallback != 0) {
    vec4 base = texelFetch(uFallbackPixels, pixel, 0);
    if (texelFetch(uFallbackLand, pixel, 0).r > 0.5)
      base.rgb = floor(base.rgb * 255.0 * (1.0 - coverage) + vegetation + 0.5) / 255.0;
    finalColor = base;
    return;
  }
  vec2 height = scalePair(texelFetch(uHeights, pixel, 0).rg, 32.0);
  float h = clamp(height.x + height.y, -100000.0, 100000.0);
  if (nearBoundary(height, 0.0)) {
    h = 0.0;
    height = vec2(0.0);
  } else if (nearBoundary(height, 12.0)) {
    h = 12.0;
    height = vec2(12.0, 0.0);
  }
  vec3 colour;
  if (negativePair(height)) {
    float depth = min(1.0, -h / 300.0);
    colour = floor(vec3(94.0,147.0,166.0) - vec3(53.0,57.0,44.0) * depth + 0.5);
  } else if (negativePair(addPair(height, vec2(-12.0, 0.0)))) {
    colour = vec3(201.0,192.0,144.0);
  } else {
    float shade = min(1.0, h / 600.0);
    colour = floor(vec3(132.0,151.0,103.0) + vec3(60.0,34.0,64.0) * shade + 0.5);
  }
  if (!negativePair(height)) colour = floor(colour * (1.0 - coverage) + vegetation + 0.5);
  finalColor = vec4(colour / 255.0, 1.0);
}`;
