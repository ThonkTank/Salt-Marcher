// src/apps/cartographer/modes/travel-guide/interaction-controller.ts
// Kapselt Interaktionen für den Travel-Guide.
import { createDragController, type DragController } from "../../travel/ui/drag.controller";
import { bindContextMenu } from "../../travel/ui/contextmenue";
import type { RenderAdapter } from "../../travel/infra/adapter";
import type { LogicStateSnapshot } from "../../travel/domain/types";

export interface InteractionLogicPort {
    getState(): LogicStateSnapshot;
    selectDot(index: number): void;
    moveSelectedTo(rc: { r: number; c: number }): void;
    moveTokenTo(rc: { r: number; c: number }): void;
    deleteUserAt(index: number): void;
    triggerEncounterAt?(index: number): void | Promise<void>;
}

export interface InteractionEnvironment {
    routeLayerEl: SVGGElement;
    tokenLayerEl: SVGGElement;
    token: RenderAdapter["token"];
    adapter: RenderAdapter;
    polyToCoord: (poly: SVGPolygonElement) => { r: number; c: number };
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
                moveSelectedTo: (rc) => logic.moveSelectedTo(rc),
                moveTokenTo: (rc) => logic.moveTokenTo(rc),
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
