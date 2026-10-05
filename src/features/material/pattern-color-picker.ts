import { alphaByteFromOpacity, opacityFromAlphaByte } from "./pattern-appearance";

export interface PatternColorValue {
  color: number;
  opacity: number;
}

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

export interface PatternColorPickerOptions {
  initial: PatternColorValue;
  onAccept: (value: PatternColorValue) => void;
  // The editor must supply a sampled map pixel; this module does not guess
  // which rendered level or lighting state the original eyedropper samples.
  sampleMapColor?: () => Promise<number | null>;
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
  hex.value = patternHex(staged.color);
  hex.setAttribute("aria-label", "Musterfarbe Hex");
  hex.maxLength = 7;
  hexRow.append(hexLabel, hex);

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
  accept.addEventListener("click", () => {
    try {
      const color = patternRgbFromHex(hex.value);
      const opacity = opacityFromAlphaByte(alpha.valueAsNumber);
      staged = { color, opacity };
      options.onAccept(staged);
      error.hidden = true;
      root.open = false;
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    }
  });
  cancel.addEventListener("click", () => {
    hex.value = patternHex(options.initial.color);
    alpha.value = String(alphaByteFromOpacity(options.initial.opacity));
    staged = { ...options.initial };
    error.hidden = true;
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
        const color = await options.sampleMapColor?.();
        if (color !== null && color !== undefined) {
          staged = { ...staged, color };
          hex.value = patternHex(color);
          error.hidden = true;
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
  root.append(hexRow, alphaRow, error, controls);
  parent.append(root);
  return root;
}
