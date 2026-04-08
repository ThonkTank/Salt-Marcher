package features.world.dungeon.stair.task;

public final class LoadEditorSpecTask {

    private LoadEditorSpecTask() {
    }

    public static features.world.dungeon.stair.input.LoadEditorSpecInput.EditorSpecInput loadEditorSpec(
            features.world.dungeon.stair.input.LoadEditorSpecInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        features.world.dungeon.application.stair.DungeonStairApplicationService.LoadedStairEditorSpec editorSpec =
                stairApplicationService().loadStairEditorSpec(
                        new features.world.dungeon.application.stair.DungeonStairApplicationService.LoadStairEditorSpecRequest(
                                input.mapId(),
                                input.stairId()));
        return editorSpec == null ? null : new features.world.dungeon.stair.input.LoadEditorSpecInput.EditorSpecInput(
                editorSpec.stairId(),
                editorSpec.name(),
                editorSpec.anchorCell().x2() / 2,
                editorSpec.anchorCell().y2() / 2,
                editorSpec.anchorCell().z(),
                editorSpec.anchorLevelZ(),
                new features.world.dungeon.stair.input.LoadEditorSpecInput.ShapeSpecInput(
                        editorSpec.shapeSpec().kind().name(),
                        editorSpec.shapeSpec().direction().name(),
                        editorSpec.shapeSpec().parameter1(),
                        editorSpec.shapeSpec().parameter2()),
                editorSpec.minLevelZ(),
                editorSpec.maxLevelZ(),
                editorSpec.stopLevels().stream().toList());
    }

    private static features.world.dungeon.application.stair.DungeonStairApplicationService stairApplicationService() {
        features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
        features.world.dungeon.repository.DungeonStairRepository stairRepository =
                new features.world.dungeon.repository.DungeonStairRepository();
        return new features.world.dungeon.application.stair.DungeonStairApplicationService(mapRepository, stairRepository);
    }
}
