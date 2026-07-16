package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.DungeonEditorTool;
import features.dungeon.application.editor.DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.WALL_CREATE || tool == DungeonEditorTool.WALL_DELETE;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (wallTool == DungeonEditorTool.WALL_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_CREATE);
        } else if (wallTool == DungeonEditorTool.WALL_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported wall draft tool: " + wallTool);
        }
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool wallTool
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
