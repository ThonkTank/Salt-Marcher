package features.world.dungeon.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonTilePosition;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

/**
 * Owns runtime navigation, tile-only campaign-position persistence, and repair of persisted dungeon state.
 */
public final class DungeonRuntimeApplicationService {

    private final DungeonMapRepository mapRepository;
    private final DungeonMapLoadResolver loadResolver;

    public DungeonRuntimeApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapLoadResolver loadResolver
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.loadResolver = Objects.requireNonNull(loadResolver, "loadResolver");
    }

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonMap layout) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTilePosition storedPosition = CampaignStateReadApi.getDungeonTilePosition(conn)
                    .filter(position -> Objects.equals(position.mapId(), layout.mapId()))
                    .orElse(null);
            return resolveNavigation(layout, storedPosition);
        }
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonMap layout,
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty()) {
            return defaultNavigation(layout, CardinalDirection.defaultDirection());
        }
        return resolveNavigation(layout, snapshot.cell(), snapshot.levelZ(), snapshot.heading());
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonMap layout,
            GridPoint preferredCell,
            int preferredLevelZ,
            CardinalDirection preferredHeading
    ) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        CardinalDirection resolvedHeading = normalizeHeading(preferredHeading);
        GridPoint resolvedCell = nearestTraversableCell(layout, preferredCell, preferredLevelZ);
        return resolvedCell == null
                ? defaultNavigation(layout, resolvedHeading)
                : navigationSnapshot(layout.mapId(), resolvedCell, preferredLevelZ, resolvedHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigateToCell(
            DungeonMap layout,
            DungeonRuntimeNavigationSnapshot currentNavigation,
            GridPoint cell,
            int levelZ
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        GridPoint resolvedCell = nearestTraversableCell(layout, cell, levelZ);
        if (resolvedCell == null) {
            throw new SQLException("Kein begehbares Dungeon-Feld gefunden");
        }
        CardinalDirection nextHeading = CardinalDirection.fromTravel(
                currentNavigation == null ? null : currentNavigation.cell(),
                resolvedCell,
                navigationHeading(currentNavigation));
        return persistNavigation(layout.mapId(), resolvedCell, levelZ, nextHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigate(
            DungeonMap layout,
            DungeonRuntimeNavigationSnapshot currentNavigation,
            DungeonRuntimeAction action
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (action == null || action.target() == null) {
            throw new SQLException("Keine Aktion verfügbar");
        }
        return switch (action.target()) {
            case DungeonRuntimeAction.CellTarget cellTarget -> moveToCellTarget(layout, cellTarget, currentNavigation);
            case DungeonRuntimeAction.DoorTarget doorTarget -> moveThroughDoor(layout, doorTarget, currentNavigation);
            case DungeonRuntimeAction.TransitionTarget transitionTarget ->
                    moveThroughTransition(layout, transitionTarget.transitionId(), navigationHeading(currentNavigation));
        };
    }

    public void repairStoredRuntimeState(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        Optional<DungeonTilePosition> storedPosition = CampaignStateReadApi.getDungeonTilePosition(conn);
        Long preferredMapId = storedPosition.map(DungeonTilePosition::mapId).orElse(null);
        DungeonMap layout = loadResolver.resolveRepairLayout(conn, preferredMapId);
        if (layout == null || layout.mapId() <= 0) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        DungeonTilePosition preferredPosition = storedPosition
                .filter(position -> Objects.equals(position.mapId(), layout.mapId()))
                .orElse(null);
        DungeonRuntimeNavigationSnapshot resolved = resolveNavigation(layout, preferredPosition);
        if (resolved.mapId() == null || resolved.cell() == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        CampaignStateApi.setDungeonTilePosition(conn, toStoredPosition(resolved));
    }

    private DungeonRuntimeNavigationSnapshot moveToCellTarget(
            DungeonMap layout,
            DungeonRuntimeAction.CellTarget target,
            DungeonRuntimeNavigationSnapshot currentNavigation
    ) throws SQLException {
        GridPoint resolvedCell = nearestTraversableCell(layout, target.cell(), target.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel ist nicht begehbar");
        }
        CardinalDirection nextHeading = target.headingOverride() == null
                ? navigationHeading(currentNavigation)
                : target.headingOverride();
        return persistNavigation(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughDoor(
            DungeonMap layout,
            DungeonRuntimeAction.DoorTarget target,
            DungeonRuntimeNavigationSnapshot currentNavigation
    ) throws SQLException {
        DoorRef doorRef = target.doorRef();
        var connection = layout.connectionForDoor(doorRef);
        if (connection == null) {
            throw new SQLException("Verbindung konnte nicht aufgelöst werden");
        }
        if (!connection.isTraversable(layout)) {
            throw new SQLException("Verbindung ist blockiert");
        }
        DungeonRuntimeLocation location = DungeonRuntimeLocation.resolve(layout, currentNavigation);
        var traversalTarget = connection.resolveTraversalTarget(
                layout,
                location == null ? null : location.activeEndpoint());
        if (traversalTarget == null || traversalTarget.transitionId() != null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        GridPoint resolvedCell = nearestTraversableCell(layout, traversalTarget.cell(), traversalTarget.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        return persistNavigation(layout.mapId(), resolvedCell, traversalTarget.levelZ(), traversalTarget.heading());
    }

    private DungeonRuntimeNavigationSnapshot moveThroughTransition(
            DungeonMap layout,
            long transitionId,
            CardinalDirection currentHeading
    ) throws SQLException {
        DungeonTransition transition = layout.findTransition(transitionId);
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
        if (!(transition.destination() instanceof DungeonTransitionDestination.DungeonMapDestination dungeon)) {
            throw new SQLException("Unbekanntes Übergangsziel");
        }
        if (dungeon.transitionId() == null) {
            throw new SQLException("Ziel-Übergang ist noch nicht platziert");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMap targetLayout;
            try {
                targetLayout = dungeon.mapId() == layout.mapId()
                        ? layout
                        : mapRepository.loadMap(conn, dungeon.mapId());
            } catch (RuntimeException exception) {
                throw new SQLException("Ziel-Dungeon konnte nicht geladen werden", exception);
            }
            if (targetLayout == null || targetLayout.mapId() <= 0) {
                throw new SQLException("Ziel-Dungeon konnte nicht geladen werden");
            }
            DungeonRuntimeNavigationSnapshot targetSnapshot = resolveTransitionAnchor(
                    targetLayout,
                    dungeon.transitionId(),
                    currentHeading);
            CampaignStateApi.setDungeonTilePosition(conn, toStoredPosition(targetSnapshot));
            return targetSnapshot;
        }
    }

    private DungeonRuntimeNavigationSnapshot resolveTransitionAnchor(
            DungeonMap layout,
            Long transitionId,
            CardinalDirection heading
    ) throws SQLException {
        if (layout == null || transitionId == null) {
            throw new SQLException("Ziel-Übergang konnte nicht aufgelöst werden");
        }
        DungeonTransition targetTransition = layout.findTransition(transitionId);
        GridPoint entryPoint = targetTransition == null || targetTransition.localConnection() == null
                ? null
                : targetTransition.localConnection().entryPoint(layout);
        if (targetTransition == null || entryPoint == null) {
            throw new SQLException("Ziel-Übergang ist nicht platziert");
        }
        GridPoint resolvedCell = nearestTraversableCell(
                layout,
                entryPoint,
                entryPoint.z());
        if (resolvedCell == null) {
            throw new SQLException("Ziel-Übergang ist nicht begehbar");
        }
        CardinalDirection resolvedHeading = targetTransition.localConnection().entryHeading(layout);
        return navigationSnapshot(layout.mapId(), resolvedCell, entryPoint.z(), resolvedHeading == null ? heading : resolvedHeading);
    }

    private DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonMap layout,
            DungeonTilePosition storedPosition
    ) {
        return resolveNavigation(
                layout,
                storedCell(storedPosition),
                storedLevel(storedPosition),
                storedHeading(storedPosition));
    }

    private DungeonRuntimeNavigationSnapshot defaultNavigation(DungeonMap layout, CardinalDirection heading) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        GridPoint fallback = layout.defaultRuntimePosition();
        return fallback == null
                ? DungeonRuntimeNavigationSnapshot.empty()
                : navigationSnapshot(layout.mapId(), fallback, fallback.z(), heading);
    }

    private GridPoint nearestTraversableCell(DungeonMap layout, GridPoint preferredCell, int preferredLevelZ) {
        if (layout == null || layout.mapId() <= 0 || preferredCell == null) {
            return null;
        }
        return layout.nearestTraversableCell(preferredCell, preferredLevelZ);
    }

    private DungeonRuntimeNavigationSnapshot persistNavigation(
            long mapId,
            GridPoint cell,
            int levelZ,
            CardinalDirection heading
    ) throws SQLException {
        DungeonRuntimeNavigationSnapshot snapshot = navigationSnapshot(mapId, cell, levelZ, heading);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonTilePosition(conn, toStoredPosition(snapshot));
        }
        return snapshot;
    }

    private static DungeonTilePosition toStoredPosition(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot == null || snapshot.mapId() == null || snapshot.cell() == null) {
            return null;
        }
        return new DungeonTilePosition(
                snapshot.mapId(),
                snapshot.levelZ(),
                snapshot.cell().x2() / 2,
                snapshot.cell().y2() / 2,
                normalizeHeading(snapshot.heading()).name());
    }

    // Only concrete stored tiles are valid runtime truth. Incomplete rows resolve via the layout fallback and the
    // repair path writes back the resolved tile, rather than keeping alternate location encodings alive.
    private static GridPoint storedCell(DungeonTilePosition storedPosition) {
        if (storedPosition == null || storedPosition.cellX() == null || storedPosition.cellY() == null) {
            return null;
        }
        return GridPoint.cell(storedPosition.cellX(), storedPosition.cellY(), 0);
    }

    private static int storedLevel(DungeonTilePosition storedPosition) {
        return storedPosition == null || storedPosition.levelZ() == null ? 0 : storedPosition.levelZ();
    }

    private static CardinalDirection storedHeading(DungeonTilePosition storedPosition) {
        return CardinalDirection.parse(storedPosition == null ? null : storedPosition.heading());
    }

    private static DungeonRuntimeNavigationSnapshot navigationSnapshot(
            long mapId,
            GridPoint cell,
            int levelZ,
            CardinalDirection heading
    ) {
        return new DungeonRuntimeNavigationSnapshot(mapId, cell, levelZ, normalizeHeading(heading));
    }

    private static CardinalDirection normalizeHeading(CardinalDirection heading) {
        return heading == null ? CardinalDirection.defaultDirection() : heading;
    }

    private static CardinalDirection navigationHeading(DungeonRuntimeNavigationSnapshot navigation) {
        return normalizeHeading(navigation == null ? null : navigation.heading());
    }
}
