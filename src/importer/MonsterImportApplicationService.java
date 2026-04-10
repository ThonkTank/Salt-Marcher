package importer;

import database.DatabaseManager;
import features.creatures.model.Creature;
import features.creatures.parsing.ParsingObject;
import features.creatures.parsing.input.ParseDocumentInput;
import features.creatures.repository.CreatureRepository;
import features.creatures.repository.identity.CreatureImportAliasRepository;
import features.creatures.application.identity.CreatureImportIdentityService;
import features.encountertable.api.EncounterTableRecoveryService;
import features.partyanalysis.api.CreatureAnalysisMaintenanceService;
import org.jsoup.Jsoup;
import shared.crawler.slug.SlugIdentity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Monster-specific file import plus post-import recovery/override work for CLI
 * pipelines.
 */
@SuppressWarnings("unused")
public final class MonsterImportApplicationService {
    public static final Path DEFAULT_MONSTER_DATA_DIR = Path.of("data", "monsters");

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final ParsingObject PARSING_OBJECT = new ParsingObject();

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

    public static EncounterTableRecoveryService.RecoverySession beginRecoverySession() throws Exception {
        EncounterTableRecoveryService.RecoverySession recoverySession =
                EncounterTableRecoveryService.beginRecoverySession();
        System.out.println("Encounter-table backup created: "
                + recoverySession.backupPath().toAbsolutePath());
        return recoverySession;
    }

    public static void importFile(
            Path path,
            Connection conn,
            Set<Long> reservedIds,
            List<DriftEvent> driftEvents) throws Exception {
        String filename = path.getFileName().toString();
        String sourceSlug = SlugIdentity.slugFromFilename(filename);
        String slugKey = SlugIdentity.slugKey(sourceSlug);
        Long externalId = SlugIdentity.extractIdFromFilename(filename);
        Creature creature = PARSING_OBJECT.parseDocument(
                new ParseDocumentInput(Jsoup.parse(Files.readString(path)))).creature();
        creature.SourceSlug = sourceSlug;
        creature.SlugKey = slugKey;
        if (creature.Name == null || creature.Name.isBlank()) {
            throw new IllegalStateException("No name found");
        }
        CreatureImportIdentityService.ImportIdResolution idResolution =
                CreatureImportIdentityService.resolveImportId(
                        conn, externalId, sourceSlug, slugKey, creature.Name, reservedIds);
        creature.Id = idResolution.localId();
        CreatureRepository.save(creature, conn);
        CreatureAnalysisMaintenanceService.refreshForCreature(conn, creature.Id);
        CreatureImportAliasRepository.upsertAlias(
                conn, sourceSlug, slugKey, externalId, creature.Id);
        if (idResolution.driftReason() != null) {
            driftEvents.add(new DriftEvent(
                    sourceSlug, externalId, creature.Id, creature.Name, idResolution.driftReason()));
        }
    }

    public static ImportSummary completeImport(
            int fileCount,
            EncounterTableRecoveryService.RecoverySession recoverySession,
            List<DriftEvent> driftEvents) throws Exception {
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
                fileCount,
                recoverySession.backupPath(),
                overrideSummary,
                recovery,
                driftEvents.size(),
                driftReport);
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

    public record DriftEvent(String sourceSlug, Long externalId, Long assignedLocalId, String creatureName, String reason) {}
}
