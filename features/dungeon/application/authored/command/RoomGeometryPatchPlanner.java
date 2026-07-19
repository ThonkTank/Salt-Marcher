package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;

/** Converts one aggregate-owned room geometry operation into exact stable-identity changes. */
final class RoomGeometryPatchPlanner {
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();

    private RoomGeometryPatchPlanner() {
    }

    static DungeonCommandResult plan(
            DungeonMap current,
            UnaryOperator<DungeonMap> operation,
            DungeonEditorCommandOutcome.RejectionReason noEffectReason
    ) {
        DungeonMap after = operation.apply(current);
        if (after == null || after.equals(current)) {
            return new DungeonCommandResult.Rejected(noEffectReason);
        }
        List<DungeonPatchChange> changes = new ArrayList<>(changes(current, after));
        if (changes.isEmpty()) {
            throw new IllegalStateException("room geometry operation changed unencoded authored truth");
        }
        DungeonPatch patch = DungeonPatch.of(current.metadata().mapId(), current.revision(), changes);
        DungeonMap patched = patch.applyTo(current);
        if (!patched.equals(after)) {
            throw new IllegalStateException(
                    "room geometry patch must reproduce the exact aggregate result; mismatches="
                            + mismatches(patched, after));
        }
        return DungeonCommandResult.Accepted.from(patch);
    }

    static RoomTopologyWorkCatalog.ReservedIdentities reservedIds(
            DungeonIdentityRange clusterIds,
            DungeonIdentityRange roomIds
    ) {
        Objects.requireNonNull(clusterIds, "clusterIds");
        Objects.requireNonNull(roomIds, "roomIds");
        return WORK_CATALOG.reservedIdentities(
                clusterIds.firstId(),
                clusterIds.count(),
                roomIds.firstId(),
                roomIds.count());
    }

    static List<DungeonPatchChange> changes(DungeonMap before, DungeonMap after) {
        List<DungeonPatchChange> result = new ArrayList<>();
        result.addAll(roomChanges(before, after));
        result.addAll(clusterChanges(before, after));
        result.addAll(corridorChanges(before, after));
        return List.copyOf(result);
    }

    private static List<DungeonPatchChange> roomChanges(DungeonMap before, DungeonMap after) {
        Map<Long, RoomRegion> remaining = roomsById(after.rooms().rooms());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (RoomRegion room : before.rooms().rooms()) {
            RoomRegion next = remaining.remove(room.roomId());
            if (!room.equals(next)) {
                result.add(new RoomRegionChange(room, next));
            }
        }
        for (RoomRegion room : after.rooms().rooms()) {
            if (remaining.containsKey(room.roomId())) {
                result.add(new RoomRegionChange(null, room));
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonPatchChange> clusterChanges(DungeonMap before, DungeonMap after) {
        Map<Long, RoomCluster> remaining = clustersById(after.topology().roomClusters());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (RoomCluster cluster : before.topology().roomClusters()) {
            RoomCluster next = remaining.remove(cluster.clusterId());
            if (!cluster.equals(next)) {
                result.add(new RoomClusterChange(
                        cluster,
                        next,
                        RoomClusterPatchChunks.touchedChunks(before, after, cluster.clusterId())));
            }
        }
        for (RoomCluster cluster : after.topology().roomClusters()) {
            if (remaining.containsKey(cluster.clusterId())) {
                result.add(new RoomClusterChange(
                        null,
                        cluster,
                        RoomClusterPatchChunks.touchedChunks(before, after, cluster.clusterId())));
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonPatchChange> corridorChanges(DungeonMap before, DungeonMap after) {
        Map<Long, Corridor> remaining = corridorsById(after.corridors());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (Corridor corridor : before.corridors()) {
            Corridor next = remaining.remove(corridor.corridorId());
            if (!corridor.equals(next)) {
                result.add(new CorridorChange(
                        corridor,
                        next,
                        CorridorPatchChunks.touchedChunks(before, after, corridor.corridorId())));
            }
        }
        for (Corridor corridor : after.corridors()) {
            if (remaining.containsKey(corridor.corridorId())) {
                result.add(new CorridorChange(
                        null,
                        corridor,
                        CorridorPatchChunks.touchedChunks(before, after, corridor.corridorId())));
            }
        }
        return List.copyOf(result);
    }

    private static Map<Long, RoomRegion> roomsById(List<RoomRegion> rooms) {
        Map<Long, RoomRegion> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms) {
            result.put(room.roomId(), room);
        }
        return result;
    }

    private static Map<Long, RoomCluster> clustersById(List<RoomCluster> clusters) {
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            result.put(cluster.clusterId(), cluster);
        }
        return result;
    }

    private static Map<Long, Corridor> corridorsById(List<Corridor> corridors) {
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            result.put(corridor.corridorId(), corridor);
        }
        return result;
    }

    private static List<String> mismatches(DungeonMap patched, DungeonMap expected) {
        Map<String, Boolean> matches = new LinkedHashMap<>();
        matches.put("metadata", Objects.equals(patched.metadata(), expected.metadata()));
        matches.put("topology", Objects.equals(patched.topology(), expected.topology()));
        matches.put("topologyIndex", Objects.equals(patched.topologyIndex(), expected.topologyIndex()));
        matches.put("rooms", Objects.equals(patched.rooms(), expected.rooms()));
        matches.put("corridors", Objects.equals(patched.corridors(), expected.corridors()));
        matches.put("stairs", Objects.equals(patched.stairs(), expected.stairs()));
        matches.put("transitions", Objects.equals(patched.transitionCatalog(), expected.transitionCatalog()));
        matches.put("featureMarkers", Objects.equals(patched.featureMarkers(), expected.featureMarkers()));
        matches.put("revision", patched.revision() == expected.revision());
        return matches.entrySet().stream().filter(entry -> !entry.getValue()).map(Map.Entry::getKey).toList();
    }
}
