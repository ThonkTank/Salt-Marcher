package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorCreateFeatureMarkerUseCase {
    private static final String INVALID_FEATURE_MARKER_STATUS = "Feature-Markierung ungueltig.";
    private static final long NO_MARKER_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateFeatureMarkerUseCase(
            DungeonEditorSessionWorkflow workflow,
            CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.createFeatureMarkerUseCase = Objects.requireNonNull(createFeatureMarkerUseCase, "createFeatureMarkerUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void pressPoi(MainViewInput input) {
        press(input, FeatureMarkerKind.POI);
    }

    public void pressObject(MainViewInput input) {
        press(input, FeatureMarkerKind.OBJECT);
    }

    public void pressEncounter(MainViewInput input) {
        press(input, FeatureMarkerKind.ENCOUNTER);
    }

    private void press(MainViewInput input, FeatureMarkerKind kind) {
        if (!workflow.session().hasSelectedMap() || input == null) {
            effectUseCase.publishCurrent();
            return;
        }
        Cell anchor = anchor(input);
        if (!createFeatureMarkerUseCase.canExecute(workflow.session().selectedMapId(), kind, anchor)) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        long markerId = createFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), kind, anchor);
        if (markerId <= NO_MARKER_ID) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        workflow.applyEffect(DungeonEditorMainViewEffect.select(
                markerSelection(markerId),
                effectUseCase.currentFacts().mutationStatusText()));
        effectUseCase.publishCurrent();
    }

    private Cell anchor(MainViewInput input) {
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }

    private DungeonEditorSessionValues.Selection markerSelection(long markerId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId),
                0L,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }
}
