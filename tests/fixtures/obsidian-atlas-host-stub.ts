export { Modal, Notice, Setting, notices } from "./obsidian-atlas-modal-stub";
export class TFile {
  constructor(readonly path: string) {}
  get extension() {
    return this.path.split(".").at(-1)!;
  }
  get basename() {
    return this.path
      .split("/")
      .at(-1)!
      .replace(/\.[^.]+$/, "");
  }
}
export class FileSystemAdapter {}
export class Scope {
  readonly handlers: { modifiers: string[] | null; key: string | null; func: (event: KeyboardEvent, context: any) => any }[] = [];
  constructor(readonly parent?: Scope) {}
  register(modifiers: string[] | null, key: string | null, func: (event: KeyboardEvent, context: any) => any) {
    const handler = { modifiers, key, func };
    this.handlers.push(handler);
    return handler;
  }
}
export interface App {
  document: Document;
  vault: any;
}
export class FileView {
  readonly app: App;
  readonly contentEl: HTMLElement;
  constructor(
    readonly leaf: {
      app: App;
      contentEl: HTMLElement;
      openFile(file: TFile): Promise<void>;
    },
  ) {
    this.app = leaf.app;
    this.contentEl = leaf.contentEl;
  }
  file?: TFile;
}
export const menus: Menu[] = [];
export class Menu {
  readonly items: { title: string; click(): void }[] = [];
  addItem(fn: (item: any) => unknown) {
    const value = { title: "", click: () => {} };
    const item = {
      setTitle: (text: string) => {
        value.title = text;
        return item;
      },
      setIcon: () => item,
      setDisabled: () => item,
      onClick: (click: () => void) => {
        value.click = click;
        return item;
      },
    };
    fn(item);
    this.items.push(value);
    return this;
  }
  showAtMouseEvent() {
    menus.push(this);
  }
}
export class MarkdownRenderer {
  static async render(_app: App, text: string, host: HTMLElement) {
    host.textContent = text;
  }
}
