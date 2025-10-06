// src/apps/library/create/shared/token-editor.ts
import { Setting } from "obsidian";

export interface TokenEditorModel {
  getItems(): string[];
  add(value: string): void;
  remove(index: number): void;
}

export interface TokenEditorCallbacks {
  onAdd?: (value: string) => void;
  onRemove?: (value: string, index: number) => void;
}

export interface TokenEditorOptions extends TokenEditorCallbacks {
  placeholder?: string;
  addButtonLabel?: string;
}

export interface TokenEditorHandle {
  setting: Setting;
  chipsEl: HTMLElement;
  refresh: () => void;
}

export function mountTokenEditor(
  parent: HTMLElement,
  title: string,
  model: TokenEditorModel,
  options: TokenEditorOptions = {}
): TokenEditorHandle {
  const placeholder = options.placeholder ?? "Begriff eingeben…";
  const addLabel = options.addButtonLabel ?? "+";

  const setting = new Setting(parent).setName(title);
  setting.settingEl.addClass("sm-cc-setting");
  setting.settingEl.addClass("sm-cc-setting--show-name");
  setting.settingEl.addClass("sm-cc-setting--token-editor");
  let inputEl: HTMLInputElement | undefined;
  let renderChips: () => void = () => {};

  const commitValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    model.add(trimmed);
    options.onAdd?.(trimmed);
    renderChips();
  };

  setting.addText((t) => {
    t.setPlaceholder(placeholder);
    inputEl = t.inputEl;
    t.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        commitValue((inputEl?.value ?? "").trim());
        if (inputEl) inputEl.value = "";
      }
    });
  });

  setting.addButton((b) =>
    b
      .setButtonText(addLabel)
      .onClick(() => {
        commitValue((inputEl?.value ?? "").trim());
        if (inputEl) inputEl.value = "";
      })
  );

  const chips = parent.createDiv({ cls: "sm-cc-chips" });
  renderChips = () => {
    chips.empty();
    const items = model.getItems();
    items.forEach((txt, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", { text: "×" });
      removeBtn.onclick = () => {
        model.remove(index);
        options.onRemove?.(txt, index);
        renderChips();
      };
    });
  };

  renderChips();

  return { setting, chipsEl: chips, refresh: renderChips };
}
