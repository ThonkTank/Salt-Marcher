package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorPointRuntimeTarget {
    private static final long NO_TARGET_ID = 0L;

    private DungeonEditorPointRuntimeTarget() {
    }

    static Cell anchor(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination,
            int projectionLevel
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                projectionLevel);
    }

    static long targetId(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination,
            DungeonTopologyElementKind expectedKind
    ) {
        DungeonTopologyRef target = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination).target().topologyRef();
        return target.kind() == expectedKind ? target.id() : NO_TARGET_ID;
    }
}
