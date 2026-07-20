package features.dungeon.application.travel.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;

public final class TravelDungeonActiveState {

    private TravelDungeonActiveState() {
    }

    public static @Nullable PositionData toTravelPosition(@Nullable PartyLocationData location) {
        return location == null || location.outsideDungeon() ? null : location.dungeonPosition();
    }

    public static @Nullable PositionData effectiveTravelPosition(
            @Nullable PositionData requestedTravelPosition,
            @Nullable PartyLocationData partyLocation
    ) {
        PositionData committedPosition = toTravelPosition(partyLocation);
        return committedPosition == null ? requestedTravelPosition : committedPosition;
    }

    public record ActiveTravelStateData(
            List<Long> travelCharacterIds,
            @Nullable PartyLocationData partyLocation,
            long positionRevision
    ) {
        public ActiveTravelStateData {
            travelCharacterIds = travelCharacterIds == null ? List.of() : List.copyOf(travelCharacterIds);
            positionRevision = Math.max(0L, positionRevision);
        }

        @Override
        public List<Long> travelCharacterIds() {
            return List.copyOf(travelCharacterIds);
        }
    }

    public record PartyLocationData(
            @Nullable PositionData dungeonPosition,
            long overworldMapId,
            long overworldTileId,
            boolean outsideDungeon
    ) {
        public PartyLocationData {
            overworldMapId = Math.max(0L, overworldMapId);
            overworldTileId = Math.max(0L, overworldTileId);
        }
    }
}
