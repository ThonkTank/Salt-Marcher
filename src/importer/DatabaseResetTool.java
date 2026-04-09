package importer;

import database.maintenance.MaintenanceObject;
import database.maintenance.input.ResetDatabaseInput;

public final class DatabaseResetTool {
    private DatabaseResetTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        validateArgs(args);
        ResetDatabaseInput.ResetResultInput result = new MaintenanceObject().resetDatabase(
                new ResetDatabaseInput(
                        targetValue(args),
                        !hasFlag(args, "--no-backup"),
                        optionValue(args, "--backup=")));
        System.out.println("target=" + result.target());
        System.out.println("backup=" + (result.backupPath() == null || result.backupPath().isBlank() ? "-" : result.backupPath()));
        System.out.println("droppedTables=" + result.droppedTables().size());
        for (String table : result.droppedTables()) {
            System.out.println(table);
        }
    }

    private static void validateArgs(String[] args) {
        if (args == null) {
            return;
        }
        for (String arg : args) {
            if (arg == null || arg.isBlank()) {
                continue;
            }
            if (arg.startsWith("--target=") || arg.startsWith("--backup=") || "--no-backup".equals(arg)) {
                continue;
            }
            printUsage();
            System.exit(1);
            return;
        }
    }

    private static String targetValue(String[] args) {
        String target = optionValue(args, "--target=");
        return target.isBlank() ? "dungeon" : target;
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

    private static boolean hasFlag(String[] args, String flag) {
        if (args == null) {
            return false;
        }
        for (String arg : args) {
            if (flag.equals(arg)) {
                return true;
            }
        }
        return false;
    }

    private static void printUsage() {
        System.err.println(
                "Usage: ./gradlew resetDungeonDatabase [--args='[--target=dungeon] [--backup=/path/to/backup.sqlite] [--no-backup]']");
    }
}
