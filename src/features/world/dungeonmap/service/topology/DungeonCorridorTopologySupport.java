package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonLayoutEditResult;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.repository.DungeonRepository;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonCorridorTopologySupport {

    private DungeonCorridorTopologySupport() {
    }

    public static DungeonLayoutEditResult createCorridor(Connection conn, long mapId, List<Long> roomIds) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        List<Long> normalizedRoomIds = roomIds == null ? List.of() : roomIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedRoomIds.size() == 2) {
            Long existingCorridorId = findCorridorContainingAllRooms(layout, normalizedRoomIds);
            if (existingCorridorId != null) {
        return loadEditResult(conn, mapId, existingCorridorId);
            }
        }
        long corridorId = DungeonRepository.insertCorridor(conn, mapId, roomIds);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult addRoomToCorridor(Connection conn, long mapId, long corridorId, long roomId) throws Exception {
        DungeonRepository.addRoomToCorridor(conn, mapId, corridorId, roomId);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult mergeCorridors(Connection conn, long mapId, long keptCorridorId, long mergedCorridorId) throws Exception {
        if (keptCorridorId == mergedCorridorId) {
            return loadEditResult(conn, mapId, keptCorridorId);
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor keptCorridor = layout.corridorById(keptCorridorId);
        if (keptCorridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + keptCorridorId);
        }
        DungeonCorridor mergedCorridor = layout.corridorById(mergedCorridorId);
        if (mergedCorridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + mergedCorridorId);
        }
        LinkedHashSet<Long> mergedRoomIds = new LinkedHashSet<>(keptCorridor.roomIds());
        mergedRoomIds.addAll(mergedCorridor.roomIds());
        DungeonRepository.replaceCorridorRooms(conn, mapId, keptCorridorId, List.copyOf(mergedRoomIds));
        DungeonRepository.deleteCorridor(conn, mapId, mergedCorridorId);
        return loadEditResult(conn, mapId, keptCorridorId);
    }

    public static DungeonLayoutEditResult removeRoomFromCorridor(Connection conn, long mapId, long corridorId, long roomId) throws Exception {
        DungeonRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult removeRoomFromCorridors(Connection conn, long mapId, List<Long> corridorIds, long roomId) throws Exception {
        Long focusCorridorId = corridorIds == null || corridorIds.isEmpty() ? null : corridorIds.get(0);
        if (corridorIds != null) {
            for (Long corridorId : corridorIds) {
                if (corridorId != null) {
                    DungeonRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
                }
            }
        }
        return loadEditResult(conn, mapId, focusCorridorId);
    }

    public static DungeonLayoutEditResult deleteCorridor(Connection conn, long mapId, long corridorId) throws Exception {
        DungeonRepository.deleteCorridor(conn, mapId, corridorId);
        return loadEditResult(conn, mapId, null);
    }

    static void reassignMergedRoomCorridors(Connection conn, DungeonLayout layout, Long primaryRoomId, List<DungeonRoom> mergedRooms) throws SQLException {
        if (primaryRoomId == null) {
            return;
        }
        Set<Long> mergedRoomIds = mergedRooms.stream()
                .map(DungeonRoom::roomId)
                .filter(id -> id != null)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (corridor.roomIds().stream().noneMatch(mergedRoomIds::contains)) {
                continue;
            }
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> mergedRoomIds.contains(roomId) ? primaryRoomId : roomId)
                    .distinct()
                    .toList();
            DungeonRepository.replaceCorridorRooms(conn, layout.map().mapId(), corridor.corridorId(), replacedRoomIds);
        }
    }

    static void reconcileRoomCorridors(Connection conn, long mapId, long originalRoomId, List<DungeonRoom> fragments) throws SQLException {
        if (fragments.isEmpty()) {
            return;
        }
        DungeonLayout currentLayout = requireLayout(conn, mapId);
        for (DungeonCorridor corridor : currentLayout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (!corridor.roomIds().contains(originalRoomId)) {
                continue;
            }
            DungeonRoom targetFragment = chooseBestCorridorFragment(currentLayout, corridor, originalRoomId, fragments);
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> roomId == originalRoomId ? targetFragment.roomId() : roomId)
                    .distinct()
                    .toList();
            DungeonRepository.replaceCorridorRooms(conn, mapId, corridor.corridorId(), replacedRoomIds);
        }
    }

    private static Long findCorridorContainingAllRooms(DungeonLayout layout, List<Long> roomIds) {
        if (layout == null || roomIds == null || roomIds.size() < 2) {
            return null;
        }
        return layout.corridors().stream()
                .filter(corridor -> corridor.corridorId() != null)
                .filter(corridor -> corridor.roomIds().containsAll(roomIds))
                .map(DungeonCorridor::corridorId)
                .findFirst()
                .orElse(null);
    }

    private static DungeonRoom chooseBestCorridorFragment(DungeonLayout layout, DungeonCorridor corridor, long originalRoomId, List<DungeonRoom> fragments) {
        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        for (DungeonRoom fragment : fragments) {
            if (fragment.roomId() != null) {
                roomsById.put(fragment.roomId(), fragment);
            }
        }
        DungeonRoom bestFragment = fragments.get(0);
        FragmentScore bestScore = null;
        for (DungeonRoom fragment : fragments) {
            int nearestRoomDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonRoomTopologySupport.componentDistance(fragment, room))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int groupDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonRoomTopologySupport.componentDistance(fragment, room))
                    .sum();
            FragmentScore score = new FragmentScore(nearestRoomDistance, groupDistance);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment;
    }

    private record FragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<FragmentScore> {
        @Override
        public int compareTo(FragmentScore other) {
            int nearest = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearest != 0) {
                return nearest;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }

    private static DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        return DungeonRepository.loadLayout(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
    }

    private static DungeonLayoutEditResult loadEditResult(Connection conn, long mapId, Long focusCorridorId) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonSelection focusSelection = focusCorridorId == null ? null : DungeonSelection.corridor(focusCorridorId);
        return new DungeonLayoutEditResult(layout, focusSelection);
    }
}
