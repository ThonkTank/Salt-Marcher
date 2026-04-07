package features.world.dungeonmap.structure.repository;

import features.world.dungeonmap.structure.model.WallKind;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * App-global persistence owner for named wall-kind definitions.
 */
public final class DungeonWallKindRepository {

    public Map<Long, WallKind> loadWallKinds(Connection conn) throws SQLException {
        LinkedHashMap<Long, WallKind> result = new LinkedHashMap<>();
        result.put(WallKind.solid().wallKindId(), WallKind.solid());
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT wall_kind_id, wall_key, name, blocks_passage, blocks_sight, render_style,"
                        + " supports_door_attachments, built_in"
                        + " FROM dungeon_wall_kinds ORDER BY wall_kind_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                WallKind wallKind = new WallKind(
                        rs.getLong("wall_kind_id"),
                        rs.getString("wall_key"),
                        rs.getString("name"),
                        rs.getInt("blocks_passage") != 0,
                        rs.getInt("blocks_sight") != 0,
                        parseRenderStyle(rs.getString("render_style")),
                        rs.getInt("supports_door_attachments") != 0,
                        rs.getInt("built_in") != 0);
                result.put(wallKind.wallKindId(), wallKind);
            }
        }
        return result.isEmpty() ? Map.of(WallKind.solid().wallKindId(), WallKind.solid()) : Map.copyOf(result);
    }

    private static WallKind.RenderStyle parseRenderStyle(String persistedValue) {
        if (persistedValue == null || persistedValue.isBlank()) {
            return WallKind.RenderStyle.SOLID;
        }
        try {
            return WallKind.RenderStyle.valueOf(persistedValue.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return WallKind.RenderStyle.SOLID;
        }
    }
}
