import { readObjectArgb, writeObjectArgb } from "./color-alpha";

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
    "display:grid;gap:8px;min-width:280px;padding:12px;" +
    "border:1px solid var(--background-modifier-border);" +
    "background:var(--background-primary);color:var(--text-normal);" +
    "box-shadow:var(--shadow-l);";

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
  const rows = document.createElement("div");
  rows.className = "dn-object-rgba-fields";
  rows.style.cssText =
    "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;";
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

  const controller = new ObjectColorPicker(rgb, alpha, {
    onPreview: hooks.onPreview,
    onCommit: hooks.onCommit,
    onClose: (reason) => {
      dialog.remove();
      hooks.onClose?.(reason);
    },
  });
  const sync = (source?: HTMLInputElement) => {
    const color = controller.value;
    for (const [channel, input] of fields)
      if (input !== source) input.value = String(color[channel]);
    if (hexField !== source) hexField.value = controller.hexDisplay;
    swatch.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
  };

  for (const channel of ["r", "g", "b", "a"] as const) {
    const row = document.createElement("label");
    row.textContent = channel.toUpperCase();
    row.style.cssText = "display:grid;gap:3px;";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "255";
    input.step = "1";
    input.style.cssText = "width:100%;min-width:0;box-sizing:border-box;";
    input.setAttribute("aria-label", channel.toUpperCase());
    input.addEventListener("input", () => {
      if (input.value === "") return;
      if (controller.setChannel(channel, Number(input.value))) sync(input);
    });
    input.addEventListener("change", () => {
      input.value = String(controller.value[channel]);
    });
    row.append(input);
    rows.append(row);
    fields.set(channel, input);
  }
  hexField.addEventListener("input", () => {
    if (controller.setHex(hexField.value)) sync(hexField);
  });
  hexField.addEventListener("change", () => {
    hexField.value = controller.hexDisplay;
  });
  accept.addEventListener("click", () => controller.close("accept"));
  dialog.addEventListener("keydown", (event) => {
    // Do not let the editor's global tool shortcuts also process picker input.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      controller.close("escape");
    }
  });
  dialog.append(swatchFrame, rows, hexRow, accept);
  host.append(dialog);
  sync();
  dialog.focus();
  return {
    controller,
    element: dialog,
    close: (reason) => controller.close(reason),
  };
}
