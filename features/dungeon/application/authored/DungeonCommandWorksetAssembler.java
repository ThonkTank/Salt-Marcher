package features.dungeon.application.authored;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Assembles only a marked command workset from complete entity snapshots. */
final class DungeonCommandWorksetAssembler {

    DungeonCommandWorkset assemble(
            DungeonMapHeader header,
            List<DungeonChunkKey> chunks,
            List<DungeonEntitySnapshot> snapshots,
            Set<DungeonPatchEntityRef> inboundExpandedRefs
    ) {
        List<RoomRegion> rooms = new ArrayList<>();
        List<RoomCluster> clusters = new ArrayList<>();
        List<Corridor> corridors = new ArrayList<>();
        List<Stair> stairs = new ArrayList<>();
        List<Transition> transitions = new ArrayList<>();
        List<FeatureMarker> markers = new ArrayList<>();
        Set<DungeonPatchEntityRef> dependencies = new LinkedHashSet<>();
        for (DungeonEntitySnapshot snapshot : snapshots) {
            dependencies.addAll(snapshot.dependencyHeaders());
            switch (snapshot) {
                case DungeonEntitySnapshot.Room room -> rooms.add(room.value());
                case DungeonEntitySnapshot.RoomClusterSnapshot cluster -> clusters.add(cluster.value());
                case DungeonEntitySnapshot.CorridorSnapshot corridor -> corridors.add(corridor.value());
                case DungeonEntitySnapshot.StairSnapshot stair -> stairs.add(stair.value());
                case DungeonEntitySnapshot.TransitionSnapshot transition -> transitions.add(transition.value());
                case DungeonEntitySnapshot.FeatureMarkerSnapshot marker -> markers.add(marker.value());
            }
        }
        DungeonMap aggregate = DungeonMapAuthoring.authored(
                header.mapId(),
                header.mapName(),
                new DungeonMapAuthoring.AuthoredContent(
                        new SpatialTopology(DungeonTopology.SQUARE, 10, 8, 2, 2, clusters),
                        null,
                        new RoomCatalog(rooms),
                        corridors,
                        new StairCollection(stairs),
                        transitions,
                        new FeatureMarkerCatalog(markers)),
                header.revision());
        return new DungeonCommandWorkset(
                header, chunks, snapshots, List.copyOf(dependencies), inboundExpandedRefs, aggregate);
    }
}
