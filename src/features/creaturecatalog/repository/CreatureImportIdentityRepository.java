package features.creaturecatalog.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

/**
 * Low-level creature identity access for import-time ID assignment decisions.
 */
public final class CreatureImportIdentityRepository {
    private CreatureImportIdentityRepository() {
        throw new AssertionError("No instances");
    }

    public record CreatureIdentity(String name, String sourceSlug, String slugKey) {}

    public static CreatureIdentity loadCreatureIdentity(Connection conn, Long id) throws SQLException {
        if (id == null) return null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT name, source_slug, slug_key FROM creatures WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new CreatureIdentity(
                        rsGetString(rs, "name"),
                        rsGetString(rs, "source_slug"),
                        rsGetString(rs, "slug_key"));
            }
        }
    }

    public static Long nextAvailableId(Connection conn, Set<Long> reservedIds) throws SQLException {
        long candidate = queryLong(conn, "SELECT COALESCE(MAX(id), 0) + 1 FROM creatures");
        while (reservedIds.contains(candidate) || CreatureIdentityLookupRepository.existsById(conn, candidate)) {
            candidate++;
        }
        reservedIds.add(candidate);
        return candidate;
    }

    private static long queryLong(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("Query returned no rows: " + sql);
            }
            return rs.getLong(1);
        }
    }

    private static String rsGetString(ResultSet rs, String column) throws SQLException {
        return rs.getString(column);
    }
}
