package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = java.util.Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.CORRIDOR_CREATE || tool == DungeonEditorTool.CORRIDOR_DELETE;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (corridorTool == DungeonEditorTool.CORRIDOR_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        } else if (corridorTool == DungeonEditorTool.CORRIDOR_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported corridor draft tool: " + corridorTool);
        }
    }

    private DungeonEditorRuntimeContext.Result applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool corridorTool
    ) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect effect =
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
            DungeonEditorSessionValues.@Nullable Preview preview
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
