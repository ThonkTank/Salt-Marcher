package features.world.dungeon.stair;

import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.stair.input.DeleteStairInput;

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
}
