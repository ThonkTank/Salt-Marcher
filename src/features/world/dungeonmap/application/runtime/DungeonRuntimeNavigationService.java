package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;

import java.sql.Connection;
import java.sql.SQLException;

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
        return new DungeonRuntimeNavigationSnapshot(resolvedLocation);
    }

    public Point2i nearestTraversableTile(DungeonLayout layout, Point2i preferredTile) {
        if (layout == null || layout.mapId() <= 0) {
            return null;
        }
        return layout.nearestTraversableCell(preferredTile);
    }

    public DungeonRuntimeNavigationSnapshot moveToTile(DungeonLayout layout, Point2i tile) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        Point2i resolvedTile = nearestTraversableTile(layout, tile);
        if (resolvedTile == null) {
            throw new SQLException("Kein begehbares Dungeon-Feld gefunden");
        }
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.tile(resolvedTile);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation));
        }
        return resolveNavigation(layout, targetLocation);
    }
}
