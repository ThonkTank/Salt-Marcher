export class ItemView {
  readonly contentEl: HTMLElement;

  constructor(readonly leaf: { readonly contentEl: HTMLElement }) {
    this.contentEl = leaf.contentEl;
  }
}

export interface WorkspaceLeaf {
  readonly contentEl: HTMLElement;
}

export function setIcon(): void {}

export class TFile { path = ""; }
export class FileSystemAdapter {}

export interface App {
  readonly vault: { getName(): string };
}

export class Component {
  load(): void {}
  unload(): void {}
}

export const MarkdownRenderer = {
  async render(
    _app: App,
    markdown: string,
    host: HTMLElement,
    _path: string,
    _component: Component,
  ): Promise<void> {
    host.textContent = markdown;
  },
};
