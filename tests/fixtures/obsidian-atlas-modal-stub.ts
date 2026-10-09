import { parseHTML } from "linkedom";

export const notices: string[] = [];
export function modalTestApp() {
  const { document, window } = parseHTML("<html><body></body></html>");
  Object.defineProperty(window.HTMLElement.prototype, "createEl", {
    configurable: true,
    value(this: HTMLElement, tag: string, options: { text?: string } = {}) {
      const child = this.ownerDocument.createElement(tag);
      child.textContent = options.text ?? "";
      this.appendChild(child);
      return child;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "empty", {
    configurable: true,
    value(this: HTMLElement) {
      this.replaceChildren();
    },
  });
  notices.length = 0;
  return { app: { document }, document, window };
}
export interface App {
  document: Document;
}
export class Modal {
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  contentEl: HTMLElement;
  private key: (event: Event) => void;
  constructor(readonly app: App) {
    const d = app.document;
    this.containerEl = d.createElement("div");
    this.containerEl.className = "modal-container";
    this.modalEl = this.containerEl.appendChild(d.createElement("div"));
    this.modalEl.className = "modal";
    const close = this.modalEl.appendChild(d.createElement("button"));
    close.className = "modal-header-button";
    close.textContent = "X";
    close.addEventListener("click", () => this.close());
    this.contentEl = this.modalEl.appendChild(d.createElement("div"));
    this.key = (event) => {
      if ((event as KeyboardEvent).key === "Escape") this.close();
    };
    this.containerEl.addEventListener("click", (event) => {
      if (event.target === this.containerEl && this.canDismiss()) this.close();
    });
  }
  setTitle(text: string) {
    this.modalEl.setAttribute("aria-label", text);
    return this;
  }
  canDismiss() {
    return true;
  }
  open() {
    this.app.document.body.appendChild(this.containerEl);
    this.app.document.addEventListener("keydown", this.key);
    this.onOpen();
  }
  close() {
    this.app.document.removeEventListener("keydown", this.key);
    this.containerEl.remove();
    this.onClose();
  }
  onOpen() {}
  onClose() {}
}
export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}
class TextComponent {
  constructor(readonly inputEl: HTMLInputElement) {}
  setValue(value: string) {
    this.inputEl.value = value;
    return this;
  }
  onChange(fn: (value: string) => void) {
    this.inputEl.addEventListener("input", () => fn(this.inputEl.value));
    return this;
  }
}
class ButtonComponent {
  constructor(readonly buttonEl: HTMLButtonElement) {}
  setButtonText(value: string) {
    this.buttonEl.textContent = value;
    return this;
  }
  setCta() {
    return this;
  }
  onClick(fn: () => unknown) {
    this.buttonEl.addEventListener("click", () => {
      if (!this.buttonEl.disabled) fn();
    });
    return this;
  }
}
export class Setting {
  constructor(readonly el: HTMLElement) {}
  setName(_name: string) {
    return this;
  }
  addText(fn: (text: TextComponent) => void) {
    fn(
      new TextComponent(
        this.el.appendChild(this.el.ownerDocument.createElement("input")),
      ),
    );
    return this;
  }
  addButton(fn: (button: ButtonComponent) => void) {
    fn(
      new ButtonComponent(
        this.el.appendChild(this.el.ownerDocument.createElement("button")),
      ),
    );
    return this;
  }
}
