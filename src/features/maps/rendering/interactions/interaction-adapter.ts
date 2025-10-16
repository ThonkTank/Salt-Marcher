// src/features/maps/rendering/interactions/interaction-adapter.ts
import { App, TFile } from "obsidian";
import { getCenterLeaf } from "../../../../ui/utils/layout";
import { saveTile } from "../../data/tile-repository";
import { createEventBackedInteractionDelegate } from "./interaction-delegate";
import type { HexCoord, HexInteractionAdapter, HexInteractionDelegate } from "./types";

export type InteractionAdapterConfig = {
    app: App;
    host: HTMLElement;
    mapPath: string;
};

function resolveMapFile(app: App, mapPath: string): TFile | null {
    const abstract = app.vault.getAbstractFileByPath(mapPath);
    return abstract instanceof TFile ? abstract : null;
}

export function createInteractionAdapter(config: InteractionAdapterConfig): HexInteractionAdapter {
    const { app, host, mapPath } = config;
    const defaultDelegate = createEventBackedInteractionDelegate(host);
    const delegateRef = { current: defaultDelegate as HexInteractionDelegate };

    const handleDefaultClick = async (coord: HexCoord, _ev: MouseEvent): Promise<void> => {
        const file = resolveMapFile(app, mapPath);
        if (!file) return;
        const tfile = await saveTile(app, file, coord, { terrain: "" });
        const leaf = getCenterLeaf(app);
        await leaf.openFile(tfile, { active: true });
    };

    const setDelegate = (delegate: HexInteractionDelegate | null) => {
        delegateRef.current = delegate ?? defaultDelegate;
    };

    return {
        delegateRef,
        handleDefaultClick,
        setDelegate,
    };
}
