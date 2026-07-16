package features.dungeon.application.editor;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

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
