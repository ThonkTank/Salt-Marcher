package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorStairDeleteRuntimeOperation {
    private static final long NO_STAIR_ID = 0L;

    private final DungeonEditorRuntimeContext context;

    DungeonEditorStairDeleteRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.STAIR_DELETE;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!PointerAction.isPressed(action)) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        if (!context.hasSelectedMap()) {
            return context.publishCurrent();
        }
        long stairId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.STAIR);
        if (stairId <= NO_STAIR_ID) {
            return context.publishCurrent();
        }
        boolean deleted = context.deleteStair(context.selectedMapId(), stairId);
        if (deleted) {
            context.applySessionEffect(DungeonEditorSessionEffect.clearedSelection());
            context.clearPreviewWithStatus(context.currentFacts().mutationStatusText());
        }
        return context.publishCurrent();
    }

}
