// plugins/layout-editor/src/view-registry.ts
// Verwaltet View-Bindings, sodass externe Plugins visualisierbare Features
// (z. B. Kartenrenderer) an den Layout Editor koppeln können. Komponenten wie
// der View Container greifen auf diese Registry zu, um im Inspector eine
// Auswahl anzubieten.

export interface LayoutViewBindingDefinition {
    id: string;
    label: string;
    description?: string;
    tags?: string[];
}

type Listener = (bindings: LayoutViewBindingDefinition[]) => void;

class LayoutViewBindingRegistry {
    private readonly bindings = new Map<string, LayoutViewBindingDefinition>();
    private readonly listeners = new Set<Listener>();

    register(def: LayoutViewBindingDefinition) {
        if (!def.id?.trim()) {
            throw new Error("View binding requires a non-empty id");
        }
        const id = def.id.trim();
        this.bindings.set(id, { ...def, id });
        this.emit();
    }

    unregister(id: string) {
        if (this.bindings.delete(id)) {
            this.emit();
        }
    }

    replaceAll(definitions: LayoutViewBindingDefinition[]) {
        this.bindings.clear();
        for (const def of definitions) {
            if (!def.id?.trim()) continue;
            const id = def.id.trim();
            this.bindings.set(id, { ...def, id });
        }
        this.emit();
    }

    getAll(): LayoutViewBindingDefinition[] {
        return Array.from(this.bindings.values());
    }

    get(id: string): LayoutViewBindingDefinition | undefined {
        return this.bindings.get(id);
    }

    onChange(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        const snapshot = this.getAll();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}

const registry = new LayoutViewBindingRegistry();

export function registerViewBinding(definition: LayoutViewBindingDefinition) {
    registry.register(definition);
}

export function unregisterViewBinding(id: string) {
    registry.unregister(id);
}

export function resetViewBindings(definitions: LayoutViewBindingDefinition[] = []) {
    registry.replaceAll(definitions);
}

export function getViewBindings(): LayoutViewBindingDefinition[] {
    return registry.getAll();
}

export function getViewBinding(id: string): LayoutViewBindingDefinition | undefined {
    return registry.get(id);
}

export function onViewBindingsChanged(listener: Listener): () => void {
    return registry.onChange(listener);
}
