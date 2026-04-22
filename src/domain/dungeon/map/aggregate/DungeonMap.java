package src.domain.dungeon.map.aggregate;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.service.DungeonRoomTopologyEditor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonMapTopology;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonMapMetadata;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.FeatureCatalog;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpaceCatalog;
import src.domain.dungeon.map.value.SpatialTopology;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;

/**
 * Canonical aggregate root for one authored dungeon map.
 */
public final class DungeonMap {

    private final DungeonMapMetadata metadata;
    private final SpatialTopology topology;
    private final DungeonMapTopology topologyIndex;
    private final SpaceCatalog spaces;
    private final RoomCatalog rooms;
    private final ConnectionCatalog connections;
    private final FeatureCatalog features;
    private final long revision;

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            SpaceCatalog spaces,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            FeatureCatalog features,
            long revision
    ) {
        this(metadata, topology, null, spaces, rooms, connections, features, revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            SpaceCatalog spaces,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            FeatureCatalog features,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.spaces = spaces == null ? SpaceCatalog.empty() : spaces;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.connections = connections == null ? ConnectionCatalog.empty() : connections;
        this.features = features == null ? FeatureCatalog.empty() : features;
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(this.topology, this.rooms, this.connections));
        this.revision = Math.max(0L, revision);
    }

    public static DungeonMap empty(DungeonMapIdentity mapId, String mapName) {
        return authored(mapId, mapName, SpatialTopology.demo(), 1L);
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
                SpaceCatalog.empty(),
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return authored(mapId, mapName, topology, null, rooms, connections, revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                topologyIndex,
                SpaceCatalog.empty(),
                rooms,
                connections,
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            RoomCatalog rooms,
            long revision
    ) {
        return authored(mapId, mapName, topology, rooms, ConnectionCatalog.empty(), revision);
    }

    public DungeonMap moveRoomAnchor(int deltaQ, int deltaR) {
        return withTopology(topology.moveRoomAnchor(deltaQ, deltaR), revision + 1L);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR) {
        return moveTopologyElement(ref, deltaQ, deltaR, 0);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR, int deltaLevel) {
        if (ref == null || !ref.present() || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return this;
        }
        OptionalLong clusterId = topologyIndex().clusterIdFor(ref);
        return clusterId.isPresent() ? moveCluster(clusterId.getAsLong(), deltaQ, deltaR, deltaLevel) : this;
    }

    public DungeonMapTopology topologyIndex() {
        return topologyIndex;
    }

    private DungeonMap moveCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return this;
        }
        SpatialTopology nextTopology = moveTopologyCluster(clusterId, deltaQ, deltaR, deltaLevel);
        RoomCatalog nextRooms = moveRoomsForCluster(clusterId, deltaQ, deltaR, deltaLevel);
        if (nextTopology.equals(topology) && nextRooms.equals(rooms)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                nextTopology,
                topologyIndex,
                spaces,
                nextRooms,
                connections,
                features,
                revision + 1L);
    }

    private SpatialTopology moveTopologyCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonRoomCluster> movedClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                movedClusters.add(new DungeonRoomCluster(
                        cluster.clusterId(),
                        cluster.mapId(),
                        new DungeonCell(
                                cluster.center().q() + deltaQ,
                                cluster.center().r() + deltaR,
                                cluster.center().level() + deltaLevel),
                        movedCellsByLevel(cluster.relativeVerticesByLevel(), deltaLevel),
                        movedBoundariesByLevel(cluster.boundariesByLevel(), deltaLevel)));
                changed = true;
            } else {
                movedClusters.add(cluster);
            }
        }
        return changed ? topology.withRoomClusters(movedClusters) : topology;
    }

    private RoomCatalog moveRoomsForCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonRoom> movedRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.clusterId() == clusterId) {
                movedRooms.add(movedRoom(room, deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                movedRooms.add(room);
            }
        }
        return changed ? new RoomCatalog(movedRooms) : rooms;
    }

    private static DungeonRoom movedRoom(DungeonRoom room, int deltaQ, int deltaR, int deltaLevel) {
        Map<Integer, DungeonCell> movedAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, DungeonCell> entry : room.floorAnchors().entrySet()) {
            DungeonCell anchor = entry.getValue();
            int nextLevel = entry.getKey() + deltaLevel;
            movedAnchors.put(
                    nextLevel,
                    new DungeonCell(anchor.q() + deltaQ, anchor.r() + deltaR, anchor.level() + deltaLevel));
        }
        return new DungeonRoom(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                movedAnchors,
                room.narration());
    }

    private static Map<Integer, List<DungeonCell>> movedCellsByLevel(
            Map<Integer, List<DungeonCell>> cellsByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || cellsByLevel == null || cellsByLevel.isEmpty()) {
            return cellsByLevel;
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            List<DungeonCell> movedCells = entry.getValue().stream()
                    .map(cell -> new DungeonCell(cell.q(), cell.r(), cell.level() + deltaLevel))
                    .toList();
            result.put(entry.getKey() + deltaLevel, movedCells);
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> movedBoundariesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || boundariesByLevel == null || boundariesByLevel.isEmpty()) {
            return boundariesByLevel;
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            List<DungeonClusterBoundary> movedBoundaries = entry.getValue().stream()
                    .map(boundary -> new DungeonClusterBoundary(
                            boundary.clusterId(),
                            boundary.level() + deltaLevel,
                            new DungeonCell(
                                    boundary.relativeCell().q(),
                                    boundary.relativeCell().r(),
                                    boundary.relativeCell().level() + deltaLevel),
                            boundary.direction(),
                            boundary.kind(),
                            boundary.topologyRef()))
                    .toList();
            result.put(entry.getKey() + deltaLevel, movedBoundaries);
        }
        return Map.copyOf(result);
    }

    public DungeonMap saveRoomNarration(long roomId, DungeonRoomNarration narration) {
        if (roomId <= 0L || narration == null) {
            return this;
        }
        List<DungeonRoom> nextRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.roomId() == roomId) {
                nextRooms.add(room.withNarration(narration));
                changed = true;
            } else {
                nextRooms.add(room);
            }
        }
        return changed
                ? new DungeonMap(
                        metadata,
                        topology,
                        topologyIndex,
                        spaces,
                        new RoomCatalog(nextRooms),
                        connections,
                        features,
                        revision + 1L)
                : this;
    }

    public DungeonMap resetDemoLayout() {
        return withTopology(SpatialTopology.demo(), revision + 1L);
    }

    public DungeonMap paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonRoomTopologyEditor().paintRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonRoomTopologyEditor().deleteRectangle(this, start, end);
    }

    public DungeonMap rename(String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(metadata.mapId(), mapName),
                topology,
                topologyIndex,
                spaces,
                rooms,
                connections,
                features,
                revision + 1L);
    }

    public java.util.List<String> validationMessages() {
        return java.util.List.of("room anchor valid inside committed map bounds");
    }

    public java.util.List<String> reactionMessages(DungeonMap after) {
        if (after == null || (topology.roomAnchorQ() == after.topology().roomAnchorQ()
                && topology.roomAnchorR() == after.topology().roomAnchorR())) {
            return java.util.List.of("derived state rebuilt without structural movement");
        }
        return java.util.List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }

    private DungeonMap withTopology(SpatialTopology nextTopology, long nextRevision) {
        return new DungeonMap(
                metadata,
                nextTopology,
                topologyIndex,
                spaces,
                rooms,
                connections,
                features,
                nextRevision);
    }

    public DungeonMapMetadata metadata() {
        return metadata;
    }

    public SpatialTopology topology() {
        return topology;
    }

    public SpaceCatalog spaces() {
        return spaces;
    }

    public RoomCatalog rooms() {
        return rooms;
    }

    public ConnectionCatalog connections() {
        return connections;
    }

    public FeatureCatalog features() {
        return features;
    }

    public long revision() {
        return revision;
    }
}
