package importer;

import database.DatabaseManager;
import features.creaturecatalog.model.Creature;
import org.jsoup.Jsoup;
import features.creaturecatalog.repository.CreatureRepository;
import features.encountertable.service.EncounterTableRecoveryService;
import features.gamerules.service.RoleClassifier;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * CLI entry point: reads crawled HTML files from data/monsters/ and imports
 * them into the SQLite database via {@link repositories.CreatureRepository}.
 *
 * Run after {@link MonsterCrawler} or via {@code ./crawl.sh}.
 */
public class MonsterImporter {
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public static void main(String[] args) throws Exception {
        // Default crawl output directory — change only if crawl.sh uses a custom output.dir.
        Path dataDir = Paths.get("data/monsters");

        if (!Files.exists(dataDir)) {
            System.err.println("Directory not found: " + dataDir.toAbsolutePath());
            System.err.println("Run MonsterCrawler first (or ./crawl.sh).");
            System.exit(1);
        }

        List<Path> files = Files.walk(dataDir, 1)
                .filter(p -> p.toString().endsWith(".html"))
                .sorted()
                .toList();

        DatabaseManager.setupDatabase();
        EncounterTableRecoveryService.RecoverySession recoverySession =
                EncounterTableRecoveryService.beginRecoverySession();
        System.out.println("Encounter-table backup created: "
                + recoverySession.backupPath().toAbsolutePath());

        List<DriftEvent> driftEvents = new ArrayList<>();
        Set<Long> reservedIds = new HashSet<>();

        BulkImporter.run(files, "monsters",
                path -> path.getFileName().toString(),
                (path, conn) -> {
                    String filename = path.getFileName().toString();
                    String sourceSlug = CrawlerHttpUtils.slugFromFilename(filename);
                    String slugKey = CrawlerHttpUtils.slugKey(sourceSlug);
                    long externalId = CrawlerHttpUtils.extractIdFromFilename(filename);
                    Creature creature = HtmlStatBlockParser.parse(Jsoup.parse(Files.readString(path)));
                    creature.SourceSlug = sourceSlug;
                    creature.SlugKey = slugKey;
                    if (creature.Name == null || creature.Name.isBlank()) {
                        throw new IllegalStateException("No name found");
                    }
                    ImportIdResolution idResolution = resolveImportId(
                            conn, externalId, sourceSlug, slugKey, creature.Name, reservedIds);
                    creature.Id = idResolution.localId();
                    creature.Role = creature.CR != null ? RoleClassifier.classify(creature).name() : null;
                    CreatureRepository.save(creature, conn);
                    upsertAlias(conn, sourceSlug, slugKey, externalId, creature.Id);
                    if (idResolution.driftReason() != null) {
                        driftEvents.add(new DriftEvent(
                                sourceSlug, externalId, creature.Id, creature.Name, idResolution.driftReason()));
                    }
                });

        EncounterTableRecoveryService.RecoverySummary recovery =
                EncounterTableRecoveryService.recover(recoverySession);
        System.out.printf(Locale.ROOT,
                "Encounter recovery: restored=%d unresolved=%d report=%s%n",
                recovery.restoredCount(),
                recovery.unresolvedCount(),
                recovery.reportPath() != null ? recovery.reportPath().toAbsolutePath() : "none");
        Path driftReport = writeDriftReport(driftEvents);
        System.out.printf(Locale.ROOT,
                "ID drift handling: remapped=%d report=%s%n",
                driftEvents.size(),
                driftReport != null ? driftReport.toAbsolutePath() : "none");
    }

    private static ImportIdResolution resolveImportId(
            Connection conn,
            long externalId,
            String sourceSlug,
            String slugKey,
            String name,
            Set<Long> reservedIds) throws SQLException {
        long aliasId = queryLong(conn,
                "SELECT local_id FROM creature_import_aliases WHERE source_slug = ?",
                sourceSlug);
        if (aliasId > 0) return new ImportIdResolution(aliasId, null);

        long sameSource = queryLong(conn,
                "SELECT id FROM creatures WHERE source_slug = ?",
                sourceSlug);
        if (sameSource > 0) return new ImportIdResolution(sameSource, null);

        long sameSlugAndName = uniqueLong(conn,
                "SELECT id FROM creatures WHERE slug_key = ? AND name = ?",
                slugKey, name);
        if (sameSlugAndName > 0) return new ImportIdResolution(sameSlugAndName, null);

        CreatureIdentity existingAtExternal = loadCreatureIdentity(conn, externalId);
        if (existingAtExternal == null) {
            return new ImportIdResolution(externalId, null);
        }

        if (identityCompatible(existingAtExternal, sourceSlug, slugKey, name)) {
            return new ImportIdResolution(externalId, null);
        }

        long reassigned = nextAvailableId(conn, reservedIds);
        String reason = "external-id-conflict existing(id=" + externalId
                + ",name=" + safe(existingAtExternal.name())
                + ",source_slug=" + safe(existingAtExternal.sourceSlug())
                + ",slug_key=" + safe(existingAtExternal.slugKey()) + ")";
        return new ImportIdResolution(reassigned, reason);
    }

    private static boolean identityCompatible(CreatureIdentity existing, String sourceSlug, String slugKey, String name) {
        if (existing == null) return false;
        if (sourceSlug != null && sourceSlug.equals(existing.sourceSlug())) return true;
        if (slugKey != null && slugKey.equals(existing.slugKey()) && name != null && name.equals(existing.name())) return true;
        return name != null && name.equals(existing.name()) && existing.sourceSlug() == null && existing.slugKey() == null;
    }

    private static long nextAvailableId(Connection conn, Set<Long> reservedIds) throws SQLException {
        long candidate = queryLong(conn, "SELECT COALESCE(MAX(id), 0) + 1 FROM creatures");
        while (reservedIds.contains(candidate) || existsById(conn, candidate)) {
            candidate++;
        }
        reservedIds.add(candidate);
        return candidate;
    }

    private static void upsertAlias(
            Connection conn, String sourceSlug, String slugKey, long externalId, long localId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO creature_import_aliases(source_slug, slug_key, external_id, local_id, last_seen_at) "
                        + "VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP) "
                        + "ON CONFLICT(source_slug) DO UPDATE SET "
                        + "slug_key=excluded.slug_key, external_id=excluded.external_id, "
                        + "local_id=excluded.local_id, last_seen_at=CURRENT_TIMESTAMP")) {
            ps.setString(1, sourceSlug);
            ps.setString(2, slugKey);
            ps.setLong(3, externalId);
            ps.setLong(4, localId);
            ps.executeUpdate();
        }
    }

    private static long queryLong(Connection conn, String sql, String arg) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, arg);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return -1;
                long value = rs.getLong(1);
                return rs.wasNull() ? -1 : value;
            }
        }
    }

    private static long queryLong(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) return -1;
            long value = rs.getLong(1);
            return rs.wasNull() ? -1 : value;
        }
    }

    private static long uniqueLong(Connection conn, String sql, String arg1, String arg2) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, arg1);
            ps.setString(2, arg2);
            long found = -1;
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong(1);
                    if (found > 0 && found != id) return -1;
                    found = id;
                }
            }
            return found;
        }
    }

    private static boolean existsById(Connection conn, long id) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM creatures WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static CreatureIdentity loadCreatureIdentity(Connection conn, long id) throws SQLException {
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

    private static Path writeDriftReport(List<DriftEvent> events) throws IOException {
        if (events == null || events.isEmpty()) return null;
        Path dir = Paths.get("data", "backups");
        Files.createDirectories(dir);
        Path out = dir.resolve("creature-id-drift-report-" + LocalDateTime.now().format(TS) + ".txt");
        StringBuilder sb = new StringBuilder();
        sb.append("Remapped creature imports (external ID conflicts):\n");
        for (DriftEvent e : events) {
            sb.append("- source_slug=").append(safe(e.sourceSlug()))
                    .append(" name=").append(safe(e.creatureName()))
                    .append(" external_id=").append(e.externalId())
                    .append(" assigned_local_id=").append(e.assignedLocalId())
                    .append(" reason=").append(safe(e.reason()))
                    .append("\n");
        }
        Files.writeString(out, sb.toString());
        return out;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static String rsGetString(ResultSet rs, String column) {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            throw new IllegalStateException("Missing column in result set: " + column, e);
        }
    }

    private record CreatureIdentity(String name, String sourceSlug, String slugKey) {}
    private record ImportIdResolution(long localId, String driftReason) {}
    private record DriftEvent(String sourceSlug, long externalId, long assignedLocalId, String creatureName, String reason) {}
}
