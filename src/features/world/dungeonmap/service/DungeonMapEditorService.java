package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public final class DungeonMapEditorService {

    public enum LinkCreateStatus {
        CREATED,
        SAME_ENDPOINT,
        DUPLICATE,
        INVALID_ENDPOINT
    }

    public record LinkCreateResult(LinkCreateStatus status, Long linkId) {}

    private DungeonMapEditorService() {
        throw new AssertionError("No instances");
    }

    public static long createMap(String name, int width, int height) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonMapRepository.insertMap(conn, new DungeonMap(null, name, width, height));
        }
    }

    public static void updateMap(long mapId, String name, int width, int height) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMap existingMap = DungeonMapRepository.findMap(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonMapRepository.updateMap(conn, mapId, name, width, height);
                if (width < existingMap.width() || height < existingMap.height()) {
                    clearActiveEndpointIfOutsideBounds(conn, mapId, width, height);
                    DungeonMapRepository.deleteSquaresOutsideBounds(conn, mapId, width, height);
                }
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void applySquarePaints(long mapId, List<DungeonSquarePaint> paints) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                clearActiveEndpointIfErased(conn, mapId, paints);
                DungeonSquareRepository.applySquarePaints(conn, mapId, paints);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static long saveRoom(DungeonRoom room) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonRoomRepository.upsertRoom(conn, room);
        }
    }

    public static void deleteRoom(long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRoomRepository.deleteRoom(conn, roomId);
        }
    }

    public static void assignSquareRoom(long squareId, Long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonSquareRepository.assignSquareRoom(conn, squareId, roomId);
        }
    }

    public static long saveArea(DungeonArea area) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonAreaRepository.upsertArea(conn, area);
        }
    }

    public static void deleteArea(long areaId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonAreaRepository.deleteArea(conn, areaId);
        }
    }

    public static void assignRoomArea(long roomId, Long areaId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRoomRepository.assignRoomArea(conn, roomId, areaId);
        }
    }

    public static long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonEndpointRepository.upsertEndpoint(conn, endpoint);
        }
    }

    public static void deleteEndpoint(long endpointId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> endpoint = DungeonEndpointRepository.findEndpoint(conn, endpointId);
            if (endpoint.isEmpty()) {
                return;
            }
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
                if (currentEndpointId != null && currentEndpointId.equals(endpointId)) {
                    Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(endpoint.get().mapId());
                    DungeonCampaignStateAdapter.updateDungeonPosition(conn, currentMapId, null);
                }
                DungeonEndpointRepository.deleteEndpoint(conn, endpointId);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static LinkCreateResult createLink(long mapId, long fromEndpointId, long toEndpointId, String label) throws Exception {
        if (fromEndpointId == toEndpointId) {
            return new LinkCreateResult(LinkCreateStatus.SAME_ENDPOINT, null);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> from = DungeonEndpointRepository.findEndpoint(conn, fromEndpointId);
            Optional<DungeonEndpoint> to = DungeonEndpointRepository.findEndpoint(conn, toEndpointId);
            if (from.isEmpty() || to.isEmpty()
                    || from.get().mapId() != mapId
                    || to.get().mapId() != mapId) {
                return new LinkCreateResult(LinkCreateStatus.INVALID_ENDPOINT, null);
            }
            Long existing = DungeonLinkRepository.findExistingLink(conn, mapId, fromEndpointId, toEndpointId).orElse(null);
            if (existing != null) {
                return new LinkCreateResult(LinkCreateStatus.DUPLICATE, existing);
            }
            long linkId = DungeonLinkRepository.insertLink(conn, new DungeonLink(
                    null, mapId, fromEndpointId, toEndpointId, label, null));
            return new LinkCreateResult(LinkCreateStatus.CREATED, linkId);
        }
    }

    public static void deleteLink(long linkId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLinkRepository.deleteLink(conn, linkId);
        }
    }

    public static void updateLinkLabel(long linkId, String label) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLinkRepository.updateLinkLabel(conn, linkId, label);
        }
    }

    private static void clearActiveEndpointIfOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
        Optional<DungeonEndpoint> activeEndpoint = findActiveEndpoint(conn, mapId);
        if (activeEndpoint.isEmpty()) {
            return;
        }
        DungeonEndpoint endpoint = activeEndpoint.get();
        if (endpoint.x() < width && endpoint.y() < height) {
            return;
        }
        DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
    }

    private static void clearActiveEndpointIfErased(Connection conn, long mapId, List<DungeonSquarePaint> paints) throws SQLException {
        Optional<DungeonEndpoint> activeEndpoint = findActiveEndpoint(conn, mapId);
        if (activeEndpoint.isEmpty()) {
            return;
        }
        DungeonEndpoint endpoint = activeEndpoint.get();
        for (DungeonSquarePaint paint : paints) {
            if (!paint.filled() && paint.x() == endpoint.x() && paint.y() == endpoint.y()) {
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
                return;
            }
        }
    }

    private static Optional<DungeonEndpoint> findActiveEndpoint(Connection conn, long mapId) throws SQLException {
        Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (currentMapId == null || currentMapId != mapId) {
            return Optional.empty();
        }
        Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
        if (currentEndpointId == null) {
            return Optional.empty();
        }
        Optional<DungeonEndpoint> currentEndpoint = DungeonEndpointRepository.findEndpoint(conn, currentEndpointId);
        if (currentEndpoint.isPresent() && currentEndpoint.get().mapId() == mapId) {
            return currentEndpoint;
        }
        DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
        return Optional.empty();
    }
}
