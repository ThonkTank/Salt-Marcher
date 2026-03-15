package features.world.dungeonmap.repository.concept;

import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

public final class DungeonConceptPartyProfileRepository {

    private DungeonConceptPartyProfileRepository() {
        throw new AssertionError("No instances");
    }

    public static Optional<DungeonConceptPartyProfile> findByMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT map_id, party_size FROM dungeon_concept_party_profiles WHERE map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonConceptPartyProfile(
                        rs.getLong("map_id"),
                        rs.getInt("party_size")));
            }
        }
    }

    public static void upsert(Connection conn, DungeonConceptPartyProfile profile) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_concept_party_profiles(map_id, party_size) VALUES(?, ?) "
                        + "ON CONFLICT(map_id) DO UPDATE SET party_size=excluded.party_size")) {
            ps.setLong(1, profile.mapId());
            ps.setInt(2, profile.partySize());
            ps.executeUpdate();
        }
    }
}
