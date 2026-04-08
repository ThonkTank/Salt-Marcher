package features.world.dungeon.stair;

import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.stair.input.CreateStairInput;
import features.world.dungeon.stair.input.DeleteStairInput;
import features.world.dungeon.stair.input.LoadEditorSpecInput;
import features.world.dungeon.stair.model.StairPathPatternKind;
import features.world.dungeon.stair.model.StairPathPatternSpec;

import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Public root seam for stair-owned workflows.
 */
public final class StairObject {

    private final DungeonStairApplicationService stairApplicationService;

    public StairObject(DungeonStairApplicationService stairApplicationService) {
        this.stairApplicationService = Objects.requireNonNull(stairApplicationService, "stairApplicationService");
    }

    public void deleteStair(DeleteStairInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        stairApplicationService.deleteStair(
                new DungeonStairApplicationService.DeleteStairRequest(input.mapId(), input.stairId()));
    }

    public long createStair(CreateStairInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return stairApplicationService.createStair(
                new DungeonStairApplicationService.CreateStairRequest(
                        input.mapId(),
                        toDraft(input.draft())));
    }

    public LoadEditorSpecInput.EditorSpecInput loadEditorSpec(LoadEditorSpecInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        DungeonStairApplicationService.LoadedStairEditorSpec editorSpec = stairApplicationService.loadStairEditorSpec(
                new DungeonStairApplicationService.LoadStairEditorSpecRequest(input.mapId(), input.stairId()));
        return editorSpec == null ? null : new LoadEditorSpecInput.EditorSpecInput(
                editorSpec.stairId(),
                editorSpec.name(),
                editorSpec.anchorCell().x2() / 2,
                editorSpec.anchorCell().y2() / 2,
                editorSpec.anchorCell().z(),
                editorSpec.anchorLevelZ(),
                new LoadEditorSpecInput.ShapeSpecInput(
                        editorSpec.shapeSpec().kind().name(),
                        editorSpec.shapeSpec().direction().name(),
                        editorSpec.shapeSpec().parameter1(),
                        editorSpec.shapeSpec().parameter2()),
                editorSpec.minLevelZ(),
                editorSpec.maxLevelZ(),
                editorSpec.stopLevels().stream().toList());
    }

    private static DungeonStairApplicationService.StairDraft toDraft(CreateStairInput.DraftInput input) {
        if (input == null) {
            throw new IllegalArgumentException("draft");
        }
        return new DungeonStairApplicationService.StairDraft(
                input.name(),
                GridPoint.cell(input.anchorCellX(), input.anchorCellY(), input.anchorCellZ()),
                input.anchorLevelZ(),
                toShapeSpec(input.shapeSpec()),
                input.minLevelZ(),
                input.maxLevelZ(),
                toStopLevels(input.stopLevels()));
    }

    private static StairPathPatternSpec toShapeSpec(CreateStairInput.ShapeSpecInput input) {
        CreateStairInput.ShapeSpecInput resolved = input == null
                ? CreateStairInput.ShapeSpecInput.defaultInput()
                : input;
        return new StairPathPatternSpec(
                StairPathPatternKind.valueOf(resolved.kind().isBlank() ? "STACK" : resolved.kind()),
                CardinalDirection.parse(resolved.direction()),
                resolved.parameter1(),
                resolved.parameter2());
    }

    private static Set<Integer> toStopLevels(java.util.List<Integer> levels) {
        return levels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(levels));
    }
}
