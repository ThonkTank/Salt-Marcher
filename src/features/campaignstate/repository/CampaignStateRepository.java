package features.campaignstate.repository;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.DungeonPositionSummary;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.model.CampaignState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

public final class CampaignStateRepository {

    private CampaignStateRepository() {
        throw new AssertionError("No instances");
    }

    /** Returns the singleton campaign state (campaign_id = 1). */
    public static Optional<CampaignState> get(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM campaign_state WHERE campaign_id=1")) {
            if (rs.next()) return Optional.of(mapRow(rs));
        }
        return Optional.empty();
    }

    public static void upsert(Connection conn, CampaignState state) throws SQLException {
        if (state.CampaignId != 1L) {
            throw new IllegalArgumentException("upsert(): campaign_id must be 1 for singleton campaign_state");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO campaign_state(campaign_id, map_id, party_tile_id, calendar_id,"
                        + " current_epoch_day, current_phase_id, current_weather, notes, dungeon_map_id, dungeon_location_type, dungeon_room_id, dungeon_corridor_id, dungeon_location_key, dungeon_heading)"
                        + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
                        + " ON CONFLICT(campaign_id) DO UPDATE SET"
                        + "   map_id=excluded.map_id,"
                        + "   party_tile_id=excluded.party_tile_id,"
                        + "   calendar_id=excluded.calendar_id,"
                        + "   current_epoch_day=excluded.current_epoch_day,"
                        + "   current_phase_id=excluded.current_phase_id,"
                        + "   current_weather=excluded.current_weather,"
                        + "   notes=excluded.notes,"
                        + "   dungeon_map_id=excluded.dungeon_map_id,"
                        + "   dungeon_location_type=excluded.dungeon_location_type,"
                        + "   dungeon_room_id=excluded.dungeon_room_id,"
                        + "   dungeon_corridor_id=excluded.dungeon_corridor_id,"
                        + "   dungeon_location_key=excluded.dungeon_location_key,"
                        + "   dungeon_heading=excluded.dungeon_heading")) {
            ps.setLong(1, state.CampaignId);
            setNullableLong(ps, 2, state.MapId);
            setNullableLong(ps, 3, state.PartyTileId);
            setNullableLong(ps, 4, state.CalendarId);
            ps.setLong(5, state.CurrentEpochDay);
            setNullableLong(ps, 6, state.CurrentPhaseId);
            ps.setString(7, state.CurrentWeather);
            ps.setString(8, state.Notes);
            setNullableLong(ps, 9, state.DungeonMapId);
            ps.setString(10, state.DungeonLocationType);
            setNullableLong(ps, 11, state.DungeonRoomId);
            setNullableLong(ps, 12, state.DungeonCorridorId);
            ps.setString(13, state.DungeonLocationKey);
            ps.setString(14, state.DungeonHeading);
            ps.executeUpdate();
        }
    }

    /** Updates only the party_tile_id column without touching other campaign state fields. */
    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET party_tile_id=? WHERE campaign_id=1")) {
            ps.setLong(1, tileId);
            ps.executeUpdate();
        }
    }

    /**
     * Clears party position when it points to a tile outside the given map radius.
     * Intended for map-radius shrink operations coordinated by application services.
     */
    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int radius) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET party_tile_id = NULL"
                        + " WHERE party_tile_id IN ("
                        + "   SELECT tile_id FROM hex_tiles WHERE map_id=?"
                        + "   AND (abs(q) + abs(r) + abs(q + r)) / 2 > ?"
                        + " )")) {
            ps.setLong(1, mapId);
            ps.setInt(2, radius);
            ps.executeUpdate();
        }
    }

    public static Optional<DungeonPositionSummary> getDungeonPosition(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, dungeon_location_type, dungeon_room_id, dungeon_corridor_id, dungeon_location_key, dungeon_heading FROM campaign_state WHERE campaign_id=1");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return Optional.empty();
            }
            Long mapId = getNullableLong(rs, "dungeon_map_id");
            String locationTypeValue = rs.getString("dungeon_location_type");
            Long roomId = getNullableLong(rs, "dungeon_room_id");
            Long corridorId = getNullableLong(rs, "dungeon_corridor_id");
            String locationKey = rs.getString("dungeon_location_key");
            String heading = rs.getString("dungeon_heading");
            CampaignDungeonLocationType locationType = parseLocationType(locationTypeValue, roomId, corridorId, locationKey);
            if (mapId == null && locationType == null && roomId == null && corridorId == null && locationKey == null && heading == null) {
                return Optional.empty();
            }
            return Optional.of(new DungeonPositionSummary(mapId, locationType, roomId, corridorId, locationKey, heading));
        }
    }

    public static void setDungeonPosition(Connection conn, DungeonPositionRef position) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET dungeon_map_id=?, dungeon_location_type=?, dungeon_room_id=?, dungeon_corridor_id=?, dungeon_location_key=?, dungeon_heading=? WHERE campaign_id=1")) {
            setNullableLong(ps, 1, position == null ? null : position.mapId());
            ps.setString(2, position == null || position.locationType() == null ? null : position.locationType().name());
            setNullableLong(ps, 3, position != null && position.locationType() == CampaignDungeonLocationType.ROOM ? position.roomId() : null);
            setNullableLong(ps, 4, position != null && position.locationType() == CampaignDungeonLocationType.CORRIDOR ? position.corridorId() : null);
            ps.setString(5, position == null
                    || position.locationType() == CampaignDungeonLocationType.ROOM
                    || position.locationType() == CampaignDungeonLocationType.CORRIDOR
                    ? null
                    : position.locationKey());
            ps.setString(6, position == null ? null : position.heading());
            ps.executeUpdate();
        }
    }

    public static void clearDungeonPosition(Connection conn) throws SQLException {
        setDungeonPosition(conn, null);
    }

    /** @throws IllegalArgumentException if days is not positive */
    public static void advanceDay(Connection conn, int days) throws SQLException {
        if (days <= 0) throw new IllegalArgumentException("advanceDay(): days must be positive: " + days);
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET current_epoch_day = current_epoch_day + ? WHERE campaign_id=1")) {
            ps.setInt(1, days);
            ps.executeUpdate();
        }
    }

    /**
     * Advances to the next time-of-day phase cyclically (wraps after the last phase back to the first).
     * Also increments the day when wrapping past the last phase.
     *
     * The two UPDATE statements form one logical operation and run in an explicit transaction
     * to guarantee atomicity: phase advance and day increment either both commit or both roll back.
     */
    public static void advancePhase(Connection conn) throws SQLException {
        boolean wasAutoCommit = conn.getAutoCommit();
        boolean startedTransaction = wasAutoCommit;
        try {
            if (startedTransaction) {
                conn.setAutoCommit(false);
            }
            try (Statement stmt = conn.createStatement()) {
                // Find next phase by display_order, wrap around to first
                stmt.execute(
                    "UPDATE campaign_state SET current_phase_id = ("
                    + "  SELECT COALESCE("
                    + "    (SELECT phase_id FROM time_of_day_phases"
                    + "      WHERE display_order > (SELECT display_order FROM time_of_day_phases WHERE phase_id = campaign_state.current_phase_id)"
                    + "      ORDER BY display_order LIMIT 1),"
                    + "    (SELECT phase_id FROM time_of_day_phases ORDER BY display_order LIMIT 1)"
                    + "  )"
                    + ") WHERE campaign_id=1");
                // If we wrapped back to the first phase, advance the day
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

    private static CampaignState mapRow(ResultSet rs) throws SQLException {
        CampaignState s = new CampaignState();
        s.CampaignId = rs.getLong("campaign_id");
        long mapId = rs.getLong("map_id");
        s.MapId = rs.wasNull() ? null : mapId;
        long tileId = rs.getLong("party_tile_id");
        s.PartyTileId = rs.wasNull() ? null : tileId;
        long calId = rs.getLong("calendar_id");
        s.CalendarId = rs.wasNull() ? null : calId;
        s.CurrentEpochDay = rs.getLong("current_epoch_day");
        long phaseId = rs.getLong("current_phase_id");
        s.CurrentPhaseId = rs.wasNull() ? null : phaseId;
        s.CurrentWeather = rs.getString("current_weather");
        s.Notes = rs.getString("notes");
        long dungeonMapId = rs.getLong("dungeon_map_id");
        s.DungeonMapId = rs.wasNull() ? null : dungeonMapId;
        s.DungeonLocationType = rs.getString("dungeon_location_type");
        long dungeonRoomId = rs.getLong("dungeon_room_id");
        s.DungeonRoomId = rs.wasNull() ? null : dungeonRoomId;
        long dungeonCorridorId = rs.getLong("dungeon_corridor_id");
        s.DungeonCorridorId = rs.wasNull() ? null : dungeonCorridorId;
        s.DungeonLocationKey = rs.getString("dungeon_location_key");
        s.DungeonHeading = rs.getString("dungeon_heading");
        return s;
    }

    private static CampaignDungeonLocationType parseLocationType(String value, Long roomId, Long corridorId, String locationKey) {
        if (value != null && !value.isBlank()) {
            try {
                return CampaignDungeonLocationType.valueOf(value);
            } catch (IllegalArgumentException ignored) {
                if (roomId != null) {
                    return CampaignDungeonLocationType.ROOM;
                }
                if (corridorId != null) {
                    return CampaignDungeonLocationType.CORRIDOR;
                }
                if (locationKey == null || locationKey.isBlank()) {
                    return null;
                }
                return locationKey.startsWith("tile:")
                        ? CampaignDungeonLocationType.TILE
                        : CampaignDungeonLocationType.CORRIDOR_COMPONENT;
            }
        }
        if (locationKey != null && !locationKey.isBlank()) {
            return locationKey.startsWith("tile:") ? CampaignDungeonLocationType.TILE : CampaignDungeonLocationType.CORRIDOR_COMPONENT;
        }
        if (corridorId != null) {
            return CampaignDungeonLocationType.CORRIDOR;
        }
        if (roomId != null) {
            return CampaignDungeonLocationType.ROOM;
        }
        return null;
    }

    private static void setNullableLong(PreparedStatement ps, int idx, Long value) throws SQLException {
        if (value != null) ps.setLong(idx, value);
        else ps.setNull(idx, java.sql.Types.BIGINT);
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
