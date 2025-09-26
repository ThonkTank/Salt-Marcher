export class Notice {
    message: string | undefined;
    constructor(message?: string) {
        this.message = message;
    }
}

export class TFile {
    path = "";
    basename = "";
}

export class WorkspaceLeaf {
    view: unknown = null;
    setViewState = async (_state: unknown) => {};
    detach = async () => {};
}

export class ItemView {
    containerEl: HTMLElement;
    app: App | null = null;
    constructor(public leaf: WorkspaceLeaf) {
        this.containerEl = document.createElement("div");
    }
    getViewType(): string {
        return "";
    }
}

export class App {
    workspace = {
        getLeavesOfType: (_type: string) => [] as WorkspaceLeaf[],
        getLeaf: (_create: boolean) => new WorkspaceLeaf(),
        revealLeaf: (_leaf: WorkspaceLeaf) => {},
        getActiveFile: () => null as TFile | null,
    };
}

export function setIcon(_el: HTMLElement, _name: string): void {}

export class Modal {
    constructor(public app: App) {}
    open() {}
    close() {}
}

export class FuzzySuggestModal<T> extends Modal {
    getItems(): T[] {
        return [];
    }
    getItemText(_item: T): string {
        return "";
    }
    renderSuggestion(_item: T, _el: HTMLElement): void {}
    onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}
