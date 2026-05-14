package src.domain.travel.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.PositionData;

public final class TravelDungeonActiveState {

    private TravelDungeonActiveState() {
    }

    public static @Nullable PositionData toTravelPosition(@Nullable PartyLocationData location) {
        return location == null || location.outsideDungeon() ? null : location.dungeonPosition();
    }

    public record ActiveTravelStateData(
            List<Long> travelCharacterIds,
            @Nullable PartyLocationData partyLocation
    ) {
        public ActiveTravelStateData {
            travelCharacterIds = travelCharacterIds == null ? List.of() : List.copyOf(travelCharacterIds);
        }

        @Override
        public List<Long> travelCharacterIds() {
            return List.copyOf(travelCharacterIds);
        }
    }

    public record PartyLocationData(
            @Nullable PositionData dungeonPosition,
            long overworldTileId,
            boolean outsideDungeon
    ) {
        public PartyLocationData {
            overworldTileId = Math.max(0L, overworldTileId);
        }
    }
}
