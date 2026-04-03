package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.api.DungeonPositionSummary;
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
 * Owns runtime navigation, campaign-position serialization, and repair of persisted dungeon state.
 */
public final class DungeonRuntimeApplicationService {

    private static final String TILE_PREFIX = "tile:";

    private final DungeonLayoutRepository layoutRepository;

    public DungeonRuntimeApplicationService(DungeonLayoutRepository layoutRepository) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
    }

    public DungeonRuntimeNavigationSnapshot loadNavigation(DungeonLayout layout) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonPositionSummary storedPosition = CampaignStateReadApi.getDungeonPosition(conn)
                    .filter(position -> position.mapId() != null && position.mapId() == layout.mapId())
                    .orElse(null);
            CardinalDirection storedHeading = CardinalDirection.parse(storedPosition == null ? null : storedPosition.heading());
            StoredTile storedTile = parseStoredTile(storedPosition);
            return storedTile == null
                    ? defaultNavigation(layout, storedHeading)
                    : resolveNavigation(layout, storedTile.cell(), storedTile.levelZ(), storedHeading);
        }
    }

    public DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null) {
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
        if (resolvedCell != null) {
            return new DungeonRuntimeNavigationSnapshot(layout.mapId(), resolvedCell, preferredLevelZ, resolvedHeading);
        }
        return defaultNavigation(layout, resolvedHeading);
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
        CardinalDirection nextHeading = CardinalDirection.fromTravel(fromCell, resolvedCell, currentHeading);
        persistDungeonPosition(layout.mapId(), resolvedCell, levelZ, nextHeading);
        return resolveNavigation(layout, resolvedCell, levelZ, nextHeading);
    }

    public DungeonRuntimeNavigationSnapshot navigate(
            DungeonLayout layout,
            DungeonRuntimeAction action,
            CardinalDirection currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (action == null || action.target() == null) {
            throw new SQLException("Keine Aktion verfügbar");
        }
        CardinalDirection resolvedHeading = normalizeHeading(currentHeading);
        return switch (action.target()) {
            case DungeonRuntimeAction.CellTarget cellTarget -> moveToCellTarget(layout, cellTarget, resolvedHeading);
            case DungeonRuntimeAction.DoorTarget doorTarget -> moveThroughDoor(layout, doorTarget, resolvedHeading);
            case DungeonRuntimeAction.TransitionTarget transitionTarget ->
                    moveThroughTransition(layout, transitionTarget.transitionId(), resolvedHeading);
        };
    }

    public void repairStoredRuntimeState(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        Optional<DungeonPositionSummary> storedPosition = CampaignStateReadApi.getDungeonPosition(conn);
        DungeonLayout layout = preferredRepairLayout(conn, storedPosition.orElse(null));
        if (layout == null || layout.mapId() <= 0) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        CardinalDirection heading = CardinalDirection.parse(storedPosition.map(DungeonPositionSummary::heading).orElse(null));
        StoredTile storedTile = parseStoredTile(storedPosition.orElse(null));
        DungeonRuntimeNavigationSnapshot resolved = storedTile == null
                ? defaultNavigation(layout, heading)
                : resolveNavigation(layout, storedTile.cell(), storedTile.levelZ(), heading);
        if (resolved.mapId() == null || resolved.cell() == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        DungeonPositionRef repairedPosition = toDungeonPositionRef(
                resolved.mapId(),
                resolved.cell(),
                resolved.levelZ(),
                resolved.heading());
        if (!matchesStoredPosition(storedPosition.orElse(null), repairedPosition)) {
            CampaignStateApi.setDungeonPosition(conn, repairedPosition);
        }
    }

    private DungeonRuntimeNavigationSnapshot moveToCellTarget(
            DungeonLayout layout,
            DungeonRuntimeAction.CellTarget target,
            CardinalDirection currentHeading
    ) throws SQLException {
        CellCoord resolvedCell = nearestTraversableCell(layout, target.cell(), target.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel ist nicht begehbar");
        }
        CardinalDirection nextHeading = target.headingOverride() == null ? currentHeading : target.headingOverride();
        persistDungeonPosition(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
        return resolveNavigation(layout, resolvedCell, target.levelZ(), nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughDoor(
            DungeonLayout layout,
            DungeonRuntimeAction.DoorTarget target,
            CardinalDirection currentHeading
    ) throws SQLException {
        if (target.anchorSegment2x() == null) {
            throw new SQLException("Keine Verbindung verfügbar");
        }
        var connection = layout.connectionAt(target.levelZ(), target.anchorSegment2x());
        if (connection == null) {
            throw new SQLException("Verbindung konnte nicht aufgelöst werden");
        }
        if (!connection.isTraversable()) {
            throw new SQLException("Verbindung ist blockiert");
        }
        CellCoord resolvedCell = nearestTraversableCell(layout, target.targetCellHint(), target.levelZ());
        if (resolvedCell == null) {
            throw new SQLException("Ziel hinter der Verbindung ist nicht begehbar");
        }
        CardinalDirection nextHeading = target.headingOverride() == null ? currentHeading : target.headingOverride();
        persistDungeonPosition(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
        return resolveNavigation(layout, resolvedCell, target.levelZ(), nextHeading);
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
            DungeonLayout targetLayout = dungeon.mapId() == layout.mapId()
                    ? layout
                    : layoutRepository.loadLayout(conn, dungeon.mapId());
            if (targetLayout == null || targetLayout.mapId() <= 0) {
                throw new SQLException("Ziel-Dungeon konnte nicht geladen werden");
            }
            DungeonRuntimeNavigationSnapshot targetSnapshot = resolveTransitionAnchor(
                    targetLayout,
                    dungeon.transitionId(),
                    currentHeading);
            persistDungeonPosition(
                    conn,
                    targetSnapshot.mapId(),
                    targetSnapshot.cell(),
                    targetSnapshot.levelZ(),
                    targetSnapshot.heading());
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
        if (targetTransition == null || targetTransition.anchor() == null) {
            throw new SQLException("Ziel-Übergang ist nicht platziert");
        }
        CellCoord resolvedCell = nearestTraversableCell(
                layout,
                targetTransition.anchor().projectedCell(),
                targetTransition.anchor().z());
        if (resolvedCell == null) {
            throw new SQLException("Ziel-Übergang ist nicht begehbar");
        }
        return new DungeonRuntimeNavigationSnapshot(
                layout.mapId(),
                resolvedCell,
                targetTransition.anchor().z(),
                normalizeHeading(heading));
    }

    private DungeonRuntimeNavigationSnapshot defaultNavigation(DungeonLayout layout, CardinalDirection heading) {
        if (layout == null || layout.mapId() <= 0) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        CubePoint fallback = layout.defaultRuntimePosition();
        if (fallback == null) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        return new DungeonRuntimeNavigationSnapshot(
                layout.mapId(),
                fallback.projectedCell(),
                fallback.z(),
                normalizeHeading(heading));
    }

    private DungeonLayout preferredRepairLayout(Connection conn, DungeonPositionSummary storedPosition) throws SQLException {
        Long preferredMapId = storedPosition == null ? null : storedPosition.mapId();
        if (preferredMapId == null) {
            preferredMapId = CampaignStateReadApi.getDungeonMapId(conn).orElse(null);
        }
        DungeonLayout layout = preferredMapId == null ? null : layoutRepository.loadLayout(conn, preferredMapId);
        return layout != null ? layout : layoutRepository.loadFirstUsableLayout(conn);
    }

    private CellCoord nearestTraversableCell(DungeonLayout layout, CellCoord preferredCell, int preferredLevelZ) {
        if (layout == null || layout.mapId() <= 0 || preferredCell == null) {
            return null;
        }
        return layout.nearestTraversableCell(preferredCell, preferredLevelZ);
    }

    private void persistDungeonPosition(
            long mapId,
            CellCoord cell,
            int levelZ,
            CardinalDirection heading
    ) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            persistDungeonPosition(conn, mapId, cell, levelZ, heading);
        }
    }

    private void persistDungeonPosition(
            Connection conn,
            long mapId,
            CellCoord cell,
            int levelZ,
            CardinalDirection heading
    ) throws SQLException {
        CampaignStateApi.setDungeonPosition(conn, toDungeonPositionRef(mapId, cell, levelZ, heading));
    }

    private static DungeonPositionRef toDungeonPositionRef(
            long mapId,
            CellCoord cell,
            int levelZ,
            CardinalDirection heading
    ) {
        if (cell == null) {
            return null;
        }
        return new DungeonPositionRef(
                mapId,
                levelZ,
                CampaignDungeonLocationType.TILE,
                null,
                null,
                formatTileLocation(cell, levelZ),
                normalizeHeading(heading).name());
    }

    private static StoredTile parseStoredTile(DungeonPositionSummary position) {
        if (position == null
                || position.locationType() != CampaignDungeonLocationType.TILE
                || position.locationKey() == null
                || !position.locationKey().startsWith(TILE_PREFIX)) {
            return null;
        }
        String[] parts = position.locationKey().substring(TILE_PREFIX.length()).split(",");
        try {
            if (parts.length == 3) {
                return new StoredTile(
                        new CellCoord(Integer.parseInt(parts[0]), Integer.parseInt(parts[1])),
                        Integer.parseInt(parts[2]));
            }
            if (parts.length == 2 && position.levelZ() != null) {
                return new StoredTile(
                        new CellCoord(Integer.parseInt(parts[0]), Integer.parseInt(parts[1])),
                        position.levelZ());
            }
            return null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String formatTileLocation(CellCoord cell, int levelZ) {
        return TILE_PREFIX + cell.x() + "," + cell.y() + "," + levelZ;
    }

    private static boolean matchesStoredPosition(DungeonPositionSummary stored, DungeonPositionRef repaired) {
        if (stored == null || repaired == null) {
            return false;
        }
        return Objects.equals(stored.mapId(), repaired.mapId())
                && Objects.equals(stored.levelZ(), repaired.levelZ())
                && stored.locationType() == repaired.locationType()
                && Objects.equals(stored.roomId(), repaired.roomId())
                && Objects.equals(stored.corridorId(), repaired.corridorId())
                && Objects.equals(stored.locationKey(), repaired.locationKey())
                && Objects.equals(CardinalDirection.parse(stored.heading()).name(), repaired.heading());
    }

    private static CardinalDirection normalizeHeading(CardinalDirection heading) {
        return heading == null ? CardinalDirection.defaultDirection() : heading;
    }

    private record StoredTile(CellCoord cell, int levelZ) {
    }
}
