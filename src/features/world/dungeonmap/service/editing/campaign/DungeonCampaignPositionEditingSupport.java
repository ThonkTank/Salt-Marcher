package features.world.dungeonmap.service.editing.campaign;

import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
public final class DungeonCampaignPositionEditingSupport {

    private DungeonCampaignPositionEditingSupport() {
        throw new AssertionError("No instances");
    }

    public static void clearActivePositionIfOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
        Long squareId = activeSquareId(conn, mapId);
        if (squareId == null) {
            return;
        }
        var square = DungeonSquareRepository.findSquare(conn, squareId).orElse(null);
        if (square != null && square.x() < width && square.y() < height) {
            return;
        }
        DungeonCampaignStateAdapter.clearDungeonPosition(conn);
    }

    public static void clearInvalidActivePositionAfterEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Long squareId = activeSquareId(conn, mapId);
        if (squareId == null) {
            return;
        }
        var square = DungeonSquareRepository.findSquare(conn, squareId).orElse(null);
        if (square == null) {
            DungeonCampaignStateAdapter.clearDungeonPosition(conn);
            return;
        }
        for (DungeonSquarePaint edit : edits == null ? List.<DungeonSquarePaint>of() : edits) {
            if (!edit.filled() && edit.x() == square.x() && edit.y() == square.y()) {
                DungeonCampaignStateAdapter.clearDungeonPosition(conn);
                return;
            }
        }
    }

    private static Long activeSquareId(Connection conn, long mapId) throws SQLException {
        Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (currentMapId == null || currentMapId != mapId) {
            return null;
        }
        return DungeonCampaignStateAdapter.getDungeonSquareId(conn).orElse(null);
    }
}
