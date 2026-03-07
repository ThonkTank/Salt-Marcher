package features.creaturecatalog.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Objects;

/**
 * Data access for stable source-slug to local-creature alias mapping used by import.
 */
public final class CreatureImportAliasRepository {
    private CreatureImportAliasRepository() {
        throw new AssertionError("No instances");
    }

    public static Long findLocalIdBySourceSlug(Connection conn, String sourceSlug) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT local_id FROM creature_import_aliases WHERE source_slug = ?")) {
            ps.setString(1, sourceSlug);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                long value = rs.getLong(1);
                return rs.wasNull() ? null : value;
            }
        }
    }

    public static void upsertAlias(
            Connection conn,
            String sourceSlug,
            String slugKey,
            Long externalId,
            Long localId) throws SQLException {
        Objects.requireNonNull(localId, "localId");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO creature_import_aliases(source_slug, slug_key, external_id, local_id, last_seen_at) "
                        + "VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP) "
                        + "ON CONFLICT(source_slug) DO UPDATE SET "
                        + "slug_key=excluded.slug_key, external_id=excluded.external_id, "
                        + "local_id=excluded.local_id, last_seen_at=CURRENT_TIMESTAMP")) {
            ps.setString(1, sourceSlug);
            ps.setString(2, slugKey);
            setNullableLong(ps, 3, externalId);
            ps.setLong(4, localId);
            ps.executeUpdate();
        }
    }

    private static void setNullableLong(PreparedStatement ps, int index, Long value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.BIGINT);
            return;
        }
        ps.setLong(index, value);
    }
}
