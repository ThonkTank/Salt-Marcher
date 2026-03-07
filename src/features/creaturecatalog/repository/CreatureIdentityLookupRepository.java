package features.creaturecatalog.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Shared creature identity lookups used by import and recovery flows.
 */
public final class CreatureIdentityLookupRepository {
    private CreatureIdentityLookupRepository() {
        throw new AssertionError("No instances");
    }

    public static boolean existsById(Connection conn, long id) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM creatures WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static long findUniqueBySourceSlug(Connection conn, String sourceSlug) throws SQLException {
        return uniqueId(conn, "SELECT id FROM creatures WHERE source_slug = ?", sourceSlug);
    }

    public static long findUniqueBySlugAndName(Connection conn, String slugKey, String name) throws SQLException {
        return uniqueId(conn, "SELECT id FROM creatures WHERE slug_key = ? AND name = ?", slugKey, name);
    }

    public static long findUniqueByName(Connection conn, String name) throws SQLException {
        return uniqueId(conn, "SELECT id FROM creatures WHERE name = ?", name);
    }

    private static long uniqueId(Connection conn, String sql, String... args) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (String arg : args) {
                ps.setString(idx++, arg);
            }
            long found = -1;
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong(1);
                    if (found > 0 && found != id) {
                        return -1;
                    }
                    found = id;
                }
            }
            return found;
        }
    }
}
