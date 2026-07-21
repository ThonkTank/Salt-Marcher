package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.application.editor.DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorToolAction tool) {
        return tool != null && tool.family() == DungeonEditorToolFamily.WALL;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorToolAction wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorMainViewInput.fromPointer(
                sample,
                wallSingleClickMode,
                transitionDestination);
        return applyWorkflow(action, input, wallTool);
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorToolAction wallTool
    ) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorWallBoundaryDraftInterpretation interpretation =
                context.wallBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        wallTool);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(interpretation.effect(), commitFor(interpretation.commit())));
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit commitFor(
            @Nullable WallBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> context.applyWallBoundary(
                mapId,
                commit.clusterId(),
                DungeonEditorBoundaryDraftEffectHelper.edgeRefs(commit.edges()),
                commit.deleteMode());
    }

}
