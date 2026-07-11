package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit;

final class DungeonEditorDoorBoundaryDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorDoorBoundaryDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.DOOR_CREATE || tool == DungeonEditorTool.DOOR_DELETE;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
        ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                doorTool == DungeonEditorTool.DOOR_DELETE,
                transitionDestination);
        if (doorTool == DungeonEditorTool.DOOR_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
        } else if (doorTool == DungeonEditorTool.DOOR_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported door draft tool: " + doorTool);
        }
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool doorTool
    ) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorDoorBoundaryDraftInterpretation interpretation =
                context.doorBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        doorTool);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(interpretation.effect(), commitFor(interpretation.commit())));
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit commitFor(
            @Nullable DoorBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> context.applyDoorBoundary(
                mapId,
                commit.clusterId(),
                commit.edge().toEdgeRef(),
                commit.deleteMode());
    }

}
