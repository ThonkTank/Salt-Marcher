package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonStairShape;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

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
        DungeonCell anchor = anchor(input);
        if (!createStairUseCase.canExecute(workflow.session().selectedMapId(), anchor, shape.name())) {
            workflow.clearPreviewWithStatus(INVALID_STAIR_GEOMETRY_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createStairUseCase.execute(workflow.session().selectedMapId(), anchor, shape.name());
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private DungeonCell anchor(MainViewInput input) {
        return new DungeonCell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }
}
