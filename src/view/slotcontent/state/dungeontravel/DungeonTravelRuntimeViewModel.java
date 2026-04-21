package src.view.slotcontent.state.dungeontravel;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTravelPosition;

public final class DungeonTravelRuntimeViewModel {

    private @Nullable DungeonTravelPosition position;

    public @Nullable DungeonTravelPosition position() {
        return position;
    }

    public void updatePosition(DungeonTravelPosition nextPosition) {
        position = nextPosition;
    }
}
