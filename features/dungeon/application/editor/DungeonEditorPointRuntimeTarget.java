package features.dungeon.application.editor;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;

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
        DungeonEditorMainViewInput input = DungeonEditorMainViewInput.fromPointer(
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
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target = DungeonEditorMainViewInput.fromPointer(
                sample,
                wallSingleClickMode,
                transitionDestination).target();
        return target.topologyKind() == DungeonEditorMainViewInteractionValues.topologyKind(expectedKind)
                ? target.topologyId()
                : NO_TARGET_ID;
    }
}
