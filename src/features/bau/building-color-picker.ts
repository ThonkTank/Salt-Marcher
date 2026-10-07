import { ObjectColorPicker } from "../objekte/rgba-picker";
import {
  patternHsv, patternWithHue, patternWithSaturationValue,
} from "../material/pattern-color-behavior";

export interface BuildingColorSample {
  readonly color: number;
  readonly alphaByte: number;
}
export interface BuildingColorPickerHooks {
  onCommit(color: number, alpha: number): void;
  sampleMapColor?: () => Promise<BuildingColorSample | null>;
  onClose?(): void;
}
export interface MountedBuildingColorPicker {
  readonly element: HTMLElement;
  close(): void;
}

/** Building Floor and Wall share the directly measured live ARGB dialog rule. */
export function mountBuildingColorPicker(
  host: HTMLElement,
  color: number,
  alpha: number,
  label: string,
  hooks: BuildingColorPickerHooks,
): MountedBuildingColorPicker {
  const doc = host.ownerDocument;
  const dialog = doc.createElement("section");
  dialog.className = "dn-building-color-picker";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", label);
  dialog.tabIndex = -1;
  const field = doc.createElement("div");
  field.className = "dn-building-color-field";
  field.setAttribute("aria-label", label + " Sättigung und Helligkeit");
  const hue = doc.createElement("input");
  hue.type = "range";
  hue.min = "0";
  hue.max = "1000";
  hue.step = "1";
  hue.setAttribute("aria-label", label + " Farbton");
  const preview = doc.createElement("div");
  preview.className = "dn-building-color-preview";
  preview.setAttribute("aria-label", label + " Vorschau");
  const channels = new Map<"r" | "g" | "b" | "a", HTMLInputElement>();
  const channelRows = doc.createElement("div");
  channelRows.className = "dn-building-color-channels";
  const hexRow = doc.createElement("label");
  hexRow.textContent = "Hex #";
  const hex = doc.createElement("input");
  hex.type = "text";
  hex.maxLength = 9;
  hex.setAttribute("aria-label", label + " Hex ARGB");
  hexRow.append(hex);
  const actions = doc.createElement("div");
  actions.className = "dn-building-color-actions";
  const pipette = doc.createElement("button");
  pipette.type = "button";
  pipette.textContent = "Pipette";
  pipette.disabled = !hooks.sampleMapColor;
  const accept = doc.createElement("button");
  accept.type = "button";
  accept.textContent = "Accept";
  actions.append(pipette, accept);
  let sampling = false;
  const controller = new ObjectColorPicker(color, alpha, {
    onPreview: () => sync(),
    onCommit: hooks.onCommit,
    onClose: () => {
      doc.removeEventListener("pointerdown", outside, true);
      dialog.remove();
      hooks.onClose?.();
    },
  });
  const rgb = () => {
    const value = controller.value;
    return (value.r << 16) | (value.g << 8) | value.b;
  };
  const sync = (source?: HTMLInputElement) => {
    const value = controller.value;
    for (const [key, input] of channels)
      if (input !== source) input.value = String(value[key]);
    if (source !== hex) hex.value = controller.hexDisplay;
    const hsv = patternHsv(rgb());
    if (source !== hue) hue.value = String(Math.round(hsv.hue * 1000));
    field.style.background = "linear-gradient(to top, #000, transparent), " +
      `linear-gradient(to right, #fff, hsl(${Math.round(hsv.hue * 360)} 100% 50%))`;
    preview.style.backgroundColor = `rgba(${value.r},${value.g},${value.b},${value.a / 255})`;
  };
  const replaceRgb = (next: number) => {
    controller.setHex(controller.value.a.toString(16).padStart(2, "0") +
      next.toString(16).padStart(6, "0"));
    sync();
  };
  for (const key of ["r", "g", "b", "a"] as const) {
    const row = doc.createElement("label");
    row.textContent = key.toUpperCase();
    const input = doc.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "255";
    input.step = "1";
    input.setAttribute("aria-label", label + " " + key.toUpperCase());
    input.addEventListener("input", () => {
      if (controller.setChannel(key, Number(input.value))) sync(input);
    });
    input.addEventListener("change", () => { input.value = String(controller.value[key]); });
    row.append(input);
    channelRows.append(row);
    channels.set(key, input);
  }
  hex.addEventListener("input", () => {
    const draft = hex.value;
    if (controller.setHex(draft)) {
      // onPreview synchronizes the other fields; keep the user's hex draft.
      hex.value = draft;
      sync(hex);
    }
  });
  const finishHex = () => {
    const draft = hex.value.trim().replace(/^#/, "");
    // The Building dialog previews six-digit RGB with the current alpha, then
    // interprets the completed value as opaque when the field is left.
    if (/^[0-9a-f]{6}$/i.test(draft)) controller.setHex("ff" + draft);
    hex.value = controller.hexDisplay;
  };
  hex.addEventListener("change", finishHex);
  hue.addEventListener("input", () =>
    replaceRgb(patternWithHue(rgb(), Number(hue.value) / 1000)));
  field.addEventListener("pointerdown", (event) => {
    const bounds = field.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const saturation = Math.max(0, Math.min(1,
      (event.clientX - bounds.left) / bounds.width));
    const value = Math.max(0, Math.min(1,
      1 - (event.clientY - bounds.top) / bounds.height));
    replaceRgb(patternWithSaturationValue(rgb(), saturation, value));
  });
  pipette.addEventListener("click", async () => {
    if (!hooks.sampleMapColor) return;
    sampling = true;
    pipette.disabled = true;
    try {
      const sample = await hooks.sampleMapColor();
      if (sample && !controller.isClosed)
        controller.setHex(sample.alphaByte.toString(16).padStart(2, "0") +
          sample.color.toString(16).padStart(6, "0"));
    } finally {
      sampling = false;
      pipette.disabled = false;
      sync();
    }
  });
  const close = (reason: "accept" | "escape") => {
    if (doc.activeElement === hex) finishHex();
    controller.close(reason);
  };
  accept.addEventListener("click", () => close("accept"));
  dialog.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close("escape");
    }
  });
  const outside = (event: PointerEvent) => {
    if (!sampling && !dialog.contains(event.target as Node))
      close("escape");
  };
  dialog.append(field, hue, preview, channelRows, hexRow, actions);
  host.append(dialog);
  doc.addEventListener("pointerdown", outside, true);
  sync();
  dialog.focus();
  return { element: dialog, close: () => close("escape") };
}
