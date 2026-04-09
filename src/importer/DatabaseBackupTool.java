package importer;

import database.maintenance.MaintenanceObject;
import database.maintenance.input.BackupDatabaseInput;

public final class DatabaseBackupTool {
    private DatabaseBackupTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        validateArgs(args);
        BackupDatabaseInput.BackupResultInput result = new MaintenanceObject().backupDatabase(
                new BackupDatabaseInput(
                        optionValue(args, "--source="),
                        optionValue(args, "--backup="),
                        true));
        System.out.println("source=" + result.sourcePath());
        System.out.println("backup=" + result.backupPath());
        System.out.println("bytes=" + result.byteCount());
    }

    private static void validateArgs(String[] args) {
        if (args == null) {
            return;
        }
        for (String arg : args) {
            if (arg == null || arg.isBlank()) {
                continue;
            }
            if (arg.startsWith("--source=") || arg.startsWith("--backup=")) {
                continue;
            }
            printUsage();
            System.exit(1);
            return;
        }
    }

    private static String optionValue(String[] args, String prefix) {
        if (args == null) {
            return "";
        }
        for (String arg : args) {
            if (arg != null && arg.startsWith(prefix)) {
                return arg.substring(prefix.length()).trim();
            }
        }
        return "";
    }

    private static void printUsage() {
        System.err.println(
                "Usage: ./gradlew backupDatabase --args='[--source=/path/to/game.db] [--backup=/path/to/backup.sqlite]'");
    }
}
