package features.creaturecatalog.service;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CreatureImportIdentityResolutionServiceTest {

    @Test
    void resolveImportIdUsesAliasFirst() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 7L, "Goblin", "16907-goblin", "goblin");
            insertAlias(conn, "16907-goblin", "goblin", 16907L, 7L);

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, 16907L, "16907-goblin", "goblin", "Goblin", new HashSet<>());

            assertEquals(7L, result.localId());
            assertNull(result.driftReason());
        }
    }

    @Test
    void resolveImportIdFallsBackToSourceSlugIdentity() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 3L, "Orc", "104-orc", "orc");

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, 104L, "104-orc", "orc", "Orc", new HashSet<>());

            assertEquals(3L, result.localId());
            assertNull(result.driftReason());
        }
    }

    @Test
    void resolveImportIdFallsBackToSlugAndNameIdentity() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 5L, "Young Dragon", null, "young-dragon");

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, 999L, "999-young-dragon", "young-dragon", "Young Dragon", new HashSet<>());

            assertEquals(5L, result.localId());
            assertNull(result.driftReason());
        }
    }

    @Test
    void resolveImportIdKeepsCompatibleExternalId() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 10L, "Hydra", null, null);

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, 10L, "123-hydra", "hydra", "Hydra", new HashSet<>());

            assertEquals(10L, result.localId());
            assertNull(result.driftReason());
        }
    }

    @Test
    void resolveImportIdRemapsConflictingExternalId() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 10L, "Orc", "104-orc", "orc");
            insertCreature(conn, 11L, "Bandit", "bandit", "bandit");
            Set<Long> reservedIds = new HashSet<>();

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, 10L, "16907-goblin", "goblin", "Goblin", reservedIds);

            assertEquals(12L, result.localId());
            assertNotNull(result.driftReason());
            assertTrue(result.driftReason().startsWith("external-id-conflict"));
            assertTrue(reservedIds.contains(12L));
        }
    }

    @Test
    void resolveImportIdAssignsNextIdWhenExternalIdMissing() throws Exception {
        try (Connection conn = openInMemoryConnection()) {
            insertCreature(conn, 10L, "Orc", "104-orc", "orc");

            var result = CreatureImportIdentityResolutionService.resolveImportId(
                    conn, null, "new-goblin", "goblin", "Goblin", new HashSet<>());

            assertEquals(11L, result.localId());
            assertEquals("missing-external-id", result.driftReason());
        }
    }

    private static Connection openInMemoryConnection() throws Exception {
        Connection conn = DriverManager.getConnection("jdbc:sqlite::memory:");
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE creatures ("
                    + "id INTEGER PRIMARY KEY,"
                    + "name TEXT,"
                    + "source_slug TEXT,"
                    + "slug_key TEXT"
                    + ")");
            stmt.execute("CREATE TABLE creature_import_aliases ("
                    + "source_slug TEXT PRIMARY KEY,"
                    + "slug_key TEXT,"
                    + "external_id INTEGER,"
                    + "local_id INTEGER NOT NULL"
                    + ")");
        }
        return conn;
    }

    private static void insertCreature(
            Connection conn,
            Long id,
            String name,
            String sourceSlug,
            String slugKey) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO creatures(id, name, source_slug, slug_key) VALUES(?, ?, ?, ?)")) {
            ps.setLong(1, id);
            ps.setString(2, name);
            ps.setString(3, sourceSlug);
            ps.setString(4, slugKey);
            ps.executeUpdate();
        }
    }

    private static void insertAlias(
            Connection conn,
            String sourceSlug,
            String slugKey,
            Long externalId,
            Long localId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO creature_import_aliases(source_slug, slug_key, external_id, local_id) VALUES(?, ?, ?, ?)")) {
            ps.setString(1, sourceSlug);
            ps.setString(2, slugKey);
            ps.setLong(3, externalId);
            ps.setLong(4, localId);
            ps.executeUpdate();
        }
    }
}
