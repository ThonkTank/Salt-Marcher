package src.features.dungeon.runtime;

import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorTransitionRuntimeOperation {
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";
    private static final String INVALID_TRANSITION_DESTINATION_STATUS = "Uebergangsziel ungueltig.";
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase;
    private final DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    DungeonEditorTransitionRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        createTransitionUseCase = Objects.requireNonNull(
                safeRuntime.authored().createTransitionUseCase(),
                "createTransitionUseCase");
        deleteTransitionUseCase = Objects.requireNonNull(
                safeRuntime.authored().deleteTransitionUseCase(),
                "deleteTransitionUseCase");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.TRANSITION_CREATE || tool == DungeonEditorTool.TRANSITION_DELETE;
    }

    void apply(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!PointerAction.isPressed(action)) {
            return;
        }
        if (tool == DungeonEditorTool.TRANSITION_CREATE) {
            createTransition(sample, wallSingleClickMode, transitionDestination);
            return;
        }
        if (tool == DungeonEditorTool.TRANSITION_DELETE) {
            deleteTransition(sample, wallSingleClickMode, transitionDestination);
        }
    }

    private void deleteTransition(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long transitionId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.TRANSITION);
        if (transitionId <= NO_TRANSITION_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteTransitionUseCase.execute(workflow.session().selectedMapId(), transitionId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private void createTransition(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        Cell anchor = DungeonEditorPointRuntimeTarget.anchor(
                sample,
                wallSingleClickMode,
                transitionDestination,
                workflow.session().projectionLevel());
        src.domain.dungeon.model.core.structure.transition.TransitionDestination destination =
                destination(transitionDestination);
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        if (!createTransitionUseCase.canExecute(workflow.session().selectedMapId(), anchor, destination)) {
            workflow.clearPreviewWithStatus(INVALID_TRANSITION_DESTINATION_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createTransitionUseCase.execute(workflow.session().selectedMapId(), anchor, destination);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private static src.domain.dungeon.model.core.structure.transition.TransitionDestination destination(
            TransitionDestination runtimeDestination
    ) {
        TransitionDestination safeDestination =
                runtimeDestination == null ? TransitionDestination.empty() : runtimeDestination;
        String type = destinationType(safeDestination.destinationType());
        if (DESTINATION_DUNGEON_MAP.equals(type)) {
            return src.domain.dungeon.model.core.structure.transition.TransitionDestination.dungeonMap(
                    safeDestination.targetMapId(),
                    safeDestination.targetTransitionId() <= 0L ? null : safeDestination.targetTransitionId());
        }
        if (DESTINATION_OVERWORLD_TILE.equals(type)) {
            return src.domain.dungeon.model.core.structure.transition.TransitionDestination.overworldTile(
                    safeDestination.targetMapId(),
                    safeDestination.targetTileId());
        }
        return null;
    }

    private static @Nullable String destinationType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return DESTINATION_OVERWORLD_TILE;
        }
        if (DESTINATION_DUNGEON_MAP.equals(normalized)) {
            return DESTINATION_DUNGEON_MAP;
        }
        return DESTINATION_OVERWORLD_TILE.equals(normalized) ? DESTINATION_OVERWORLD_TILE : null;
    }
}
