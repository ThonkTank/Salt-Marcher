package src.domain.dungeon.model.core.structure;

import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

public final class DungeonMapAuthoring {

    private DungeonMapAuthoring() {
    }

    public static DungeonMap empty(DungeonMapIdentity mapId, String mapName) {
        return authored(mapId, mapName, SpatialTopology.empty(), 1L);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                RoomCatalog.empty(),
                List.of(),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            List<Corridor> corridors,
            StairCollection stairs,
            List<Transition> transitions,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                topologyIndex,
                rooms,
                corridors,
                stairs,
                new TransitionCatalog(transitions),
                revision);
    }

    public static DungeonMap rename(DungeonMap dungeonMap, String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(dungeonMap.metadata().mapId(), mapName),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.rooms(),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.revision() + 1L);
    }
}
