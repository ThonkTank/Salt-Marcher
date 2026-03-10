package importer;

import database.DatabaseManager;
import features.creaturecatalog.model.Creature;
import features.creaturecatalog.repository.CreatureImportAliasRepository;
import features.creaturecatalog.repository.CreatureRepository;
import features.creaturecatalog.service.CreatureImportIdentityResolutionService;
import features.encountertable.recovery.service.EncounterTableRecoveryService;
import features.gamerules.service.RoleClassifier;
import org.jsoup.Jsoup;
import shared.crawler.slug.SlugIdentity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Shared monster import pipeline for CLI maintenance tools.
 */
public final class MonsterImportApplicationService {
    public static final Path DEFAULT_MONSTER_DATA_DIR = Path.of("data", "monsters");

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private MonsterImportApplicationService() {
        throw new AssertionError("No instances");
    }

    public record ImportSummary(
            int fileCount,
            Path backupPath,
            CreatureOverridesApplier.ApplySummary overrideSummary,
            EncounterTableRecoveryService.RecoverySummary recoverySummary,
            int driftCount,
            Path driftReportPath
    ) {}

    public static ImportSummary importFromDefaultDirectory() throws Exception {
        return importFromDirectory(DEFAULT_MONSTER_DATA_DIR);
    }

    public static ImportSummary importFromDirectory(Path dataDir) throws Exception {
        if (!Files.exists(dataDir)) {
            throw new IOException("Directory not found: " + dataDir.toAbsolutePath());
        }

        List<Path> files;
        try (Stream<Path> paths = Files.walk(dataDir, 1)) {
            files = paths
                    .filter(path -> path.toString().endsWith(".html"))
                    .sorted()
                    .toList();
        }

        DatabaseManager.setupDatabase();
        EncounterTableRecoveryService.RecoverySession recoverySession =
                EncounterTableRecoveryService.beginRecoverySession();
        System.out.println("Encounter-table backup created: "
                + recoverySession.backupPath().toAbsolutePath());

        List<DriftEvent> driftEvents = new ArrayList<>();
        Set<Long> reservedIds = new HashSet<>();

        BulkImporter.run(files, "monsters",
                path -> path.getFileName().toString(),
                (path, conn) -> importFile(path, conn, reservedIds, driftEvents));

        CreatureOverridesApplier.ApplySummary overrideSummary;
        try (Connection conn = DatabaseManager.getConnection()) {
            overrideSummary = CreatureOverridesApplier.applyFromDefaultFile(conn, true);
            if (overrideSummary.checked() > 0) {
                System.out.printf(Locale.ROOT,
                        "Creature overrides: checked=%d updated=%d missing=%d file=%s%n",
                        overrideSummary.checked(),
                        overrideSummary.updated(),
                        overrideSummary.missing(),
                        CreatureOverridesApplier.DEFAULT_OVERRIDES_PATH);
            }
        }

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

        return new ImportSummary(
                files.size(),
                recoverySession.backupPath(),
                overrideSummary,
                recovery,
                driftEvents.size(),
                driftReport);
    }

    private static void importFile(
            Path path,
            Connection conn,
            Set<Long> reservedIds,
            List<DriftEvent> driftEvents) throws Exception {
        String filename = path.getFileName().toString();
        String sourceSlug = SlugIdentity.slugFromFilename(filename);
        String slugKey = SlugIdentity.slugKey(sourceSlug);
        Long externalId = SlugIdentity.extractIdFromFilename(filename);
        Creature creature = HtmlStatBlockParser.parse(Jsoup.parse(Files.readString(path)));
        creature.SourceSlug = sourceSlug;
        creature.SlugKey = slugKey;
        if (creature.Name == null || creature.Name.isBlank()) {
            throw new IllegalStateException("No name found");
        }
        CreatureImportIdentityResolutionService.ImportIdResolution idResolution =
                CreatureImportIdentityResolutionService.resolveImportId(
                        conn, externalId, sourceSlug, slugKey, creature.Name, reservedIds);
        creature.Id = idResolution.localId();
        creature.Role = creature.CR != null ? RoleClassifier.classify(creature).name() : null;
        CreatureRepository.save(creature, conn);
        CreatureImportAliasRepository.upsertAlias(
                conn, sourceSlug, slugKey, externalId, creature.Id);
        if (idResolution.driftReason() != null) {
            driftEvents.add(new DriftEvent(
                    sourceSlug, externalId, creature.Id, creature.Name, idResolution.driftReason()));
        }
    }

    private static Path writeDriftReport(List<DriftEvent> events) throws IOException {
        if (events == null || events.isEmpty()) return null;
        Path dir = Path.of("data", "backups");
        Files.createDirectories(dir);
        Path out = dir.resolve("creature-id-drift-report-" + LocalDateTime.now().format(TS) + ".txt");
        StringBuilder sb = new StringBuilder();
        sb.append("Remapped creature imports (external ID conflicts):\n");
        for (DriftEvent event : events) {
            sb.append("- source_slug=").append(safe(event.sourceSlug()))
                    .append(" name=").append(safe(event.creatureName()))
                    .append(" external_id=").append(event.externalId())
                    .append(" assigned_local_id=").append(event.assignedLocalId())
                    .append(" reason=").append(safe(event.reason()))
                    .append("\n");
        }
        Files.writeString(out, sb.toString());
        return out;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private record DriftEvent(String sourceSlug, Long externalId, Long assignedLocalId, String creatureName, String reason) {}
}
