package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class RoomMetadataMerger {

    private RoomMetadataMerger() {
    }

    static void updateMergedRoomMetadata(
            Connection conn,
            long primaryRoomId,
            List<Long> mergedRoomIds,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Integer> roomSquareCounts,
            TopologyIntent intent
    ) throws SQLException {
        DungeonRoom primaryRoom = roomsById.get(primaryRoomId);
        if (primaryRoom == null) {
            return;
        }

        List<Long> secondaryRoomIds = new ArrayList<>();
        for (Long roomId : mergedRoomIds) {
            if (roomId != null && roomId != primaryRoomId) {
                secondaryRoomIds.add(roomId);
            }
        }
        secondaryRoomIds.sort(roomMergeComparator(roomSquareCounts, intent));

        List<DungeonRoom> secondaryRooms = new ArrayList<>();
        for (Long roomId : secondaryRoomIds) {
            DungeonRoom room = roomsById.get(roomId);
            if (room != null) {
                secondaryRooms.add(room);
            }
        }
        upsertMergedMetadata(conn, primaryRoom, secondaryRooms);
    }

    static String coalesceText(String value) {
        return value == null ? "" : value;
    }

    static Comparator<Long> roomMergeComparator(Map<Long, Integer> roomSquareCounts, TopologyIntent intent) {
        return TopologyEntitySelectionSupport.mergeComparator(roomSquareCounts, intent);
    }

    private static void upsertMergedMetadata(Connection conn, DungeonRoom primaryRoom, List<DungeonRoom> secondaryRooms) throws SQLException {
        String mergedLightLevel = mergeText(primaryRoom.lightLevel(), secondaryRooms, DungeonRoom::lightLevel);
        String mergedVisualDescription = mergeText(primaryRoom.visualDescription(), secondaryRooms, DungeonRoom::visualDescription);
        String mergedSoundsDescription = mergeText(primaryRoom.soundsDescription(), secondaryRooms, DungeonRoom::soundsDescription);
        String mergedSmellsDescription = mergeText(primaryRoom.smellsDescription(), secondaryRooms, DungeonRoom::smellsDescription);
        String mergedOtherDescription = mergeText(primaryRoom.otherDescription(), secondaryRooms, DungeonRoom::otherDescription);
        String mergedGlanceDescription = mergeText(primaryRoom.glanceDescription(), secondaryRooms, DungeonRoom::glanceDescription);
        String mergedDetailDescription = mergeText(primaryRoom.detailDescription(), secondaryRooms, DungeonRoom::detailDescription);
        String mergedReactiveChecks = mergeText(primaryRoom.reactiveChecks(), secondaryRooms, DungeonRoom::reactiveChecks);
        String mergedGmBackground = mergeText(primaryRoom.gmBackground(), secondaryRooms, DungeonRoom::gmBackground);
        Long mergedAreaId = mergeAreaAssignment(primaryRoom.areaId(), secondaryRooms);
        if (sameText(primaryRoom.lightLevel(), mergedLightLevel)
                && sameText(primaryRoom.visualDescription(), mergedVisualDescription)
                && sameText(primaryRoom.soundsDescription(), mergedSoundsDescription)
                && sameText(primaryRoom.smellsDescription(), mergedSmellsDescription)
                && sameText(primaryRoom.otherDescription(), mergedOtherDescription)
                && sameText(primaryRoom.glanceDescription(), mergedGlanceDescription)
                && sameText(primaryRoom.detailDescription(), mergedDetailDescription)
                && sameText(primaryRoom.reactiveChecks(), mergedReactiveChecks)
                && sameText(primaryRoom.gmBackground(), mergedGmBackground)
                && sameNullableId(primaryRoom.areaId(), mergedAreaId)) {
            return;
        }
        DungeonRoomRepository.upsertRoom(conn, new DungeonRoom(
                primaryRoom.roomId(),
                primaryRoom.mapId(),
                primaryRoom.name(),
                mergedLightLevel,
                mergedVisualDescription,
                mergedSoundsDescription,
                mergedSmellsDescription,
                mergedOtherDescription,
                mergedGlanceDescription,
                mergedDetailDescription,
                mergedReactiveChecks,
                mergedGmBackground,
                mergedAreaId));
    }

    private static Long mergeAreaAssignment(Long primaryAreaId, List<DungeonRoom> mergedRooms) {
        if (primaryAreaId != null) {
            return primaryAreaId;
        }
        Long resolvedAreaId = null;
        for (DungeonRoom room : mergedRooms) {
            if (room == null || room.areaId() == null) {
                continue;
            }
            if (resolvedAreaId == null) {
                resolvedAreaId = room.areaId();
                continue;
            }
            if (!resolvedAreaId.equals(room.areaId())) {
                return null;
            }
        }
        return resolvedAreaId;
    }

    private static <T> String mergeText(
            String primaryValue,
            List<DungeonRoom> mergedRooms,
            java.util.function.Function<DungeonRoom, String> accessor
    ) {
        List<String> parts = new ArrayList<>();
        String base = normalizedText(primaryValue);
        if (base != null) {
            parts.add(base);
        }
        Set<String> seen = new LinkedHashSet<>(parts);
        for (DungeonRoom room : mergedRooms) {
            String value = normalizedText(accessor.apply(room));
            if (value != null && seen.add(value)) {
                parts.add(value);
            }
        }
        return parts.isEmpty() ? "" : String.join("\n\n", parts);
    }

    private static String normalizedText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean sameText(String left, String right) {
        String normalizedLeft = normalizedText(left);
        String normalizedRight = normalizedText(right);
        if (normalizedLeft == null && normalizedRight == null) {
            return true;
        }
        if (normalizedLeft == null || normalizedRight == null) {
            return false;
        }
        return normalizedLeft.equals(normalizedRight);
    }

    private static boolean sameNullableId(Long left, Long right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equals(right);
    }
}
