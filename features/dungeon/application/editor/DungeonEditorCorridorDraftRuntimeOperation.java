package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.editor.DungeonEditorToolFamily;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorToolAction tool) {
        return tool != null && tool.family() == DungeonEditorToolFamily.CORRIDOR;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorToolAction corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorMainViewInput.fromPointer(
                sample,
                wallSingleClickMode,
                transitionDestination);
        return applyWorkflow(action, input, corridorTool);
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorToolAction corridorTool
    ) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        features.dungeon.application.editor.session.DungeonEditorSessionEffect effect =
                context.corridor(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        corridorTool);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(effect, commitFor(effect.getApplyPreview())));
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit commitFor(
            features.dungeon.application.editor.session.DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        return switch (preview) {
            case DungeonEditorSessionValues.CorridorCreatePreview corridor ->
                    mapId -> context.createCorridor(mapId, corridor);
            case DungeonEditorSessionValues.DeleteCorridorPreview corridor ->
                    mapId -> context.deleteCorridor(mapId, corridor);
            case null, default -> null;
        };
    }

}
