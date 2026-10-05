import { alphaByteFromOpacity, opacityFromAlphaByte } from "./pattern-appearance";
import {
  patternHsv,
  patternRgbChannels,
  patternWithHue,
  patternWithRgbChannel,
  patternWithSample,
  patternWithSaturationValue,
  type PatternColorSample,
  type PatternColorValue,
  type RgbChannel,
} from "./pattern-color-behavior";

export type { PatternColorValue, PatternColorSample } from "./pattern-color-behavior";

export function patternHex(color: number): string {
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff)
    throw new RangeError("Pattern RGB must be a 24-bit integer.");
  return color.toString(16).padStart(6, "0");
}

export function patternRgbFromHex(input: string): number {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex))
    throw new RangeError("Pattern hex color must have six digits.");
  return Number.parseInt(hex, 16);
}

export function patternHexWithAlpha(value: PatternColorValue): string {
  const alpha = alphaByteFromOpacity(value.opacity);
  return (alpha === 255 ? "" : alpha.toString(16).padStart(2, "0")) + patternHex(value.color);
}

export function patternColorFromHex(
  input: string,
  currentOpacity: number,
): PatternColorValue {
  const hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex))
    return { color: patternRgbFromHex(hex), opacity: currentOpacity };
  if (/^[0-9a-f]{8}$/i.test(hex))
    return {
      color: Number.parseInt(hex.slice(2), 16),
      opacity: opacityFromAlphaByte(Number.parseInt(hex.slice(0, 2), 16)),
    };
  throw new RangeError("Pattern hex color must have six RGB or eight ARGB digits.");
}

export interface PatternColorPickerOptions {
  initial: PatternColorValue;
  onAccept: (value: PatternColorValue) => void;
  // The editor must supply a sampled map pixel; this module does not guess
  // which rendered level or lighting state the original eyedropper samples.
  sampleMapColor?: () => Promise<PatternColorSample | null>;
}

/** Stages the visible Hex/Alpha fields until Accept, as one property change. */
export function mountPatternColorPicker(
  parent: HTMLElement,
  options: PatternColorPickerOptions,
): HTMLDetailsElement {
  const doc = parent.ownerDocument;
  const root = doc.createElement("details");
  root.className = "dn-pattern-color-picker";
  const heading = doc.createElement("summary");
  heading.textContent = "Farbwähler";
  root.append(heading);

  let staged = { ...options.initial };
  const hexRow = doc.createElement("label");
  hexRow.className = "dn-field";
  const hexLabel = doc.createElement("span");
  hexLabel.textContent = "Hex #";
  const hex = doc.createElement("input");
  hex.type = "text";
  hex.value = patternHexWithAlpha(staged);
  hex.setAttribute("aria-label", "Musterfarbe Hex");
  hex.maxLength = 9;
  hexRow.append(hexLabel, hex);

  const preview = doc.createElement("div");
  preview.className = "dn-pattern-color-preview";
  preview.setAttribute("aria-label", "Musterfarbe Vorschau");
  preview.style.height = "20px";

  const field = doc.createElement("div");
  field.className = "dn-pattern-color-field";
  field.setAttribute("aria-label", "Musterfarbe Sättigung und Helligkeit");
  field.style.width = "160px";
  field.style.height = "160px";
  field.style.cursor = "crosshair";
  const hue = doc.createElement("input");
  hue.type = "range";
  hue.min = "0";
  hue.max = "1000";
  hue.step = "1";
  hue.setAttribute("aria-label", "Musterfarbe Farbton");

  const rgbInputs = {} as Record<RgbChannel, HTMLInputElement>;
  const rgbRows: HTMLLabelElement[] = [];
  for (const channel of ["r", "g", "b"] as const) {
    const row = doc.createElement("label");
    row.className = "dn-field";
    const label = doc.createElement("span");
    label.textContent = channel.toUpperCase();
    const input = doc.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "255";
    input.step = "1";
    input.setAttribute("aria-label", `Musterfarbe ${channel.toUpperCase()}`);
    rgbInputs[channel] = input;
    row.append(label, input);
    rgbRows.push(row);
  }

  const alphaRow = doc.createElement("label");
  alphaRow.className = "dn-field";
  const alphaLabel = doc.createElement("span");
  alphaLabel.textContent = "A";
  const alpha = doc.createElement("input");
  alpha.type = "number";
  alpha.min = "0";
  alpha.max = "255";
  alpha.step = "1";
  alpha.value = String(alphaByteFromOpacity(staged.opacity));
  alpha.setAttribute("aria-label", "Musterfarbe Alpha 0–255");
  alphaRow.append(alphaLabel, alpha);

  const error = doc.createElement("p");
  error.className = "dn-pattern-color-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const controls = doc.createElement("div");
  controls.className = "dn-pattern-color-controls";
  const accept = doc.createElement("button");
  accept.type = "button";
  accept.textContent = "Accept";
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Abbrechen";
  const fail = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  const sync = () => {
    const hsv = patternHsv(staged.color);
    hex.value = patternHexWithAlpha(staged);
    alpha.value = String(alphaByteFromOpacity(staged.opacity));
    for (const channel of ["r", "g", "b"] as const)
      rgbInputs[channel].value = String(patternRgbChannels(staged.color)[channel]);
    hue.value = String(Math.round(hsv.hue * 1000));
    field.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${Math.round(hsv.hue * 360)} 100% 50%))`;
    preview.style.backgroundColor = `#${patternHex(staged.color)}`;
    preview.style.opacity = String(staged.opacity);
    error.hidden = true;
  };
  const change = (action: () => PatternColorValue) => {
    try {
      staged = action();
      sync();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    }
  };
  hex.addEventListener("change", () =>
    change(() => patternColorFromHex(hex.value, staged.opacity)),
  );
  alpha.addEventListener("change", () =>
    change(() => ({ ...staged, opacity: opacityFromAlphaByte(alpha.valueAsNumber) })),
  );
  for (const channel of ["r", "g", "b"] as const)
    rgbInputs[channel].addEventListener("change", () =>
      change(() => ({
        ...staged,
        color: patternWithRgbChannel(staged.color, channel, rgbInputs[channel].valueAsNumber),
      })),
    );
  hue.addEventListener("input", () =>
    change(() => ({ ...staged, color: patternWithHue(staged.color, hue.valueAsNumber / 1000) })),
  );
  field.addEventListener("pointerdown", (event) => {
    const box = field.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const saturation = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const value = Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height));
    change(() => ({
      ...staged,
      color: patternWithSaturationValue(staged.color, saturation, value),
    }));
  });
  accept.addEventListener("click", () => {
    try {
      staged = patternColorFromHex(hex.value, staged.opacity);
      staged.opacity = opacityFromAlphaByte(alpha.valueAsNumber);
      options.onAccept(staged);
      error.hidden = true;
      root.open = false;
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    }
  });
  cancel.addEventListener("click", () => {
    staged = { ...options.initial };
    sync();
    root.open = false;
  });
  if (options.sampleMapColor) {
    const sample = doc.createElement("button");
    sample.type = "button";
    sample.textContent = "Pipette";
    sample.setAttribute("aria-label", "Musterfarbe von der Karte aufnehmen");
    sample.addEventListener("click", async () => {
      sample.disabled = true;
      try {
        const sampleColor = await options.sampleMapColor?.();
        if (sampleColor && root.isConnected) {
          staged = patternWithSample(staged, sampleColor);
          sync();
        }
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : String(cause));
      } finally {
        sample.disabled = false;
      }
    });
    controls.append(sample);
  }
  controls.append(accept, cancel);
  root.append(field, hue, preview, ...rgbRows, hexRow, alphaRow, error, controls);
  sync();
  parent.append(root);
  return root;
}
