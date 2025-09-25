import type { LayoutElementDefinition, LayoutElementType } from "../types";
import { openEditorMenu } from "./editor-menu";
import { createElementsButton } from "../elements/ui";

export interface PaletteRenderOptions {
    host: HTMLElement;
    definitions: LayoutElementDefinition[];
    onCreate(type: LayoutElementType): void;
}

const GROUP_LABELS = new Map<string, string>([
    ["input", "Eingabefelder"],
    ["container", "Container"],
]);

export function renderPalette(options: PaletteRenderOptions) {
    const { host, definitions, onCreate } = options;
    host.empty();

    const grouped = new Map<string, LayoutElementDefinition[]>();
    for (const def of definitions) {
        const group = def.paletteGroup ?? (def.category === "container" ? "container" : "element");
        const bucket = grouped.get(group);
        if (bucket) {
            bucket.push(def);
        } else {
            grouped.set(group, [def]);
        }
    }

    const direct = grouped.get("element") ?? [];
    direct.sort((a, b) => a.buttonLabel.localeCompare(b.buttonLabel, "de"));
    for (const def of direct) {
        const btn = createElementsButton(host, { label: def.buttonLabel });
        btn.onclick = () => onCreate(def.type);
    }

    for (const [group, defs] of grouped) {
        if (group === "element") continue;
        if (!defs.length) continue;
        const label = GROUP_LABELS.get(group) ?? capitalize(group);
        const button = createElementsButton(host, { label });
        button.onclick = event => {
            event.preventDefault();
            const entries = defs
                .slice()
                .sort((a, b) => a.buttonLabel.localeCompare(b.buttonLabel, "de"))
                .map(def => ({
                    type: "item" as const,
                    label: def.buttonLabel,
                    onSelect: () => onCreate(def.type),
                }));
            openEditorMenu({ anchor: button, entries, event });
        };
    }
}

function capitalize(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}
