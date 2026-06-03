package src.domain.dungeon.model.worldspace.usecase;

import java.util.Locale;
import java.util.Objects;
import src.domain.dungeon.model.worldspace.DungeonStairShape;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SaveDungeonEditorStairGeometryUseCase {
    private static final String INVALID_STAIR_GEOMETRY_STATUS = "Treppengeometrie ungueltig.";

    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorStairGeometryUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveStairGeometryUseCase = Objects.requireNonNull(saveStairGeometryUseCase, "saveStairGeometryUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(StairGeometryInput input) {
        StairGeometryInput safeInput = input == null ? StairGeometryInput.empty() : input;
        DungeonStairShape shape = supportedShape(safeInput.shapeName());
        if (!workflow.session().hasSelectedMap()
                || safeInput.stairId() <= 0L
                || shape == null
                || !validCardinalDirection(safeInput.directionName())
                || !shape.supportsEditorDimensions(safeInput.dimension1(), safeInput.dimension2())
                || !saveStairGeometryUseCase.canSave(
                        workflow.session().selectedMapId(),
                        safeInput.stairId(),
                        safeInput.shapeName(),
                        safeInput.directionName(),
                        safeInput.dimension1(),
                        safeInput.dimension2())) {
            workflow.clearPreviewWithStatus(INVALID_STAIR_GEOMETRY_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        saveStairGeometryUseCase.execute(
                workflow.session().selectedMapId(),
                safeInput.stairId(),
                safeInput.shapeName(),
                safeInput.directionName(),
                safeInput.dimension1(),
                safeInput.dimension2());
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private static boolean validCardinalDirection(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NORTH", "EAST", "SOUTH", "WEST" -> true;
            default -> false;
        };
    }

    private static DungeonStairShape supportedShape(String value) {
        DungeonStairShape shape = DungeonStairShape.parse(value);
        return shape.supportedEditorShape() ? shape : null;
    }

    public record StairGeometryInput(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        public StairGeometryInput {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT);
            directionName = directionName == null ? "" : directionName.trim().toUpperCase(Locale.ROOT);
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
        }

        static StairGeometryInput empty() {
            return new StairGeometryInput(0L, "", "", 0, 0);
        }
    }
}
