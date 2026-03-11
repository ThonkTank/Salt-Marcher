package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonFeatureRepository;
import features.world.dungeonmap.repository.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
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
                    DungeonTopologyService.shrinkMap(conn, mapId, width, height);
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

    public static void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                clearInvalidActiveEndpointAfterEdits(conn, mapId, edits);
                DungeonTopologyService.applySquareEdits(conn, mapId, edits);
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

    public static long saveFeature(DungeonFeature feature) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonFeatureRepository.upsertFeature(conn, feature);
        }
    }

    public static void deleteFeature(long featureId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonFeatureRepository.deleteFeature(conn, featureId);
        }
    }

    public static void addSquareToFeature(long featureId, long squareId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonFeature> feature = DungeonFeatureRepository.findFeature(conn, featureId);
            if (feature.isEmpty()) {
                throw new IllegalArgumentException("Unknown dungeon feature: " + featureId);
            }
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonFeatureTileRepository.addTile(conn, featureId, squareId);
                DungeonTopologyService.validateFeatureFootprintConnected(
                        DungeonFeatureTileRepository.getTilesForFeature(conn, featureId));
                conn.commit();
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void removeSquareFromFeature(long featureId, long squareId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonFeatureTileRepository.removeTile(conn, featureId, squareId);
                List<DungeonFeatureTile> remainingTiles = DungeonFeatureTileRepository.getTilesForFeature(conn, featureId);
                if (remainingTiles.isEmpty()) {
                    DungeonFeatureRepository.deleteFeature(conn, featureId);
                } else {
                    DungeonTopologyService.validateFeatureFootprintConnected(remainingTiles);
                }
                conn.commit();
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
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

    public static long savePassage(DungeonPassage passage) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTopologyService.validatePassageForSave(conn, passage);
            return DungeonPassageRepository.upsertPassage(conn, passage);
        }
    }

    public static void deletePassage(long passageId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonPassageRepository.deletePassage(conn, passageId);
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

    private static void clearInvalidActiveEndpointAfterEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Optional<DungeonEndpoint> activeEndpoint = findActiveEndpoint(conn, mapId);
        if (activeEndpoint.isEmpty()) {
            return;
        }
        DungeonEndpoint endpoint = activeEndpoint.get();
        for (DungeonSquarePaint edit : edits) {
            if (!edit.filled() && edit.x() == endpoint.x() && edit.y() == endpoint.y()) {
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
