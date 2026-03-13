package features.world.dungeonmap.service.support;

import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.repository.connection.DungeonEndpointRepository;
import features.world.dungeonmap.repository.connection.DungeonLinkRepository;
import features.world.dungeonmap.repository.connection.DungeonPassageRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

public final class DungeonLinkIntegrityService {

    private DungeonLinkIntegrityService() {
        throw new AssertionError("No instances");
    }

    public static boolean isValidAnchor(Connection conn, long mapId, DungeonLinkAnchor anchor) throws SQLException {
        if (anchor == null) {
            return false;
        }
        return switch (anchor.type()) {
            case ENDPOINT -> DungeonEndpointRepository.findEndpoint(conn, anchor.anchorId())
                    .map(endpoint -> endpoint.mapId() == mapId)
                    .orElse(false);
            case PASSAGE -> DungeonPassageRepository.findPassage(conn, anchor.anchorId())
                    .map(passage -> passage.mapId() == mapId)
                    .orElse(false);
        };
    }

    public static Optional<Long> findExistingLink(
            Connection conn,
            long mapId,
            DungeonLinkAnchor anchorA,
            DungeonLinkAnchor anchorB
    ) throws SQLException {
        return DungeonLinkRepository.findExistingLink(conn, mapId, anchorA, anchorB);
    }

    public static void deleteLinksTouchingAnchor(Connection conn, DungeonLinkAnchor anchor) throws SQLException {
        if (anchor == null) {
            return;
        }
        DungeonLinkRepository.deleteLinksTouchingAnchor(conn, anchor);
    }

    public static void reconcileMap(Connection conn, long mapId) throws SQLException {
        DungeonLinkRepository.deleteLinksWithMissingAnchors(conn, mapId);
    }

    public static void reconcileAllMaps(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT dungeon_map_id FROM dungeon_maps");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                reconcileMap(conn, rs.getLong(1));
            }
        }
    }
}
