package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonRuntimeNavigationService {

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonLayout layout) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            var storedPosition = CampaignStateReadApi.getDungeonPosition(conn)
                    .filter(position -> position.mapId() != null && position.mapId() == layout.mapId())
                    .orElse(null);
            DungeonRuntimeLocation storedLocation = DungeonRuntimeLocations.toRuntimeLocation(storedPosition);
            DungeonHeading storedHeading = DungeonHeading.parse(storedPosition == null ? null : storedPosition.heading());
            return resolveNavigation(layout, storedLocation, storedHeading);
        }
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(DungeonLayout layout, DungeonRuntimeLocation preferredLocation) {
        return resolveNavigation(layout, preferredLocation, DungeonHeading.defaultHeading());
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonRuntimeLocation preferredLocation,
            DungeonHeading preferredHeading
    ) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        DungeonRuntimeLocation resolvedLocation = DungeonRuntimeLocations.resolveActiveLocation(layout, preferredLocation);
        DungeonHeading resolvedHeading = preferredHeading == null ? DungeonHeading.defaultHeading() : preferredHeading;
        return new DungeonRuntimeNavigationSnapshot(layout.mapId(), resolvedLocation, resolvedHeading);
    }

    public CubePoint nearestTraversableTile(DungeonLayout layout, CubePoint preferredTile) {
        if (layout == null || layout.mapId() <= 0) {
            return null;
        }
        return layout.nearestTraversableCell(preferredTile);
    }

    public DungeonRuntimeNavigationSnapshot moveToTile(
            DungeonLayout layout,
            CubePoint fromTile,
            CubePoint tile,
            DungeonHeading currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        CubePoint resolvedTile = nearestTraversableTile(layout, tile);
        if (resolvedTile == null) {
            throw new SQLException("Kein begehbares Dungeon-Feld gefunden");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.tile(resolvedTile);
        DungeonHeading nextHeading = DungeonHeading.fromTravel(fromTile, resolvedTile, currentHeading);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation, nextHeading));
        }
        return resolveNavigation(layout, targetLocation, nextHeading);
    }

    public DungeonRuntimeNavigationSnapshot moveThroughConnection(
            DungeonLayout layout,
            DungeonRuntimeDoorDescriptor descriptor,
            int currentLevel
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (descriptor == null || descriptor.anchorEdge() == null) {
            throw new SQLException("Keine Verbindung verfügbar");
        }
        features.world.dungeonmap.model.structures.connection.Connection connection = layout.connectionAt(descriptor.anchorEdge());
        if (connection == null) {
            throw new SQLException("Verbindung konnte nicht aufgelöst werden");
        }
        if (!connection.isTraversable()) {
            throw new SQLException("Verbindung ist blockiert");
        }
        CubePoint resolvedTile = resolveConnectionTargetTile(layout, connection, descriptor, currentLevel);
        if (resolvedTile == null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        DungeonHeading nextHeading = DungeonHeading.fromDirection(descriptor.direction());
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.tile(resolvedTile);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation, nextHeading));
        }
        return resolveNavigation(layout, targetLocation, nextHeading);
    }

    public DungeonRuntimeNavigationSnapshot moveThroughStair(
            DungeonLayout layout,
            DungeonRuntimeStairDescriptor stair,
            DungeonHeading currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (stair == null || !(stair.targetLocation() instanceof DungeonRuntimeLocation.StairExit stairExit)) {
            throw new SQLException("Kein Treppenziel verfügbar");
        }
        CubePoint resolvedTile = nearestTraversableTile(layout, stairExit.tile());
        if (resolvedTile == null) {
            throw new SQLException("Treppenziel ist nicht begehbar");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.stairExit(stairExit.stairId(), resolvedTile);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation, currentHeading));
        }
        return resolveNavigation(layout, targetLocation, currentHeading);
    }

    public DungeonRuntimeNavigationSnapshot moveThroughTransition(
            DungeonLayout layout,
            DungeonRuntimeTransitionDescriptor transitionDescriptor,
            DungeonHeading currentHeading
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
            try (Connection conn = DatabaseManager.getConnection()) {
                CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(
                        dungeon.mapId(),
                        DungeonRuntimeLocation.transition(dungeon.transitionId()),
                        currentHeading));
            }
            return new DungeonRuntimeNavigationSnapshot(dungeon.mapId(), DungeonRuntimeLocation.transition(dungeon.transitionId()), currentHeading);
        }
        throw new SQLException("Unbekanntes Übergangsziel");
    }

    private CubePoint resolveConnectionTargetTile(
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
        CubePoint adjacentTile = resolveAdjacentEndpointTile(layout, descriptor.anchorEdge(), destination, currentLevel);
        if (adjacentTile != null) {
            return adjacentTile;
        }
        return resolveEndpointAnchor(layout, destination, currentLevel);
    }

    private CubePoint resolveAdjacentEndpointTile(
            DungeonLayout layout,
            VertexEdge anchorEdge,
            ConnectionEndpoint endpoint,
            int currentLevel
    ) {
        if (layout == null || anchorEdge == null || endpoint == null) {
            return null;
        }
        for (Point2i cell : anchorEdge.touchingCells()) {
            if (!matchesEndpoint(layout, cell, currentLevel, endpoint)) {
                continue;
            }
            CubePoint resolved = nearestTraversableTile(layout, CubePoint.at(cell, currentLevel));
            if (resolved != null) {
                return resolved;
            }
        }
        return null;
    }

    private boolean matchesEndpoint(DungeonLayout layout, Point2i cell, int currentLevel, ConnectionEndpoint endpoint) {
        if (layout == null || cell == null || endpoint == null || endpoint.type() == null || endpoint.id() == null) {
            return false;
        }
        return switch (endpoint.type()) {
            case ROOM -> {
                Room room = layout.roomAtCell(cell);
                yield room != null && endpoint.id().equals(room.roomId());
            }
            case CLUSTER -> {
                RoomCluster cluster = layout.clusterAtCell(cell);
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

    private CubePoint resolveEndpointAnchor(DungeonLayout layout, ConnectionEndpoint endpoint, int currentLevel) {
        if (layout == null || endpoint == null || endpoint.type() == null || endpoint.id() == null) {
            return null;
        }
        return switch (endpoint.type()) {
            case ROOM -> {
                Room room = layout.findRoom(endpoint.id());
                if (room == null || room.floor() == null) {
                    yield null;
                }
                yield nearestTraversableTile(layout, CubePoint.at(room.floor().shape().centerCell(), layout.levelForRoom(room.roomId())));
            }
            case CLUSTER -> {
                RoomCluster cluster = layout.findCluster(endpoint.id());
                if (cluster == null) {
                    yield null;
                }
                yield nearestTraversableTile(layout, CubePoint.at(cluster.center(), layout.levelForCluster(cluster.clusterId())));
            }
            case CORRIDOR -> {
                Corridor corridor = layout.findCorridor(endpoint.id());
                yield nearestTraversableTile(layout, DungeonRuntimeCorridorGeometry.canonicalAnchor(layout, corridor));
            }
            case STAIR -> {
                DungeonStair stair = layout.findStair(endpoint.id());
                if (stair == null) {
                    yield null;
                }
                CubePoint preferred = stair.exits().stream()
                        .map(exit -> exit.position())
                        .filter(position -> position != null && position.z() == currentLevel)
                        .findFirst()
                        .orElseGet(() -> stair.exits().stream()
                                .map(exit -> exit.position())
                                .filter(position -> position != null)
                                .findFirst()
                                .orElse(null));
                yield nearestTraversableTile(layout, preferred);
            }
            case TRANSITION -> {
                DungeonTransition transition = layout.findTransition(endpoint.id());
                yield transition == null ? null : nearestTraversableTile(layout, transition.anchor());
            }
        };
    }
}
