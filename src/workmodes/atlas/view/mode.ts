// src/workmodes/atlas/view/mode.ts
// Basistypen für Atlas-Modi (Terrains & Regionen) auf Basis der Workmode-Infrastruktur.
import { BaseModeRenderer as SharedBaseModeRenderer, scoreName as sharedScoreName } from "../../../ui";
import type { ModeRenderer as SharedModeRenderer } from "../../../ui";

export type AtlasMode = "terrains" | "regions";

export interface AtlasModeRenderer extends SharedModeRenderer<AtlasMode> {
    readonly mode: AtlasMode;
}

export abstract class BaseModeRenderer extends SharedBaseModeRenderer<AtlasMode> implements AtlasModeRenderer {
    readonly abstract mode: AtlasMode;

    setQuery(query: string): void {
        this.query = (query || "").toLowerCase();
        this.render();
    }
}

export const scoreName = sharedScoreName;
