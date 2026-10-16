/** Centers of the five native 1.2.0.1 Light swatches in 37-light-palette.png. */
export const LIGHT_COLOR_PRESETS = [
  { id: "warm", color: 0xeccd8b, label: "Warm" },
  { id: "pale", color: 0xeaefca, label: "Blass" },
  { id: "blue", color: 0x80beff, label: "Blau" },
  { id: "orange", color: 0xffad58, label: "Orange" },
  { id: "green", color: 0x4dd569, label: "Grün" },
] as const;

export class LightColorPalette {
  private opened = false;
  constructor(private onSelect: (color: number) => void) {}

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
  }

  close(): void {
    this.opened = false;
  }

  select(id: (typeof LIGHT_COLOR_PRESETS)[number]["id"]): number {
    if (!this.opened) throw new Error("Lichtfarbpalette ist geschlossen.");
    const preset = LIGHT_COLOR_PRESETS.find((item) => item.id === id)!;
    this.opened = false;
    this.onSelect(preset.color);
    return preset.color;
  }
}

export function mountLightColorPalette(
  host: HTMLElement,
  onSelect: (color: number) => void,
): HTMLElement {
  const state = new LightColorPalette(onSelect);
  const row = document.createElement("div");
  row.className = "dn-light-color-palette";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Farben";
  toggle.setAttribute("aria-label", "Lichtfarbpalette öffnen");
  toggle.setAttribute("aria-expanded", "false");
  const options = document.createElement("div");
  options.className = "dn-light-color-presets";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "Lichtfarbvorgaben");
  options.hidden = true;
  const show = () => {
    options.hidden = !state.isOpen;
    toggle.setAttribute("aria-expanded", String(state.isOpen));
  };
  toggle.addEventListener("click", () => {
    if (state.isOpen) state.close();
    else state.open();
    show();
  });
  for (const preset of LIGHT_COLOR_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dn-light-color-preset";
    button.setAttribute("aria-label", `Lichtfarbe ${preset.label}`);
    button.title = preset.label;
    button.style.backgroundColor =
      "#" + preset.color.toString(16).padStart(6, "0");
    button.addEventListener("click", () => {
      state.select(preset.id);
      show();
    });
    options.append(button);
  }
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    state.close();
    show();
    toggle.focus();
  });
  row.append(toggle, options);
  host.append(row);
  return row;
}
