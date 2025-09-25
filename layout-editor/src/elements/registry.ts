import { LayoutElementType, LayoutElementDefinition } from "../types";
import type { LayoutElementComponent } from "./base";
import { COMPONENTS } from "./component-manifest";

const components: LayoutElementComponent[] = [...COMPONENTS];
const componentByType = new Map<LayoutElementType, LayoutElementComponent>();

for (const component of components) {
    if (!component?.definition) continue;
    if (componentByType.has(component.definition.type)) {
        console.warn(`Duplicate layout element component for type "${component.definition.type}"`);
    }
    componentByType.set(component.definition.type, component);
}

export function getLayoutElementComponents(): LayoutElementComponent[] {
    return components;
}

export function getLayoutElementComponent(type: LayoutElementType): LayoutElementComponent | undefined {
    return componentByType.get(type);
}

export function createDefaultElementDefinitions(): LayoutElementDefinition[] {
    return components.map(component => ({ ...component.definition }));
}
