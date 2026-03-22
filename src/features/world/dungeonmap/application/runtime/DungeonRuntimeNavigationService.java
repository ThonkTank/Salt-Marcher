package features.world.dungeonmap.application.runtime;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

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

    public Point2i nearestTraversableTile(DungeonLayout layout, Point2i preferredTile) {
        if (layout == null || layout.mapId() <= 0) {
            return null;
        }
        return layout.nearestTraversableCell(preferredTile);
    }

    public DungeonRuntimeNavigationSnapshot moveToTile(
            DungeonLayout layout,
            Point2i fromTile,
            Point2i tile,
            DungeonHeading currentHeading
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        Point2i resolvedTile = nearestTraversableTile(layout, tile);
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
            Room room,
            DungeonRuntimeDoorDescriptor door
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (room == null || door == null) {
            throw new SQLException("Keine Tuer verfuegbar");
        }
        Point2i resolvedTile = nearestTraversableTile(layout, door.outsideCell());
        if (resolvedTile == null) {
            throw new SQLException("Ziel hinter der Tuer ist nicht begehbar");
        }
        DungeonHeading nextHeading = DungeonHeading.fromDirection(door.direction());
        DungeonRuntimeLocation targetLocation = DungeonRuntimeLocation.tile(resolvedTile);
        try (Connection conn = DatabaseManager.getConnection()) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(layout.mapId(), targetLocation, nextHeading));
        }
        return resolveNavigation(layout, targetLocation, nextHeading);
    }
}
