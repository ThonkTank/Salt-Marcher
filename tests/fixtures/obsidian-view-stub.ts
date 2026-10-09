export class ItemView {
  readonly contentEl: HTMLElement;

  constructor(readonly leaf: { readonly contentEl: HTMLElement }) {
    this.contentEl = leaf.contentEl;
  }
}

export interface WorkspaceLeaf {
  readonly contentEl: HTMLElement;
}
