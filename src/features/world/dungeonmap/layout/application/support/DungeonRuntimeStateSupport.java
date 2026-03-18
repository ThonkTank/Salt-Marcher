package features.world.dungeonmap.layout.application.support;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorTopology;
import features.world.dungeonmap.corridors.model.DungeonCorridorTopologyPlanner;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.runtime.model.DungeonRuntimeState;
import features.world.dungeonmap.runtime.persistence.DungeonCampaignStateAdapter;
import features.world.dungeonmap.layout.persistence.DungeonLayoutReadRepository;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Comparator;
import java.util.Optional;

public final class DungeonRuntimeStateSupport {

    private DungeonRuntimeStateSupport() {
    }

    public static DungeonRuntimeState loadPreferredRuntimeState(Connection conn) throws SQLException {
        Optional<DungeonLayout> preferredLayout = loadPreferredLayout(conn);
        if (preferredLayout.isEmpty()) {
            throw new IllegalStateException("Keine Dungeon-Map vorhanden");
        }
        return toRuntimeState(conn, preferredLayout.orElseThrow());
    }

    public static void repairStoredRuntimeState(Connection conn) throws SQLException {
        Optional<DungeonLayout> preferredLayout = loadPreferredLayout(conn);
        if (preferredLayout.isEmpty()) {
            DungeonCampaignStateAdapter.clearActiveLocation(conn);
            return;
        }
        resolveAndRepairActiveLocation(conn, preferredLayout.orElseThrow());
    }

    public static DungeonRuntimeState loadRuntimeState(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = DungeonLayoutReadRepository.loadLayout(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
        return toRuntimeState(conn, layout);
    }

    private static Optional<DungeonLayout> loadPreferredLayout(Connection conn) throws SQLException {
        Optional<Long> storedMapId = DungeonCampaignStateAdapter.getStoredMapId(conn);
        if (storedMapId.isPresent()) {
            Optional<DungeonLayout> storedLayout = DungeonLayoutReadRepository.loadLayout(conn, storedMapId.orElseThrow());
            if (storedLayout.isPresent()) {
                return storedLayout;
            }
        }
        Optional<Long> firstMapId = DungeonMapCatalogPersistence.firstMapId(conn);
        if (firstMapId.isEmpty()) {
            return Optional.empty();
        }
        return DungeonLayoutReadRepository.loadLayout(conn, firstMapId.orElseThrow());
    }

    private static DungeonRuntimeState toRuntimeState(Connection conn, DungeonLayout layout) throws SQLException {
        DungeonRuntimeLocation activeLocation = resolveAndRepairActiveLocation(conn, layout);
        return new DungeonRuntimeState(layout, activeLocation);
    }

    private static DungeonRuntimeLocation resolveAndRepairActiveLocation(Connection conn, DungeonLayout layout) throws SQLException {
        DungeonRuntimeLocation storedActiveLocation = DungeonCampaignStateAdapter.getStoredActiveLocation(conn, layout.map().mapId());
        DungeonRuntimeLocation resolvedActiveLocation = resolveActiveLocation(layout, storedActiveLocation);
        if (resolvedActiveLocation != null) {
            if (!resolvedActiveLocation.equals(storedActiveLocation)) {
                // Runtime state and persisted campaign state must agree on the active dungeon location.
                DungeonCampaignStateAdapter.updateActiveLocation(conn, layout.map().mapId(), resolvedActiveLocation);
            }
            return resolvedActiveLocation;
        }
        if (storedActiveLocation != null) {
            DungeonCampaignStateAdapter.clearActiveLocation(conn);
        }
        return null;
    }

    private static DungeonRuntimeLocation resolveActiveLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        CorridorTopology corridorTopology = DungeonCorridorTopologyPlanner.planCorridorTopology(layout);
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            String componentId = corridorTopology.componentIdByCorridorId().get(corridor.corridorId());
            if (componentId != null) {
                location = DungeonRuntimeLocation.corridorComponent(componentId);
            }
        }
        if (location != null && containsLocation(layout, location)) {
            return location;
        }
        Long roomId = layout.rooms().stream()
                .map(room -> room.roomId())
                .filter(id -> id != null)
                .min(Comparator.naturalOrder())
                .orElse(null);
        return roomId == null ? null : DungeonRuntimeLocation.room(roomId);
    }

    private static boolean containsLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return DungeonCorridorTopologyPlanner.planCorridorTopology(layout).componentsById().containsKey(corridorComponent.componentId());
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return layout.corridorById(corridor.corridorId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return layout.roomById(room.roomId()) != null;
        }
        return false;
    }
}
