package features.world.dungeon.dungeonmap.connections;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.stair.Stair;

import java.util.Objects;

public record StairConnectionCarrier(
        GridPoint anchorCell,
        int anchorLevelZ,
        Stair stair
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        stair = Objects.requireNonNull(stair, "stair");
        if (stair.gridPath().isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public CardinalDirection direction() {
        return CardinalDirection.defaultDirection();
    }
}
