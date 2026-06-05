package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.worldspace.DungeonStairShape;

public final class ApplyDungeonEditorCreateStairUseCase {
    private static final String INVALID_STAIR_GEOMETRY_STATUS = "Treppengeometrie ungueltig.";

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredStairUseCase createStairUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateStairUseCase(
            DungeonEditorSessionWorkflow workflow,
            CreateDungeonEditorAuthoredStairUseCase createStairUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.createStairUseCase = Objects.requireNonNull(createStairUseCase, "createStairUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        press(input, DungeonStairShape.STRAIGHT);
    }

    public void pressSquare(MainViewInput input) {
        press(input, DungeonStairShape.SQUARE);
    }

    public void pressCircular(MainViewInput input) {
        press(input, DungeonStairShape.CIRCULAR);
    }

    private void press(MainViewInput input, DungeonStairShape shape) {
        if (!workflow.session().hasSelectedMap() || input == null) {
            effectUseCase.publishCurrent();
            return;
        }
        Cell anchor = anchor(input);
        if (!createStairUseCase.canExecute(workflow.session().selectedMapId(), anchor, shape.name())) {
            workflow.clearPreviewWithStatus(INVALID_STAIR_GEOMETRY_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createStairUseCase.execute(workflow.session().selectedMapId(), anchor, shape.name());
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private Cell anchor(MainViewInput input) {
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }
}
