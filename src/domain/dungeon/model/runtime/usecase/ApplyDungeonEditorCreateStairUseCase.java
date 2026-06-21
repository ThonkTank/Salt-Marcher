package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

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

    public void press(Cell anchor) {
        press(anchor, StairShape.STRAIGHT);
    }

    public void pressSquare(Cell anchor) {
        press(anchor, StairShape.SQUARE);
    }

    public void pressCircular(Cell anchor) {
        press(anchor, StairShape.CIRCULAR);
    }

    public void hover(Cell anchor) {
        hover(anchor, StairShape.STRAIGHT);
    }

    public void hoverSquare(Cell anchor) {
        hover(anchor, StairShape.SQUARE);
    }

    public void hoverCircular(Cell anchor) {
        hover(anchor, StairShape.CIRCULAR);
    }

    private void press(Cell anchor, StairShape shape) {
        if (!workflow.session().hasSelectedMap() || anchor == null) {
            effectUseCase.publishCurrent();
            return;
        }
        if (!createStairUseCase.canExecute(workflow.session().selectedMapId(), anchor, shape.name())) {
            workflow.clearPreviewWithStatus(INVALID_STAIR_GEOMETRY_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createStairUseCase.execute(workflow.session().selectedMapId(), anchor, shape.name());
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private void hover(Cell anchor, StairShape shape) {
        if (!workflow.session().hasSelectedMap() || anchor == null) {
            workflow.clearPreviewWithStatus("");
            effectUseCase.publishSessionPreview();
            return;
        }
        workflow.applyEffect(DungeonEditorSessionEffect.preview(new DungeonEditorSessionValues.StairCreatePreview(
                workspaceCell(anchor),
                shape.name())));
        effectUseCase.publishSessionPreview();
    }

    private static DungeonEditorWorkspaceValues.Cell workspaceCell(Cell anchor) {
        return new DungeonEditorWorkspaceValues.Cell(anchor.q(), anchor.r(), anchor.level());
    }
}
