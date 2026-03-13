package features.world.dungeonmap.service.editing;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

final class DungeonCampaignPositionEditingSupport {

    private DungeonCampaignPositionEditingSupport() {
        throw new AssertionError("No instances");
    }

    static void clearActiveEndpointIfOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
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

    static void clearInvalidActiveEndpointAfterEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
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
