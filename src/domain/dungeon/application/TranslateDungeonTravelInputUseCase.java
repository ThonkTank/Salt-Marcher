package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTravelPosition;

public final class TranslateDungeonTravelInputUseCase {

    public @Nullable DungeonTravelPositionFacts domainTravelPosition(@Nullable DungeonTravelPosition position) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                domainMapId(position.mapId()),
                src.domain.dungeon.map.value.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                domainCell(position.tile()),
                src.domain.dungeon.map.value.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static DungeonMapIdentity domainMapId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonCell domainCell(@Nullable DungeonCellRef cell) {
        return cell == null ? new DungeonCell(0, 0, 0) : new DungeonCell(cell.q(), cell.r(), cell.level());
    }
}
