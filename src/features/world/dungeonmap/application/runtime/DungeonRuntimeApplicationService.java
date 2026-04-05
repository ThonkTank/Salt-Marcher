package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonTilePosition;
import features.world.dungeonmap.loading.DungeonMapLoadResolver;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

/**
 * Owns runtime navigation, tile-only campaign-position persistence, and repair of persisted dungeon state.
 */
public final class DungeonRuntimeApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonMapLoadResolver loadResolver;

    public DungeonRuntimeApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonMapLoadResolver loadResolver
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.loadResolver = Objects.requireNonNull(loadResolver, "loadResolver");
    }

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonLayout layout) throws SQLException {
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
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty()) {
            return defaultNavigation(layout, CardinalDirection.defaultDirection());
        }
        return resolveNavigation(layout, snapshot.cell(), snapshot.levelZ(), snapshot.heading());
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            CellCoord preferredCell,
            int preferredLevelZ,
            CardinalDirection preferredHeading
    ) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        CardinalDirection resolvedHeading = normalizeHeading(preferredHeading);
        CellCoord resolvedCell = nearestTraversableCell(layout, preferredCell, preferredLevelZ);
        return resolvedCell == null
                ? defaultNavigation(layout, resolvedHeading)
                : navigationSnapshot(layout.mapId(), resolvedCell, preferredLevelZ, resolvedHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigateToCell(
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot currentNavigation,
            CellCoord cell,
            int levelZ
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        CellCoord resolvedCell = nearestTraversableCell(layout, cell, levelZ);
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
            DungeonLayout layout,
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
        DungeonLayout layout = loadResolver.resolveRepairLayout(conn, preferredMapId);
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
            DungeonLayout layout,
            DungeonRuntimeAction.CellTarget target,
            DungeonRuntimeNavigationSnapshot currentNavigation
    ) throws SQLException {
        CellCoord resolvedCell = nearestTraversableCell(layout, target.cell(), target.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel ist nicht begehbar");
        }
        CardinalDirection nextHeading = target.headingOverride() == null
                ? navigationHeading(currentNavigation)
                : target.headingOverride();
        return persistNavigation(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughDoor(
            DungeonLayout layout,
            DungeonRuntimeAction.DoorTarget target,
            DungeonRuntimeNavigationSnapshot currentNavigation
    ) throws SQLException {
        DungeonRuntimeAction.CellTarget destination = target.destination();
        var connection = layout.connectionAt(destination.levelZ(), target.anchorSegment2x());
        if (connection == null) {
            throw new SQLException("Verbindung konnte nicht aufgelöst werden");
        }
        if (!connection.isTraversable()) {
            throw new SQLException("Verbindung ist blockiert");
        }
        CellCoord resolvedCell = nearestTraversableCell(layout, destination.cell(), destination.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        CardinalDirection nextHeading = destination.headingOverride() == null
                ? navigationHeading(currentNavigation)
                : destination.headingOverride();
        return persistNavigation(layout.mapId(), resolvedCell, destination.levelZ(), nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughTransition(
            DungeonLayout layout,
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
            DungeonLayout targetLayout;
            try {
                targetLayout = dungeon.mapId() == layout.mapId()
                        ? layout
                        : layoutRepository.loadLayout(conn, dungeon.mapId());
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
            DungeonLayout layout,
            Long transitionId,
            CardinalDirection heading
    ) throws SQLException {
        if (layout == null || transitionId == null) {
            throw new SQLException("Ziel-Übergang konnte nicht aufgelöst werden");
        }
        DungeonTransition targetTransition = layout.findTransition(transitionId);
        CubePoint entryPoint = targetTransition == null ? null : targetTransition.entryPoint(layout);
        if (targetTransition == null || entryPoint == null) {
            throw new SQLException("Ziel-Übergang ist nicht platziert");
        }
        CellCoord resolvedCell = nearestTraversableCell(
                layout,
                entryPoint.projectedCell(),
                entryPoint.z());
        if (resolvedCell == null) {
            throw new SQLException("Ziel-Übergang ist nicht begehbar");
        }
        CardinalDirection resolvedHeading = targetTransition.entryHeading(layout);
        return navigationSnapshot(layout.mapId(), resolvedCell, entryPoint.z(), resolvedHeading == null ? heading : resolvedHeading);
    }

    private DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonTilePosition storedPosition
    ) {
        return resolveNavigation(
                layout,
                storedCell(storedPosition),
                storedLevel(storedPosition),
                storedHeading(storedPosition));
    }

    private DungeonRuntimeNavigationSnapshot defaultNavigation(DungeonLayout layout, CardinalDirection heading) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        CubePoint fallback = layout.defaultRuntimePosition();
        return fallback == null
                ? DungeonRuntimeNavigationSnapshot.empty()
                : navigationSnapshot(layout.mapId(), fallback.projectedCell(), fallback.z(), heading);
    }

    private CellCoord nearestTraversableCell(DungeonLayout layout, CellCoord preferredCell, int preferredLevelZ) {
        if (layout == null || layout.mapId() <= 0 || preferredCell == null) {
            return null;
        }
        return layout.nearestTraversableCell(preferredCell, preferredLevelZ);
    }

    private DungeonRuntimeNavigationSnapshot persistNavigation(
            long mapId,
            CellCoord cell,
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
                snapshot.cell().x(),
                snapshot.cell().y(),
                normalizeHeading(snapshot.heading()).name());
    }

    // Only concrete stored tiles are valid runtime truth. Incomplete rows resolve via the layout fallback and the
    // repair path writes back the resolved tile, rather than keeping alternate location encodings alive.
    private static CellCoord storedCell(DungeonTilePosition storedPosition) {
        if (storedPosition == null || storedPosition.cellX() == null || storedPosition.cellY() == null) {
            return null;
        }
        return new CellCoord(storedPosition.cellX(), storedPosition.cellY());
    }

    private static int storedLevel(DungeonTilePosition storedPosition) {
        return storedPosition == null || storedPosition.levelZ() == null ? 0 : storedPosition.levelZ();
    }

    private static CardinalDirection storedHeading(DungeonTilePosition storedPosition) {
        return CardinalDirection.parse(storedPosition == null ? null : storedPosition.heading());
    }

    private static DungeonRuntimeNavigationSnapshot navigationSnapshot(
            long mapId,
            CellCoord cell,
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
