package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
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
        return new DungeonRuntimeNavigationSnapshot(resolvedLocation, resolvedHeading);
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

    public DungeonRuntimeNavigationSnapshot moveThroughDoor(
            DungeonLayout layout,
            DungeonRuntimeSurface surface,
            DungeonRuntimeDoorDescriptor door,
            int currentLevel
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (surface == null || door == null) {
            throw new SQLException("Keine Tür verfügbar");
        }
        CubePoint resolvedTile = nearestTraversableTile(layout, CubePoint.at(door.outsideCell(), currentLevel));
        if (resolvedTile == null) {
            throw new SQLException("Ziel hinter der Tür ist nicht begehbar");
        }
        DungeonHeading nextHeading = DungeonHeading.fromDirection(door.direction());
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.tile(resolvedTile);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation, nextHeading));
        }
        return resolveNavigation(layout, targetLocation, nextHeading);
    }
}
