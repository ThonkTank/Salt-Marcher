import { Menu } from "obsidian";
import type { LayoutElementDefinition, LayoutElementType } from "../types";

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
        const btn = host.createEl("button", { text: def.buttonLabel });
        btn.onclick = () => onCreate(def.type);
    }

    for (const [group, defs] of grouped) {
        if (group === "element") continue;
        if (!defs.length) continue;
        const label = GROUP_LABELS.get(group) ?? capitalize(group);
        const button = host.createEl("button", { text: label });
        button.onclick = event => {
            event.preventDefault();
            const menu = new Menu();
            defs
                .slice()
                .sort((a, b) => a.buttonLabel.localeCompare(b.buttonLabel, "de"))
                .forEach(def => {
                    menu.addItem(item => {
                        item.setTitle(def.buttonLabel);
                        item.onClick(() => onCreate(def.type));
                    });
                });
            menu.showAtMouseEvent(event);
        };
    }
}

function capitalize(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}
