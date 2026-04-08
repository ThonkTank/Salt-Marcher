package features.world.dungeon.stair;

import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.stair.input.DeleteStairInput;
import features.world.dungeon.stair.input.LoadEditorSpecInput;

import java.sql.SQLException;
import java.util.Objects;

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
}
