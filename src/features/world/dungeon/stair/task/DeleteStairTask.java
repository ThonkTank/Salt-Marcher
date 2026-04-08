package features.world.dungeon.stair.task;

public final class DeleteStairTask {

    private DeleteStairTask() {
    }

    public static features.world.dungeon.stair.input.DeleteStairInput deleteStair(
            features.world.dungeon.stair.input.DeleteStairInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        stairApplicationService().deleteStair(
                new features.world.dungeon.application.stair.DungeonStairApplicationService.DeleteStairRequest(
                        input.mapId(),
                        input.stairId()));
        return input;
    }

    private static features.world.dungeon.application.stair.DungeonStairApplicationService stairApplicationService() {
        features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
        features.world.dungeon.repository.DungeonStairRepository stairRepository =
                new features.world.dungeon.repository.DungeonStairRepository();
        return new features.world.dungeon.application.stair.DungeonStairApplicationService(mapRepository, stairRepository);
    }
}
