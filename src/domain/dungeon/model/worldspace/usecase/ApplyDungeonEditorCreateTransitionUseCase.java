package src.domain.dungeon.model.worldspace.usecase;

import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonTransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorCreateTransitionUseCase {
    private static final String INVALID_TRANSITION_DESTINATION_STATUS = "Uebergangsziel ungueltig.";
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateTransitionUseCase(
            DungeonEditorSessionWorkflow workflow,
            CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.createTransitionUseCase = Objects.requireNonNull(createTransitionUseCase, "createTransitionUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        if (!workflow.session().hasSelectedMap() || input == null) {
            effectUseCase.publishCurrent();
            return;
        }
        DungeonCell anchor = anchor(input);
        DungeonTransitionDestination destination = destination(input);
        if (!createTransitionUseCase.canExecute(workflow.session().selectedMapId(), anchor, destination)) {
            workflow.clearPreviewWithStatus(INVALID_TRANSITION_DESTINATION_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createTransitionUseCase.execute(workflow.session().selectedMapId(), anchor, destination);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private DungeonCell anchor(MainViewInput input) {
        return new DungeonCell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }

    private static @Nullable DungeonTransitionDestination destination(MainViewInput input) {
        String type = destinationType(input.transitionDestinationTypeName());
        if (DESTINATION_DUNGEON_MAP.equals(type)) {
            return DungeonTransitionDestination.dungeonMapDestination(
                    input.transitionDestinationMapId(),
                    input.transitionDestinationTransitionId() <= 0L ? null : input.transitionDestinationTransitionId());
        }
        if (DESTINATION_OVERWORLD_TILE.equals(type)) {
            return DungeonTransitionDestination.overworldTileDestination(
                    input.transitionDestinationMapId(),
                    input.transitionDestinationTileId());
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
