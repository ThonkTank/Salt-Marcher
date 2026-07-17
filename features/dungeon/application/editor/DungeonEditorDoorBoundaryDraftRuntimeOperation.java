package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.application.editor.DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit;

final class DungeonEditorDoorBoundaryDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorDoorBoundaryDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorToolAction tool) {
        return tool != null && tool.family() == DungeonEditorToolFamily.DOOR;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorToolAction doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
        ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                doorTool.deleteMode(),
                transitionDestination);
        return applyWorkflow(action, input, doorTool);
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorToolAction doorTool
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
