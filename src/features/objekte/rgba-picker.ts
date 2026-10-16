import { readObjectArgb, writeObjectArgb } from "./color-alpha";
import { patternHsv, patternWithHue, patternWithSaturationValue } from
  "../material/pattern-color-behavior";

/** Default Object Tool palette stored by Dungeondraft 1.2.0.1. */
export const NATIVE_OBJECT_PALETTE = [
  0x6b3834, 0xac584c, 0x885848, 0xc0866c, 0x8d6d58, 0xf3a768,
  0x685848, 0x9c8868, 0xae9254, 0xd8c888, 0x888868, 0xaab478,
  0x92aa58, 0x87a868, 0x679865, 0x789868, 0x546d56, 0x68887c,
  0x667878, 0x809dab, 0x61788d, 0x535869, 0x786878, 0x886878,
  0x905868, 0x994858, 0xd8d8d8, 0x8a8a8a, 0x585858, 0x282828,
] as const;

export interface ObjectRgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export type ObjectColorPickerClose = "accept" | "escape";

export interface ObjectColorPickerHooks {
  /** Draw a transient preview; do not write to Session history here. */
  onPreview(rgb: number, alpha: number): void;
  /** Commit at most one Session command for this picker interaction. */
  onCommit(rgb: number, alpha: number): void;
  sampleMapColor?: (onPreview?: (sample: { color: number; alphaByte: number }) => void) =>
    Promise<{ color: number; alphaByte: number } | null>;
  onClose?(reason: ObjectColorPickerClose): void;
}

function byte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function unpack(rgb: number, alpha: number): ObjectRgba {
  return {
    r: (rgb >>> 16) & 255,
    g: (rgb >>> 8) & 255,
    b: rgb & 255,
    a: alpha,
  };
}

function pack(color: ObjectRgba): number {
  return (color.r << 16) | (color.g << 8) | color.b;
}

/** Independent picker state. Only valid complete inputs change the live color. */
export class ObjectColorPicker {
  private color: ObjectRgba;
  private closed = false;
  private readonly hooks: ObjectColorPickerHooks;
  private readonly initialArgb: string;

  constructor(rgb: number, alpha: number, hooks: ObjectColorPickerHooks) {
    // Validate both values through the native ARGB codec.
    this.initialArgb = writeObjectArgb({ rgb, alphaByte: alpha });
    this.color = unpack(rgb, alpha);
    this.hooks = hooks;
  }

  get value(): ObjectRgba {
    return { ...this.color };
  }

  get argb(): string {
    return writeObjectArgb({
      rgb: pack(this.color),
      alphaByte: this.color.a,
    });
  }

  /** Native field omits the opaque FF prefix but shows alpha below 255. */
  get hexDisplay(): string {
    return this.color.a === 255 ? this.argb.slice(2) : this.argb;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Returns false for incomplete/out-of-range numeric input. */
  setChannel(channel: keyof ObjectRgba, value: number): boolean {
    if (this.closed || !byte(value)) return false;
    this.replace({ ...this.color, [channel]: value });
    return true;
  }

  /** Six hex digits change RGB only; eight digits are native ARGB. */
  setHex(input: string): boolean {
    if (this.closed) return false;
    const hex = input.trim().replace(/^#/, "");
    if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return false;
    const parsed = readObjectArgb(
      hex.length === 6 ? this.color.a.toString(16).padStart(2, "0") + hex : hex,
    );
    this.replace(unpack(parsed.rgb, parsed.alphaByte));
    return true;
  }

  close(reason: ObjectColorPickerClose): void {
    if (this.closed) return;
    this.closed = true;
    const rgb = pack(this.color);
    try {
      // Native Escape dismisses the dialog but retains its live color.
      if (this.argb !== this.initialArgb)
        this.hooks.onCommit(rgb, this.color.a);
    } finally {
      this.hooks.onClose?.(reason);
    }
  }

  private replace(next: ObjectRgba): void {
    if (
      next.r === this.color.r &&
      next.g === this.color.g &&
      next.b === this.color.b &&
      next.a === this.color.a
    )
      return;
    this.color = next;
    this.hooks.onPreview(pack(next), next.a);
  }
}

export interface MountedObjectColorPicker {
  readonly controller: ObjectColorPicker;
  readonly element: HTMLElement;
  close(reason: ObjectColorPickerClose): void;
}

/** Mounts a self-contained dialog; host handles its placement above the editor. */
export function mountObjectColorPicker(
  host: HTMLElement,
  rgb: number,
  alpha: number,
  hooks: ObjectColorPickerHooks,
): MountedObjectColorPicker {
  const dialog = document.createElement("section");
  dialog.className = "dn-object-rgba-picker";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", "Objektfarbe RGBA");
  dialog.tabIndex = -1;
  dialog.style.cssText =
    "display:grid;gap:8px;width:300px;max-height:90vh;overflow:auto;padding:8px;" +
    "border:1px solid var(--background-modifier-border);" +
    "background:var(--background-primary);color:var(--text-normal);" +
    "box-shadow:var(--shadow-l);";

  const colorControls = document.createElement("div");
  colorControls.style.cssText = "display:grid;grid-template-columns:1fr 28px;gap:4px;height:180px;";
  const field = document.createElement("div");
  field.className = "dn-object-rgba-field";
  field.setAttribute("aria-label", "Objektfarbe Sättigung und Helligkeit");
  field.style.cssText = "cursor:crosshair;border:1px solid var(--background-modifier-border);";
  const hue = document.createElement("input");
  hue.type = "range";
  hue.min = "0";
  hue.max = "1000";
  hue.step = "1";
  hue.setAttribute("aria-label", "Objektfarbe Farbton");
  hue.style.cssText = "width:28px;height:180px;margin:0;appearance:none;" +
    "background:linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);";
  colorControls.append(field, hue);
  const swatchFrame = document.createElement("div");
  swatchFrame.className = "dn-object-rgba-checker";
  swatchFrame.style.cssText =
    "height:36px;background:conic-gradient(#aaa 25%, #eee 0 50%," +
    " #aaa 0 75%, #eee 0) 0 0 / 16px 16px;";
  const swatch = document.createElement("div");
  swatch.className = "dn-object-rgba-swatch";
  swatch.setAttribute("aria-label", "Farbvorschau");
  swatch.style.height = "100%";
  swatchFrame.append(swatch);
  const fields = new Map<keyof ObjectRgba, HTMLInputElement>();
  const sliders = new Map<keyof ObjectRgba, HTMLInputElement>();
  const rows = document.createElement("div");
  rows.className = "dn-object-rgba-fields";
  rows.style.cssText =
    "display:grid;gap:4px;";
  const hexField = document.createElement("input");
  hexField.type = "text";
  hexField.maxLength = 9;
  hexField.spellcheck = false;
  hexField.setAttribute("aria-label", "Hex ARGB");
  hexField.setAttribute("inputmode", "text");
  const hexRow = document.createElement("label");
  hexRow.textContent = "Hex";
  hexRow.style.cssText = "display:grid;gap:3px;";
  hexField.style.width = "100%";
  hexRow.append(hexField);
  const accept = document.createElement("button");
  accept.type = "button";
  accept.textContent = "Accept";
  const pipette = document.createElement("button");
  pipette.type = "button";
  pipette.textContent = "Pipette";
  pipette.setAttribute("aria-label", "Objektfarbe Pipette");
  pipette.disabled = !hooks.sampleMapColor;
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:6px;justify-content:flex-end;";
  actions.append(pipette, accept);
  let sampling = false;

  const controller = new ObjectColorPicker(rgb, alpha, {
    onPreview: hooks.onPreview,
    onCommit: hooks.onCommit,
    onClose: (reason) => {
      document.removeEventListener("pointerdown", outside, true);
      dialog.remove();
      hooks.onClose?.(reason);
    },
  });
  const sync = (source?: HTMLInputElement) => {
    const color = controller.value;
    const current = pack(color);
    const hsv = patternHsv(current);
    field.style.background = "linear-gradient(to top,#000,transparent)," +
      `linear-gradient(to right,#fff,hsl(${Math.round(hsv.hue * 360)} 100% 50%))`;
    hue.value = String(Math.round(hsv.hue * 1000));
    for (const [channel, input] of fields)
      if (input !== source) input.value = String(color[channel]);
    for (const [channel, input] of sliders)
      input.value = String(color[channel]);
    if (hexField !== source) hexField.value = controller.hexDisplay;
    swatch.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
  };
  const replaceRgb = (next: number) => {
    controller.setHex(controller.value.a.toString(16).padStart(2, "0") +
      next.toString(16).padStart(6, "0"));
    sync();
  };
  const fieldColor = (event: PointerEvent) => {
    const rect = field.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const value = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    replaceRgb(patternWithSaturationValue(pack(controller.value), saturation, value, "nearest"));
  };
  let fieldPointer: number | null = null;
  field.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    fieldPointer = event.pointerId;
    field.setPointerCapture(event.pointerId);
    fieldColor(event);
  });
  field.addEventListener("pointermove", (event) => {
    if (fieldPointer === event.pointerId) fieldColor(event);
  });
  field.addEventListener("pointerup", (event) => { fieldPointer = null;
    field.releasePointerCapture(event.pointerId); });
  field.addEventListener("pointercancel", () => { fieldPointer = null; });
  const hueColor = (event: PointerEvent) => {
    const rect = hue.getBoundingClientRect();
    if (!rect.height) return;
    const position = Math.max(0, Math.min(1,
      (event.clientY - rect.top) / rect.height));
    replaceRgb(patternWithHue(pack(controller.value), position));
  };
  let huePointer: number | null = null;
  hue.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    huePointer = event.pointerId;
    hue.setPointerCapture(event.pointerId);
    hueColor(event);
  });
  hue.addEventListener("pointermove", (event) => {
    if (huePointer === event.pointerId) hueColor(event);
  });
  hue.addEventListener("pointerup", (event) => { huePointer = null;
    hue.releasePointerCapture(event.pointerId); });
  hue.addEventListener("pointercancel", () => { huePointer = null; });
  hue.addEventListener("input", () => {
    if (huePointer === null)
      replaceRgb(patternWithHue(pack(controller.value), Number(hue.value) / 1000));
  });

  for (const channel of ["r", "g", "b", "a"] as const) {
    const row = document.createElement("label");
    row.textContent = channel.toUpperCase();
    row.style.cssText = "display:grid;grid-template-columns:16px 1fr 58px;gap:4px;align-items:center;";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "255";
    slider.step = "1";
    slider.setAttribute("aria-label", channel.toUpperCase() + " Regler");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "255";
    input.step = "1";
    input.style.cssText = "width:100%;min-width:0;box-sizing:border-box;";
    input.setAttribute("aria-label", channel.toUpperCase());
    input.addEventListener("input", () => {
      if (input.value === "") return;
      if (controller.setChannel(channel, Number(input.value))) {
        slider.value = input.value;
        sync(input);
      }
    });
    input.addEventListener("change", () => {
      input.value = String(controller.value[channel]);
    });
    slider.addEventListener("input", () => {
      if (controller.setChannel(channel, Number(slider.value))) sync();
    });
    row.append(slider, input);
    rows.append(row);
    fields.set(channel, input);
    sliders.set(channel, slider);
  }
  const finishHex = () => {
    const draft = hexField.value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(draft)) controller.setHex("ff" + draft);
    else if (/^[0-9a-f]{8}$/i.test(draft)) controller.setHex(draft);
    hexField.value = controller.hexDisplay;
    sync();
  };
  hexField.addEventListener("change", finishHex);
  const close = (reason: ObjectColorPickerClose) => {
    if (document.activeElement === hexField) finishHex();
    controller.close(reason);
  };
  pipette.addEventListener("click", async () => {
    if (!hooks.sampleMapColor) return;
    sampling = true;
    pipette.disabled = true;
    const sampleValue = (sample: { color: number; alphaByte: number }) => {
      if (controller.isClosed) return;
      controller.setHex(sample.alphaByte.toString(16).padStart(2, "0") +
        sample.color.toString(16).padStart(6, "0"));
      sync();
    };
    try {
      const sample = await hooks.sampleMapColor(sampleValue);
      if (sample) sampleValue(sample);
    } finally { sampling = false; pipette.disabled = false; }
  });
  accept.addEventListener("click", () => close("accept"));
  dialog.addEventListener("keydown", (event) => {
    // Do not let the editor's global tool shortcuts also process picker input.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close("escape");
    }
  });
  const outside = (event: PointerEvent) => {
    if (!sampling && !dialog.contains(event.target as Node)) close("escape");
  };
  dialog.append(colorControls, swatchFrame, rows, hexRow, actions);
  host.append(dialog);
  document.addEventListener("pointerdown", outside, true);
  sync();
  dialog.focus();
  return {
    controller,
    element: dialog,
    close,
  };
}
