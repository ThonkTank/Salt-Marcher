package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonFeatureRepository;
import features.world.dungeonmap.repository.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.repository.DungeonWallRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.topology.DungeonAreaNormalizationService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public final class DungeonMapEditorService {

    // Area normalization is a write-side invariant and must not run from query/load flows.

    public enum LinkCreateStatus {
        CREATED,
        SAME_ANCHOR,
        DUPLICATE,
        INVALID_ANCHOR
    }

    public record LinkCreateResult(LinkCreateStatus status, Long linkId) {}

    private DungeonMapEditorService() {
        throw new AssertionError("No instances");
    }

    public static long createMap(String name, int width, int height) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                long mapId = DungeonMapRepository.insertMap(conn, new DungeonMap(null, name, width, height));
                normalizeAreaAssignments(conn, mapId);
                conn.commit();
                return mapId;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
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
                normalizeAreaAssignments(conn, mapId);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void deleteMap(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMapRepository.deleteMap(conn, mapId);
        }
    }

    public static void applySquareEditsAndReconcileState(
            long mapId,
            List<DungeonSquarePaint> edits
    ) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                clearInvalidActiveEndpointAfterEdits(conn, mapId, edits);
                DungeonTopologyService.applySquareEdits(conn, mapId, edits);
                normalizeAreaAssignments(conn, mapId);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void updateRoomMetadata(long roomId, String name, String description) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRoomRepository.updateRoomMetadata(conn, roomId, name, description);
        }
    }

    public static long saveArea(DungeonArea area) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonAreaRepository.upsertArea(conn, area);
        }
    }

    public static void deleteArea(long areaId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            var existingArea = DungeonAreaRepository.findArea(conn, areaId);
            if (existingArea.isEmpty()) {
                return;
            }
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonAreaRepository.deleteArea(conn, areaId);
                normalizeAreaAssignments(conn, existingArea.get().mapId());
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
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

    public static void assignRoomArea(long roomId, long areaId) throws Exception {
        if (areaId <= 0) {
            throw new IllegalArgumentException("areaId must be persisted");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                assignRoomAreaWithinMap(conn, roomId, areaId);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    private static void assignRoomAreaWithinMap(Connection conn, long roomId, long areaId) throws SQLException {
        DungeonRoom room = DungeonRoomRepository.findRoom(conn, roomId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon room: " + roomId));
        DungeonArea area = DungeonAreaRepository.findArea(conn, areaId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon area: " + areaId));
        if (room.mapId() != area.mapId()) {
            throw new IllegalArgumentException(
                    "Dungeon room " + roomId + " cannot be assigned to area " + areaId + " from a different map");
        }
        DungeonRoomRepository.assignRoomArea(conn, roomId, areaId);
        normalizeAreaAssignments(conn, room.mapId());
    }

    // All room/area writes should pass through this helper so the invariant stays transaction-scoped.
    private static void normalizeAreaAssignments(Connection conn, long mapId) throws SQLException {
        DungeonAreaNormalizationService.normalizeMapAreas(conn, mapId);
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
                DungeonLinkRepository.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.endpoint(endpointId));
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

    public static LinkCreateResult createLink(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor, String label) throws Exception {
        if (fromAnchor == null || toAnchor == null) {
            return new LinkCreateResult(LinkCreateStatus.INVALID_ANCHOR, null);
        }
        if (fromAnchor.equals(toAnchor)) {
            return new LinkCreateResult(LinkCreateStatus.SAME_ANCHOR, null);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!isValidLinkAnchor(conn, mapId, fromAnchor) || !isValidLinkAnchor(conn, mapId, toAnchor)) {
                return new LinkCreateResult(LinkCreateStatus.INVALID_ANCHOR, null);
            }
            Long existing = DungeonLinkRepository.findExistingLink(conn, mapId, fromAnchor, toAnchor).orElse(null);
            if (existing != null) {
                return new LinkCreateResult(LinkCreateStatus.DUPLICATE, existing);
            }
            long linkId = DungeonLinkRepository.insertLink(conn, new DungeonLink(
                    null, mapId, fromAnchor, toAnchor, label, null));
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
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonTopologyService.validatePassageForSave(conn, passage);
                long passageId = DungeonPassageRepository.upsertPassage(conn, passage);
                conn.commit();
                return passageId;
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void deletePassage(long passageId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLinkRepository.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.passage(passageId));
            DungeonPassageRepository.deletePassage(conn, passageId);
        }
    }

    public static void applyWallEdits(
            long mapId,
            List<DungeonWallEdit> edits
    ) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                deletePassagesReplacedByWalls(conn, mapId, edits);
                DungeonTopologyService.applyWallEdits(conn, mapId, edits);
                conn.commit();
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
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

    private static void deletePassagesReplacedByWalls(Connection conn, long mapId, List<DungeonWallEdit> edits) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT passage_id FROM dungeon_passages WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            for (DungeonWallEdit edit : edits) {
                if (!edit.wallPresent()) {
                    continue;
                }
                ps.setLong(1, mapId);
                ps.setInt(2, edit.x());
                ps.setInt(3, edit.y());
                ps.setString(4, edit.direction().dbValue());
                try (var rs = ps.executeQuery()) {
                    while (rs.next()) {
                        long passageId = rs.getLong("passage_id");
                        DungeonLinkRepository.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.passage(passageId));
                        DungeonPassageRepository.deletePassage(conn, passageId);
                    }
                }
            }
        }
    }

    private static boolean isValidLinkAnchor(Connection conn, long mapId, DungeonLinkAnchor anchor) throws SQLException {
        return switch (anchor.type()) {
            case ENDPOINT -> DungeonEndpointRepository.findEndpoint(conn, anchor.anchorId())
                    .map(endpoint -> endpoint.mapId() == mapId)
                    .orElse(false);
            case PASSAGE -> DungeonPassageRepository.findPassage(conn, anchor.anchorId())
                    .map(passage -> passage.mapId() == mapId)
                    .orElse(false);
        };
    }

}
