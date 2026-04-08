package features.world.dungeon.room;

import features.world.dungeon.application.room.DungeonRoomApplicationService;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.room.RoomExitNarration;
import features.world.dungeon.model.structures.room.RoomNarration;
import features.world.dungeon.room.input.SaveNarrationInput;

import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/**
 * Public root seam for room-owned narration writes.
 */
public final class RoomObject {

    private final DungeonRoomApplicationService roomApplicationService;

    public RoomObject(DungeonRoomApplicationService roomApplicationService) {
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
    }

    public void saveNarration(SaveNarrationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        roomApplicationService.saveNarration(input.roomId(), new RoomNarration(
                input.visualDescription(),
                toExitNarrations(input.exitNarrations())));
    }

    private static List<RoomExitNarration> toExitNarrations(List<SaveNarrationInput.ExitNarrationInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return List.of();
        }
        return inputs.stream()
                .filter(Objects::nonNull)
                .map(RoomObject::toExitNarration)
                .toList();
    }

    private static RoomExitNarration toExitNarration(SaveNarrationInput.ExitNarrationInput input) {
        return new RoomExitNarration(
                input.levelZ(),
                GridPoint.cell(input.roomCellX(), input.roomCellY(), input.roomCellZ()),
                CardinalDirection.parse(input.direction()),
                input.description());
    }
}
