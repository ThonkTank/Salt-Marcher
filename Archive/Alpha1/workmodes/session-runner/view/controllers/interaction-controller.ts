// src/workmodes/session-runner/view/controllers/interaction-controller.ts
// Kapselt Interaktionen für den Travel-Guide.
import { bindContextMenu } from "../../travel/ui/context-menu.controller";
import { createDragController, type DragController } from "../../travel/ui/drag.controller";
import type { LogicStateSnapshot } from "../../travel/engine/travel-engine-types";
import type { RenderAdapter } from "../../travel/infra/adapter";

export interface InteractionLogicPort {
    getState(): LogicStateSnapshot;
    selectDot(index: number): void;
    moveSelectedTo(coord: { q: number; r: number }): void;
    moveTokenTo(coord: { q: number; r: number }): void;
    deleteUserAt(index: number): void;
    triggerEncounterAt?(index: number): void | Promise<void>;
}

export interface InteractionEnvironment {
    routeLayerEl: SVGGElement;
    tokenLayerEl: SVGGElement;
    token: RenderAdapter["token"];
    adapter: RenderAdapter;
    polyToCoord: (poly: SVGPolygonElement) => { q: number; r: number };
}

export class TravelInteractionController {
    private drag: DragController | null = null;
    private unbindContext: (() => void) | null = null;

    bind(env: InteractionEnvironment, logic: InteractionLogicPort) {
        this.dispose();
        this.drag = createDragController({
            routeLayerEl: env.routeLayerEl,
            tokenEl: env.tokenLayerEl,
            token: env.token,
            adapter: env.adapter,
            logic: {
                getState: () => logic.getState(),
                selectDot: (idx) => logic.selectDot(idx),
                moveSelectedTo: (coord) => logic.moveSelectedTo(coord),
                moveTokenTo: (coord) => logic.moveTokenTo(coord),
            },
            polyToCoord: env.polyToCoord,
        });
        this.drag.bind();
        this.unbindContext = bindContextMenu(env.routeLayerEl, {
            getState: () => logic.getState(),
            deleteUserAt: (idx) => logic.deleteUserAt(idx),
            triggerEncounterAt: (idx) => logic.triggerEncounterAt?.(idx),
        });
    }

    consumeClickSuppression(): boolean {
        return this.drag?.consumeClickSuppression() ?? false;
    }

    dispose() {
        if (this.drag) {
            this.drag.unbind();
            this.drag = null;
        }
        if (this.unbindContext) {
            this.unbindContext();
            this.unbindContext = null;
        }
    }
}
