package importer;

import database.maintenance.MaintenanceObject;
import database.maintenance.input.InspectDatabaseInput;

public final class DatabaseInspectTool {
    private DatabaseInspectTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        validateArgs(args);
        InspectDatabaseInput.InspectResultInput result = new MaintenanceObject().inspectDatabase(
                new InspectDatabaseInput(
                        optionValue(args, "--db="),
                        !hasFlag(args, "--no-counts")));
        System.out.println("db=" + result.databasePath());
        System.out.println("exists=" + result.exists());
        System.out.println("bytes=" + result.byteSize());
        System.out.println("tables=" + result.tables().size());
        for (String table : result.tables()) {
            System.out.println(table);
        }
        if (!result.tableCounts().isEmpty()) {
            System.out.println();
            for (String tableCount : result.tableCounts()) {
                System.out.println(tableCount);
            }
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
            if (arg.startsWith("--db=") || "--no-counts".equals(arg)) {
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
                "Usage: ./gradlew inspectDatabase --args='[--db=/path/to/game.db] [--no-counts]'");
    }
}
