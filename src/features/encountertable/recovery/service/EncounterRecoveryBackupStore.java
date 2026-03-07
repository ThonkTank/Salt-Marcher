package features.encountertable.recovery.service;

import features.encountertable.recovery.model.TableSnapshot;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

public final class EncounterRecoveryBackupStore {
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final Path BACKUP_DIR = Paths.get("data", "backups");

    private EncounterRecoveryBackupStore() {
        throw new AssertionError("No instances");
    }

    public static Path writeEncounterBackup(List<TableSnapshot> snapshot) throws IOException {
        LocalDateTime generatedAt = LocalDateTime.now();
        Path out = backupDir().resolve("encounter-tables-" + generatedAt.format(TS) + ".json");
        String content = EncounterRecoveryBackupCodec.encode(generatedAt, snapshot);
        Files.writeString(out, content);
        return out;
    }

    public static List<TableSnapshot> readEncounterBackup(Path backupPath) throws IOException {
        Objects.requireNonNull(backupPath, "backupPath");
        String content = Files.readString(backupPath);
        return EncounterRecoveryBackupCodec.decode(content);
    }

    static Path backupDir() throws IOException {
        Files.createDirectories(BACKUP_DIR);
        return BACKUP_DIR;
    }
}
