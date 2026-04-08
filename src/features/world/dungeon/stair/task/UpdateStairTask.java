package features.world.dungeon.stair.task;

public final class UpdateStairTask {

    private UpdateStairTask() {
    }

    public static features.world.dungeon.stair.input.UpdateStairInput updateStair(
            features.world.dungeon.stair.input.UpdateStairInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        stairApplicationService().updateStair(
                new features.world.dungeon.application.stair.DungeonStairApplicationService.UpdateStairRequest(
                        input.mapId(),
                        input.stairId(),
                        toDraft(input.draft())));
        return input;
    }

    private static features.world.dungeon.application.stair.DungeonStairApplicationService stairApplicationService() {
        features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
        features.world.dungeon.repository.DungeonStairRepository stairRepository =
                new features.world.dungeon.repository.DungeonStairRepository();
        return new features.world.dungeon.application.stair.DungeonStairApplicationService(mapRepository, stairRepository);
    }

    private static features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft toDraft(
            features.world.dungeon.stair.input.CreateStairInput.DraftInput input
    ) {
        if (input == null) {
            throw new IllegalArgumentException("draft");
        }
        return new features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft(
                input.name(),
                features.world.dungeon.geometry.GridPoint.cell(input.anchorCellX(), input.anchorCellY(), input.anchorCellZ()),
                input.anchorLevelZ(),
                toShapeSpec(input.shapeSpec()),
                input.minLevelZ(),
                input.maxLevelZ(),
                toStopLevels(input.stopLevels()));
    }

    private static features.world.dungeon.stair.model.StairPathPatternSpec toShapeSpec(
            features.world.dungeon.stair.input.CreateStairInput.ShapeSpecInput input
    ) {
        features.world.dungeon.stair.input.CreateStairInput.ShapeSpecInput resolved = input == null
                ? features.world.dungeon.stair.input.CreateStairInput.ShapeSpecInput.defaultInput()
                : input;
        return new features.world.dungeon.stair.model.StairPathPatternSpec(
                features.world.dungeon.stair.model.StairPathPatternKind.valueOf(
                        resolved.kind().isBlank() ? "STACK" : resolved.kind()),
                features.world.dungeon.geometry.CardinalDirection.parse(resolved.direction()),
                resolved.parameter1(),
                resolved.parameter2());
    }

    private static java.util.Set<Integer> toStopLevels(java.util.List<Integer> levels) {
        return levels == null ? java.util.Set.of() : java.util.Set.copyOf(new java.util.LinkedHashSet<>(levels));
    }
}
