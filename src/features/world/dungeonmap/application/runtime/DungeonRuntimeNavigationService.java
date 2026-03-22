package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonRuntimeNavigationService {

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonLayout layout) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRuntimeLocation storedLocation = DungeonRuntimeLocations.storedActiveLocation(conn, layout.mapId());
            return resolveNavigation(layout, storedLocation);
        }
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(DungeonLayout layout, DungeonRuntimeLocation preferredLocation) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        DungeonRuntimeLocation resolvedLocation = DungeonRuntimeLocations.resolveActiveLocation(layout, preferredLocation);
        return new DungeonRuntimeNavigationSnapshot(resolvedLocation, reachableRoomIds(layout, resolvedLocation));
    }

    public DungeonRuntimeNavigationSnapshot moveToRoom(
            DungeonLayout layout,
            DungeonRuntimeLocation currentLocation,
            long roomId
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0 || layout.findRoom(roomId) == null) {
            throw new SQLException("Raum " + roomId + " existiert im aktuellen Dungeon nicht");
        }
        DungeonRuntimeNavigationSnapshot currentSnapshot = resolveNavigation(layout, currentLocation);
        if (currentSnapshot.activeLocation() instanceof DungeonRuntimeLocation.Room room
                && room.roomId() == roomId) {
            return currentSnapshot;
        }
        if (currentSnapshot.activeLocation() != null
                && !currentSnapshot.reachableRoomIds().contains(roomId)) {
            throw new SQLException("Raum " + roomId + " ist von der aktuellen Position nicht erreichbar");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.room(roomId);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation));
        }
        return resolveNavigation(layout, targetLocation);
    }

    private static List<Long> reachableRoomIds(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return List.of();
        }
        Set<Long> reachableRoomIds = new LinkedHashSet<>();
        if (location instanceof DungeonRuntimeLocation.Room room) {
            for (Corridor corridor : layout.corridorsForRoom(room.roomId())) {
                addAdjacentRoomIds(reachableRoomIds, corridor, room.roomId());
            }
        } else if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            Corridor resolvedCorridor = layout.findCorridor(corridor.corridorId());
            if (resolvedCorridor != null) {
                reachableRoomIds.addAll(resolvedCorridor.roomIds());
            }
        } else if (location instanceof DungeonRuntimeLocation.CorridorComponent component) {
            CorridorNetwork network = layout.corridorNetworks().stream()
                    .filter(candidate -> Objects.equals(candidate.networkId(), component.componentId()))
                    .findFirst()
                    .orElse(null);
            if (network != null) {
                reachableRoomIds.addAll(network.roomIds());
            }
        }
        return reachableRoomIds.stream()
                .filter(roomId -> layout.findRoom(roomId) != null)
                .sorted((left, right) -> DungeonRuntimePresenter.roomLabel(layout, left)
                        .compareToIgnoreCase(DungeonRuntimePresenter.roomLabel(layout, right)))
                .toList();
    }

    private static void addAdjacentRoomIds(Set<Long> reachableRoomIds, Corridor corridor, long roomId) {
        if (corridor == null) {
            return;
        }
        List<Long> roomIds = corridor.roomIds();
        for (int index = 0; index < roomIds.size(); index++) {
            if (!Objects.equals(roomIds.get(index), roomId)) {
                continue;
            }
            addIfPresent(reachableRoomIds, roomIds, index - 1);
            addIfPresent(reachableRoomIds, roomIds, index + 1);
        }
    }

    private static void addIfPresent(Set<Long> reachableRoomIds, List<Long> roomIds, int index) {
        if (index < 0 || index >= roomIds.size()) {
            return;
        }
        Long candidate = roomIds.get(index);
        if (candidate != null) {
            reachableRoomIds.add(candidate);
        }
    }
}
