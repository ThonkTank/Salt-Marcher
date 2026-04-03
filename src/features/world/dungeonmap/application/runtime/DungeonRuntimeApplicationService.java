package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

/**
 * Owns runtime navigation, campaign-position serialization, and repair of persisted dungeon state.
 */
public final class DungeonRuntimeApplicationService {

    private final DungeonMapLoader mapLoader;

    public DungeonRuntimeApplicationService(DungeonMapLoader mapLoader) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
    }

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonLayout layout) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            var storedPosition = CampaignStateReadApi.getDungeonPosition(conn)
                    .filter(position -> position.mapId() != null && position.mapId() == layout.mapId())
                    .orElse(null);
            DungeonRuntimeLocation storedLocation = DungeonRuntimeLocations.toRuntimeLocation(storedPosition);
            CardinalDirection storedHeading = CardinalDirection.parse(storedPosition == null ? null : storedPosition.heading());
            return resolveNavigation(layout, storedLocation, storedHeading);
        }
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null) {
            return resolveNavigation(layout, null, CardinalDirection.defaultDirection());
        }
        return resolveNavigation(layout, snapshot.activeLocation(), snapshot.heading());
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(DungeonLayout layout, DungeonRuntimeLocation preferredLocation) {
        return resolveNavigation(layout, preferredLocation, CardinalDirection.defaultDirection());
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonRuntimeLocation preferredLocation,
            CardinalDirection preferredHeading
    ) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        DungeonRuntimeLocation resolvedLocation = DungeonRuntimeLocations.resolveActiveLocation(layout, preferredLocation);
        CardinalDirection resolvedHeading = preferredHeading == null ? CardinalDirection.defaultDirection() : preferredHeading;
        return new DungeonRuntimeNavigationSnapshot(layout.mapId(), resolvedLocation, resolvedHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigateToCell(
            DungeonLayout layout,
            CellCoord fromCell,
            CellCoord cell,
            int levelZ,
            CardinalDirection currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        CellCoord resolvedCell = nearestTraversableCell(layout, cell, levelZ);
        if (resolvedCell == null) {
            throw new SQLException("Kein begehbares Dungeon-Feld gefunden");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.cell(resolvedCell, levelZ);
        CardinalDirection nextHeading = CardinalDirection.fromTravel(fromCell, resolvedCell, currentHeading);
        persistDungeonPosition(layout.mapId(), targetLocation, nextHeading);
        return resolveNavigation(layout, targetLocation, nextHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigate(
            DungeonLayout layout,
            DungeonRuntimeAction action,
            CardinalDirection currentHeading,
            int currentLevel
    ) throws SQLException {
        return switch (action) {
            case DungeonRuntimeDoorDescriptor door -> moveThroughConnection(layout, door, currentLevel);
            case DungeonRuntimeStairDescriptor stair -> moveThroughStair(layout, stair, currentHeading);
            case DungeonRuntimeTransitionDescriptor transition -> moveThroughTransition(layout, transition, currentHeading);
        };
    }

    private CellCoord nearestTraversableCell(DungeonLayout layout, CellCoord preferredCell, int preferredLevelZ) {
        if (layout == null || layout.mapId() <= 0) {
            return null;
        }
        return layout.nearestTraversableCell(preferredCell, preferredLevelZ);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughConnection(
            DungeonLayout layout,
            DungeonRuntimeDoorDescriptor descriptor,
            int currentLevel
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (descriptor == null || descriptor.anchorSegment2x() == null) {
            throw new SQLException("Keine Verbindung verfügbar");
        }
        features.world.dungeonmap.model.structures.connection.Connection connection = layout.connectionAt(
                descriptor.levelZ(),
                descriptor.anchorSegment2x());
        if (connection == null) {
            throw new SQLException("Verbindung konnte nicht aufgelöst werden");
        }
        if (!connection.isTraversable()) {
            throw new SQLException("Verbindung ist blockiert");
        }
        DungeonRuntimeLocation.Cell resolvedCell = resolveConnectionTargetCell(layout, connection, descriptor, descriptor.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        CardinalDirection nextHeading = descriptor.direction();
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.cell(resolvedCell.cell(), resolvedCell.levelZ());
        persistDungeonPosition(layout.mapId(), targetLocation, nextHeading);
        return resolveNavigation(layout, targetLocation, nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughStair(
            DungeonLayout layout,
            DungeonRuntimeStairDescriptor stair,
            CardinalDirection currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (stair == null || !(stair.targetLocation() instanceof DungeonRuntimeLocation.StairExit stairExit)) {
            throw new SQLException("Kein Treppenziel verfügbar");
        }
        CellCoord resolvedCell = nearestTraversableCell(layout, stairExit.cell(), stairExit.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Treppenziel ist nicht begehbar");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.stairExit(stairExit.stairId(), resolvedCell, stairExit.levelZ());
        persistDungeonPosition(layout.mapId(), targetLocation, currentHeading);
        return resolveNavigation(layout, targetLocation, currentHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughTransition(
            DungeonLayout layout,
            DungeonRuntimeTransitionDescriptor transitionDescriptor,
            CardinalDirection currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (transitionDescriptor == null) {
            throw new SQLException("Kein Übergang verfügbar");
        }
        DungeonTransition transition = layout.findTransition(transitionDescriptor.transitionId());
        if (transition == null || transition.destination() == null) {
            throw new SQLException("Übergang konnte nicht aufgelöst werden");
        }
        if (transition.destination() instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            try (Connection conn = DatabaseManager.getConnection()) {
                CampaignStateApi.updatePartyTile(conn, overworld.tileId());
                CampaignStateApi.clearDungeonPosition(conn);
            }
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        if (transition.destination() instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                throw new SQLException("Ziel-Übergang ist noch nicht platziert");
            }
            DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.transition(dungeon.transitionId());
            persistDungeonPosition(dungeon.mapId(), targetLocation, currentHeading);
            if (dungeon.mapId() == layout.mapId()) {
                return resolveNavigation(layout, targetLocation, currentHeading);
            }
            return new DungeonRuntimeNavigationSnapshot(dungeon.mapId(), targetLocation, currentHeading);
        }
        throw new SQLException("Unbekanntes Übergangsziel");
    }

    public void repairStoredRuntimeState(Connection conn) throws SQLException {
        Optional<Long> preferredMapId = CampaignStateReadApi.getDungeonMapId(conn);
        DungeonLayout layout = preferredMapId.isPresent()
                ? mapLoader.loadLayout(conn, preferredMapId.orElseThrow())
                : null;
        if (layout == null) {
            layout = mapLoader.loadFirstUsableLayout(conn);
        }
        if (layout == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        long mapId = layout.mapId();
        Optional<DungeonPositionSummary> storedPosition = CampaignStateReadApi.getDungeonPosition(conn)
                .filter(position -> position.mapId() != null && position.mapId() == mapId);
        DungeonRuntimeLocation storedLocation = storedPosition
                .map(DungeonRuntimeLocations::toRuntimeLocation)
                .orElse(null);
        CardinalDirection storedHeading = CardinalDirection.parse(storedPosition
                .map(DungeonPositionSummary::heading)
                .orElse(null));
        DungeonRuntimeLocation resolvedLocation = DungeonRuntimeLocations.resolveActiveLocation(layout, storedLocation);
        if (resolvedLocation == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        if (!resolvedLocation.equals(storedLocation)) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(mapId, resolvedLocation, storedHeading));
        }
    }

    private void persistDungeonPosition(long mapId, DungeonRuntimeLocation targetLocation, CardinalDirection heading) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(mapId, targetLocation, heading));
        }
    }

    private DungeonRuntimeLocation.Cell resolveConnectionTargetCell(
            DungeonLayout layout,
            features.world.dungeonmap.model.structures.connection.Connection connection,
            DungeonRuntimeDoorDescriptor descriptor,
            int currentLevel
    ) {
        ConnectionEndpoint destination = descriptor.destinationEndpoint();
        if (destination == null && descriptor.activeEndpoint() != null) {
            destination = connection.oppositeOf(descriptor.activeEndpoint());
        }
        if (destination == null) {
            return null;
        }
        DungeonRuntimeLocation.Cell adjacentCell = resolveAdjacentEndpointCell(layout, descriptor.anchorSegment2x(), destination, currentLevel);
        if (adjacentCell != null) {
            return adjacentCell;
        }
        return resolveEndpointAnchor(layout, destination, currentLevel);
    }

    private DungeonRuntimeLocation.Cell resolveAdjacentEndpointCell(
            DungeonLayout layout,
            GridSegment2x anchorSegment2x,
            ConnectionEndpoint endpoint,
            int currentLevel
    ) {
        if (layout == null || anchorSegment2x == null || endpoint == null) {
            return null;
        }
        for (CellCoord cell : anchorSegment2x.touchingCells()) {
            if (!matchesEndpoint(layout, cell, currentLevel, endpoint)) {
                continue;
            }
            CellCoord resolved = nearestTraversableCell(layout, cell, currentLevel);
            if (resolved != null) {
                return new DungeonRuntimeLocation.Cell(resolved, currentLevel);
            }
        }
        return null;
    }

    private boolean matchesEndpoint(DungeonLayout layout, CellCoord cell, int currentLevel, ConnectionEndpoint endpoint) {
        if (layout == null || cell == null || endpoint == null || endpoint.type() == null || endpoint.id() == null) {
            return false;
        }
        return switch (endpoint.type()) {
            case ROOM -> {
                Room room = layout.roomAtCell(cell, currentLevel);
                yield room != null && endpoint.id().equals(room.roomId());
            }
            case CLUSTER -> {
                RoomCluster cluster = layout.clusterAtCell(cell, currentLevel);
                yield cluster != null && endpoint.id().equals(cluster.clusterId());
            }
            case CORRIDOR -> layout.corridorsAtCell(cell, currentLevel).stream()
                    .anyMatch(corridor -> corridor != null && endpoint.id().equals(corridor.corridorId()));
            case STAIR -> layout.stairsAtCell(cell, currentLevel).stream()
                    .anyMatch(stair -> stair != null && endpoint.id().equals(stair.stairId()));
            case TRANSITION -> layout.transitionsAtCell(cell, currentLevel).stream()
                    .anyMatch(transition -> transition != null && endpoint.id().equals(transition.transitionId()));
        };
    }

    private DungeonRuntimeLocation.Cell resolveEndpointAnchor(DungeonLayout layout, ConnectionEndpoint endpoint, int currentLevel) {
        return DungeonRuntimeLocations.resolveEndpointAnchor(layout, endpoint, currentLevel);
    }
}
