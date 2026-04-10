package features.campaignstate.repository;

import features.campaignstate.state.AdvanceDayState;
import features.campaignstate.state.AdvancePhaseState;
import features.campaignstate.state.CampaignStateState;
import features.campaignstate.state.DungeonTilePositionState;
import features.campaignstate.state.PartyTileRadiusState;
import features.campaignstate.state.PartyTileState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

/**
 * Canonical persistence boundary for the singleton world-session aggregate in
 * {@code campaign_state}.
 */
@SuppressWarnings("unused")
public final class CampaignstateRepository {

    private CampaignstateRepository() {
        throw new AssertionError("No instances");
    }

    public static Optional<CampaignStateState> loadCampaignState(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM campaign_state WHERE campaign_id=1")) {
            if (rs.next()) {
                return Optional.of(mapCampaignState(rs));
            }
        }
        return Optional.empty();
    }

    public static void upsertCampaignState(Connection conn, CampaignStateState state) throws SQLException {
        if (state.campaignId() != 1L) {
            throw new IllegalArgumentException("upsertCampaignState(): campaignId must be 1 for singleton campaign_state");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO campaign_state(campaign_id, map_id, party_tile_id, calendar_id,"
                        + " current_epoch_day, current_phase_id, current_weather, notes, dungeon_map_id, dungeon_level_z, dungeon_cell_x, dungeon_cell_y, dungeon_heading)"
                        + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)"
                        + " ON CONFLICT(campaign_id) DO UPDATE SET"
                        + "   map_id=excluded.map_id,"
                        + "   party_tile_id=excluded.party_tile_id,"
                        + "   calendar_id=excluded.calendar_id,"
                        + "   current_epoch_day=excluded.current_epoch_day,"
                        + "   current_phase_id=excluded.current_phase_id,"
                        + "   current_weather=excluded.current_weather,"
                        + "   notes=excluded.notes,"
                        + "   dungeon_map_id=excluded.dungeon_map_id,"
                        + "   dungeon_level_z=excluded.dungeon_level_z,"
                        + "   dungeon_cell_x=excluded.dungeon_cell_x,"
                        + "   dungeon_cell_y=excluded.dungeon_cell_y,"
                        + "   dungeon_heading=excluded.dungeon_heading")) {
            ps.setLong(1, state.campaignId());
            setNullableLong(ps, 2, state.mapId());
            setNullableLong(ps, 3, state.partyTileId());
            setNullableLong(ps, 4, state.calendarId());
            ps.setLong(5, state.currentEpochDay());
            setNullableLong(ps, 6, state.currentPhaseId());
            ps.setString(7, state.currentWeather());
            ps.setString(8, state.notes());
            setNullableLong(ps, 9, state.dungeonMapId());
            setNullableInteger(ps, 10, state.dungeonLevelZ());
            setNullableInteger(ps, 11, state.dungeonCellX());
            setNullableInteger(ps, 12, state.dungeonCellY());
            ps.setString(13, state.dungeonHeading());
            ps.executeUpdate();
        }
    }

    public static Optional<PartyTileState> loadPartyTile(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT party_tile_id FROM campaign_state WHERE campaign_id=1");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return Optional.empty();
            }
            Long tileId = getNullableLong(rs, "party_tile_id");
            return tileId == null ? Optional.empty() : Optional.of(new PartyTileState(tileId));
        }
    }

    public static void updatePartyTile(Connection conn, PartyTileState state) throws SQLException {
        if (state.tileId() == null) {
            throw new IllegalArgumentException("updatePartyTile(): tileId must not be null");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET party_tile_id=? WHERE campaign_id=1")) {
            ps.setLong(1, state.tileId());
            ps.executeUpdate();
        }
    }

    public static void clearPartyTileOutsideRadius(Connection conn, PartyTileRadiusState state) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET party_tile_id = NULL"
                        + " WHERE party_tile_id IN ("
                        + "   SELECT tile_id FROM hex_tiles WHERE map_id=?"
                        + "   AND (abs(q) + abs(r) + abs(q + r)) / 2 > ?"
                        + " )")) {
            ps.setLong(1, state.mapId());
            ps.setInt(2, state.radius());
            ps.executeUpdate();
        }
    }

    public static Optional<DungeonTilePositionState> loadDungeonTilePosition(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, dungeon_level_z, dungeon_cell_x, dungeon_cell_y, dungeon_heading"
                        + " FROM campaign_state WHERE campaign_id=1");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return Optional.empty();
            }
            Long mapId = getNullableLong(rs, "dungeon_map_id");
            Integer levelZ = getNullableInteger(rs, "dungeon_level_z");
            Integer cellX = getNullableInteger(rs, "dungeon_cell_x");
            Integer cellY = getNullableInteger(rs, "dungeon_cell_y");
            String heading = normalizeString(rs.getString("dungeon_heading"));
            if (mapId == null && levelZ == null && cellX == null && cellY == null && heading == null) {
                return Optional.empty();
            }
            return Optional.of(new DungeonTilePositionState(mapId, levelZ, cellX, cellY, heading));
        }
    }

    public static void saveDungeonTilePosition(Connection conn, DungeonTilePositionState state) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET dungeon_map_id=?, dungeon_level_z=?, dungeon_cell_x=?, dungeon_cell_y=?, dungeon_heading=? WHERE campaign_id=1")) {
            setNullableLong(ps, 1, state.mapId());
            setNullableInteger(ps, 2, state.levelZ());
            setNullableInteger(ps, 3, state.cellX());
            setNullableInteger(ps, 4, state.cellY());
            ps.setString(5, state.heading());
            ps.executeUpdate();
        }
    }

    public static void advanceDay(Connection conn, AdvanceDayState state) throws SQLException {
        if (state.days() <= 0) {
            throw new IllegalArgumentException("advanceDay(): days must be positive: " + state.days());
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET current_epoch_day = current_epoch_day + ? WHERE campaign_id=1")) {
            ps.setInt(1, state.days());
            ps.executeUpdate();
        }
    }

    public static void advancePhase(Connection conn, AdvancePhaseState state) throws SQLException {
        boolean wasAutoCommit = conn.getAutoCommit();
        boolean startedTransaction = wasAutoCommit;
        try {
            if (startedTransaction) {
                conn.setAutoCommit(false);
            }
            try (Statement stmt = conn.createStatement()) {
                stmt.execute(
                        "UPDATE campaign_state SET current_phase_id = ("
                                + "  SELECT COALESCE("
                                + "    (SELECT phase_id FROM time_of_day_phases"
                                + "      WHERE display_order > (SELECT display_order FROM time_of_day_phases WHERE phase_id = campaign_state.current_phase_id)"
                                + "      ORDER BY display_order LIMIT 1),"
                                + "    (SELECT phase_id FROM time_of_day_phases ORDER BY display_order LIMIT 1)"
                                + "  )"
                                + ") WHERE campaign_id=1");
                stmt.execute(
                        "UPDATE campaign_state SET current_epoch_day = current_epoch_day + 1"
                                + " WHERE campaign_id=1"
                                + "   AND (SELECT display_order FROM time_of_day_phases WHERE phase_id = current_phase_id)"
                                + "       = (SELECT MIN(display_order) FROM time_of_day_phases)");
            }
            if (startedTransaction) {
                conn.commit();
            }
        } catch (Exception e) {
            if (startedTransaction) {
                conn.rollback();
            }
            if (e instanceof SQLException sqlException) {
                throw sqlException;
            }
            if (e instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new SQLException("advancePhase() fehlgeschlagen", e);
        } finally {
            if (conn.getAutoCommit() != wasAutoCommit) {
                conn.setAutoCommit(wasAutoCommit);
            }
        }
    }

    private static CampaignStateState mapCampaignState(ResultSet rs) throws SQLException {
        return new CampaignStateState(
                rs.getLong("campaign_id"),
                getNullableLong(rs, "map_id"),
                getNullableLong(rs, "party_tile_id"),
                getNullableLong(rs, "calendar_id"),
                rs.getLong("current_epoch_day"),
                getNullableLong(rs, "current_phase_id"),
                rs.getString("current_weather"),
                rs.getString("notes"),
                getNullableLong(rs, "dungeon_map_id"),
                getNullableInteger(rs, "dungeon_level_z"),
                getNullableInteger(rs, "dungeon_cell_x"),
                getNullableInteger(rs, "dungeon_cell_y"),
                normalizeString(rs.getString("dungeon_heading")));
    }

    private static void setNullableLong(PreparedStatement ps, int idx, Long value) throws SQLException {
        if (value != null) {
            ps.setLong(idx, value);
        } else {
            ps.setNull(idx, java.sql.Types.BIGINT);
        }
    }

    private static void setNullableInteger(PreparedStatement ps, int idx, Integer value) throws SQLException {
        if (value != null) {
            ps.setInt(idx, value);
        } else {
            ps.setNull(idx, java.sql.Types.INTEGER);
        }
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Integer getNullableInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static String normalizeString(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
