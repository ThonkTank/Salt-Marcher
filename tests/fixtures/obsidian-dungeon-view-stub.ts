import { parseHTML } from "linkedom";

export function dungeonViewTestDom(): {
  document: Document;
  window: Window;
  root: HTMLElement;
} {
  const { document, window } = parseHTML("<html><body><main id='root'></main></body></html>");
  Object.defineProperty(window.HTMLElement.prototype, "createEl", {
    configurable: true,
    value(this: HTMLElement, tag: string, options: { text?: string } = {}) {
      const child = this.ownerDocument.createElement(tag);
      child.textContent = options.text ?? "";
      this.appendChild(child);
      return child;
    },
  });
  return {
    document: document as unknown as Document,
    window: window as unknown as Window,
    root: document.querySelector<HTMLElement>("#root")!,
  };
}

export interface App {}

export class TFile {
  constructor(public path: string) {}
  get basename(): string {
    return this.path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? this.path;
  }
  get extension(): string {
    return this.path.split(".").at(-1) ?? "";
  }
}

export class ItemView {
  readonly contentEl: HTMLElement;
  readonly app: any;
  constructor(readonly leaf: any) {
    this.contentEl = leaf.contentEl;
    this.app = leaf.app;
  }
}

export class FileView extends ItemView {
  file: TFile | null = null;
  getState(): Record<string, unknown> {
    return this.leaf.baseState ?? (this.file ? { file: this.file.path } : {});
  }
  async setState(state: unknown, result: unknown): Promise<void> {
    this.leaf.setStateCalls?.push({ state, result });
    await this.leaf.onSetState?.(state, result);
  }
  async onRename(file: TFile): Promise<void> {
    this.file = file;
  }
}

export class MarkdownRenderChild {
  constructor(readonly containerEl: HTMLElement) {}
}

export class Notice {
  constructor(_message: string, _duration?: number) {}
}

export function setIcon(): void {}

export class Component {
  load(): void {}
  unload(): void {}
}

export const MarkdownRenderer = {
  async render(
    _app: unknown,
    markdown: string,
    host: HTMLElement,
  ): Promise<void> {
    host.textContent = markdown;
  },
};

export class Modal {
  readonly contentEl = globalThis.document?.createElement("div") as HTMLElement;
  constructor(readonly app: unknown) {}
  open(): void {}
  close(): void {}
  setTitle(): this { return this; }
}

class Control {
  readonly inputEl = globalThis.document?.createElement("input") as HTMLInputElement;
  readonly buttonEl = globalThis.document?.createElement("button") as HTMLButtonElement;
  setValue(): this { return this; }
  setButtonText(): this { return this; }
  setIcon(): this { return this; }
  setTooltip(): this { return this; }
  setCta(): this { return this; }
  setWarning(): this { return this; }
  setDisabled(): this { return this; }
  addOption(): this { return this; }
  onChange(): this { return this; }
  onClick(): this { return this; }
}

export class ButtonComponent extends Control {}
export class DropdownComponent extends Control {}
export class SliderComponent extends Control {
  setLimits(): this { return this; }
  setDynamicTooltip(): this { return this; }
}
export class TextComponent extends Control {}
export class ExtraButtonComponent extends Control {}
export class ToggleComponent extends Control {}

export class Setting {
  constructor(readonly settingEl: HTMLElement) {}
  setName(): this { return this; }
  setDesc(): this { return this; }
  addText(callback: (control: TextComponent) => void): this {
    callback(new TextComponent());
    return this;
  }
  addButton(callback: (control: ButtonComponent) => void): this {
    callback(new ButtonComponent());
    return this;
  }
  addDropdown(callback: (control: DropdownComponent) => void): this {
    callback(new DropdownComponent());
    return this;
  }
  addSlider(callback: (control: SliderComponent) => void): this {
    callback(new SliderComponent());
    return this;
  }
  addExtraButton(callback: (control: ExtraButtonComponent) => void): this {
    callback(new ExtraButtonComponent());
    return this;
  }
  addToggle(callback: (control: ToggleComponent) => void): this {
    callback(new ToggleComponent());
    return this;
  }
}

export class FileSystemAdapter {}
