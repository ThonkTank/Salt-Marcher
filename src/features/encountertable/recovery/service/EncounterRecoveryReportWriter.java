package features.encountertable.recovery.service;

import features.encountertable.recovery.model.UnresolvedEntry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public final class EncounterRecoveryReportWriter {
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private EncounterRecoveryReportWriter() {
        throw new AssertionError("No instances");
    }

    public static Path writeRecoveryReport(List<UnresolvedEntry> unresolved) throws IOException {
        Path out = EncounterRecoveryBackupStore.backupDir()
                .resolve("encounter-recovery-report-" + LocalDateTime.now().format(TS) + ".txt");
        StringBuilder sb = new StringBuilder();
        sb.append("Unresolved encounter table entries:\n");
        for (UnresolvedEntry u : unresolved) {
            sb.append("- table_id=").append(u.tableId())
                    .append(" table_name=").append(safe(u.tableName()))
                    .append(" creature_id=").append(u.entry().creatureId())
                    .append(" creature_name=").append(safe(u.entry().creatureName()))
                    .append(" source_slug=").append(safe(u.entry().sourceSlug()))
                    .append(" slug_key=").append(safe(u.entry().slugKey()))
                    .append("\n");
        }
        Files.writeString(out, sb.toString());
        return out;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
