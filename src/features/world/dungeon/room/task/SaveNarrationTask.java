package features.world.dungeon.room.task;

public final class SaveNarrationTask {

    private SaveNarrationTask() {
    }

    public static features.world.dungeon.room.input.SaveNarrationInput saveNarration(
            features.world.dungeon.room.input.SaveNarrationInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        roomApplicationService().saveNarration(
                input.roomId(),
                new features.world.dungeon.model.structures.room.RoomNarration(
                        input.visualDescription(),
                        toExitNarrations(input.exitNarrations())));
        return input;
    }

    private static features.world.dungeon.application.room.DungeonRoomApplicationService roomApplicationService() {
        return new features.world.dungeon.application.room.DungeonRoomApplicationService(
                new features.world.dungeon.repository.DungeonRoomRepository());
    }

    private static java.util.List<features.world.dungeon.model.structures.room.RoomExitNarration> toExitNarrations(
            java.util.List<features.world.dungeon.room.input.SaveNarrationInput.ExitNarrationInput> inputs
    ) {
        if (inputs == null || inputs.isEmpty()) {
            return java.util.List.of();
        }
        return inputs.stream()
                .filter(java.util.Objects::nonNull)
                .map(SaveNarrationTask::toExitNarration)
                .toList();
    }

    private static features.world.dungeon.model.structures.room.RoomExitNarration toExitNarration(
            features.world.dungeon.room.input.SaveNarrationInput.ExitNarrationInput input
    ) {
        return new features.world.dungeon.model.structures.room.RoomExitNarration(
                input.levelZ(),
                features.world.dungeon.geometry.GridPoint.cell(
                        input.roomCellX(),
                        input.roomCellY(),
                        input.roomCellZ()),
                features.world.dungeon.geometry.CardinalDirection.parse(input.direction()),
                input.description());
    }
}
