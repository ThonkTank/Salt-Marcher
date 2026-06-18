package src.domain.dungeon.model.core.structure;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerCatalog;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
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
        return authored(
                mapId,
                mapName,
                new AuthoredContent(
                        topology,
                        null,
                        RoomCatalog.empty(),
                        List.of(),
                        new StairCollection(List.of()),
                        List.of(),
                        FeatureMarkerCatalog.empty()),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            AuthoredContent content,
            long revision
    ) {
        AuthoredContent resolvedContent = content == null ? AuthoredContent.empty() : content;
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                resolvedContent.topology(),
                resolvedContent.topologyIndex(),
                resolvedContent.rooms(),
                resolvedContent.corridors(),
                resolvedContent.stairs(),
                new TransitionCatalog(resolvedContent.transitions()),
                resolvedContent.featureMarkers(),
                revision);
    }

    public record AuthoredContent(
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            List<Corridor> corridors,
            StairCollection stairs,
            List<Transition> transitions,
            FeatureMarkerCatalog featureMarkers
    ) {
        public AuthoredContent {
            topology = topology == null ? SpatialTopology.empty() : topology;
            rooms = rooms == null ? RoomCatalog.empty() : rooms;
            corridors = corridors == null ? List.of() : List.copyOf(corridors);
            stairs = stairs == null ? new StairCollection(List.of()) : stairs;
            transitions = transitions == null ? List.of() : List.copyOf(transitions);
            featureMarkers = featureMarkers == null ? FeatureMarkerCatalog.empty() : featureMarkers;
        }

        public static AuthoredContent empty() {
            return new AuthoredContent(
                    SpatialTopology.empty(),
                    null,
                    RoomCatalog.empty(),
                    List.of(),
                    new StairCollection(List.of()),
                    List.of(),
                    FeatureMarkerCatalog.empty());
        }
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
                dungeonMap.featureMarkers(),
                dungeonMap.revision() + 1L);
    }
}
