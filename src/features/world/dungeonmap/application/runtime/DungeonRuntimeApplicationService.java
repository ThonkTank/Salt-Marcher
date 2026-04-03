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
 * Owns runtime navigation, tile-only campaign-position persistence, and repair of persisted dungeon state.
 */
public final class DungeonRuntimeApplicationService {

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
                    .filter(position -> Objects.equals(position.mapId(), layout.mapId()))
                    .orElse(null);
            return resolveNavigation(layout, storedPosition);
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
        return resolvedCell == null
                ? defaultNavigation(layout, resolvedHeading)
                : navigationSnapshot(layout.mapId(), resolvedCell, preferredLevelZ, resolvedHeading);
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
        return persistNavigation(layout.mapId(), resolvedCell, levelZ, nextHeading);
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
        DungeonPositionSummary preferredPosition = storedPosition
                .filter(position -> Objects.equals(position.mapId(), layout.mapId()))
                .orElse(null);
        DungeonRuntimeNavigationSnapshot resolved = resolveNavigation(layout, preferredPosition);
        if (resolved.mapId() == null || resolved.cell() == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        CampaignStateApi.setDungeonPosition(conn, toStoredPosition(resolved));
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
        return persistNavigation(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
    }

    private DungeonRuntimeNavigationSnapshot moveThroughDoor(
            DungeonLayout layout,
            DungeonRuntimeAction.DoorTarget target,
            CardinalDirection currentHeading
    ) throws SQLException {
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
        return persistNavigation(layout.mapId(), resolvedCell, target.levelZ(), nextHeading);
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
            CampaignStateApi.setDungeonPosition(conn, toStoredPosition(targetSnapshot));
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
        return navigationSnapshot(layout.mapId(), resolvedCell, targetTransition.anchor().z(), heading);
    }

    private DungeonRuntimeNavigationSnapshot resolveNavigation(
            DungeonLayout layout,
            DungeonPositionSummary storedPosition
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

    private DungeonLayout preferredRepairLayout(Connection conn, DungeonPositionSummary storedPosition) throws SQLException {
        Long preferredMapId = storedPosition == null ? null : storedPosition.mapId();
        DungeonLayout layout = preferredMapId == null ? null : layoutRepository.loadLayout(conn, preferredMapId);
        return layout != null ? layout : layoutRepository.loadFirstUsableLayout(conn);
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
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, new DungeonPositionRef(
                    mapId,
                    levelZ,
                    CampaignDungeonLocationType.TILE,
                    null,
                    null,
                    tileLocationKey(cell),
                    normalizeHeading(heading).name()));
        }
        return navigationSnapshot(mapId, cell, levelZ, heading);
    }

    private static DungeonPositionRef toStoredPosition(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot == null || snapshot.mapId() == null || snapshot.cell() == null) {
            return null;
        }
        return new DungeonPositionRef(
                snapshot.mapId(),
                snapshot.levelZ(),
                CampaignDungeonLocationType.TILE,
                null,
                null,
                tileLocationKey(snapshot.cell()),
                normalizeHeading(snapshot.heading()).name());
    }

    private static CellCoord storedCell(DungeonPositionSummary storedPosition) {
        if (storedPosition == null
                || storedPosition.locationType() != CampaignDungeonLocationType.TILE
                || storedPosition.locationKey() == null
                || !storedPosition.locationKey().startsWith("tile:")) {
            return null;
        }
        String coordinates = storedPosition.locationKey().substring("tile:".length());
        int separator = coordinates.indexOf(',');
        if (separator <= 0 || separator >= coordinates.length() - 1) {
            return null;
        }
        try {
            int x = Integer.parseInt(coordinates.substring(0, separator));
            int y = Integer.parseInt(coordinates.substring(separator + 1));
            return new CellCoord(x, y);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static int storedLevel(DungeonPositionSummary storedPosition) {
        return storedPosition == null || storedPosition.levelZ() == null ? 0 : storedPosition.levelZ();
    }

    private static CardinalDirection storedHeading(DungeonPositionSummary storedPosition) {
        return CardinalDirection.parse(storedPosition == null ? null : storedPosition.heading());
    }

    private static String tileLocationKey(CellCoord cell) {
        if (cell == null) {
            return null;
        }
        return "tile:" + cell.x() + "," + cell.y();
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
}
