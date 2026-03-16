package importer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Small JDBC-backed SQLite inspector for environments without a system sqlite3 binary.
 */
public final class SqliteQueryTool {
    private SqliteQueryTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        if (args == null || args.length < 2) {
            printUsage();
            System.exit(1);
            return;
        }

        String dbPath = args[0];
        List<String> commands = collectCommands(args);
        if (commands.isEmpty()) {
            printUsage();
            System.exit(1);
            return;
        }

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbPath)) {
            for (int i = 0; i < commands.size(); i++) {
                String command = commands.get(i);
                if (i > 0) {
                    System.out.println();
                }
                System.out.println("==> " + command);
                executeCommand(conn, command);
            }
        }
    }

    private static List<String> collectCommands(String[] args) {
        List<String> commands = new ArrayList<>();
        for (int i = 1; i < args.length; i++) {
            commands.addAll(splitCommands(args[i]));
        }
        return commands;
    }

    private static List<String> splitCommands(String value) {
        List<String> commands = new ArrayList<>();
        if (value == null || value.isBlank()) {
            return commands;
        }

        StringBuilder current = new StringBuilder();
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\'' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (c == '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            }

            if (c == ';' && !inSingleQuote && !inDoubleQuote) {
                addCommand(commands, current);
                current.setLength(0);
                continue;
            }
            current.append(c);
        }
        addCommand(commands, current);
        return commands;
    }

    private static void addCommand(List<String> commands, StringBuilder current) {
        String command = current.toString().trim();
        if (!command.isEmpty()) {
            commands.add(command);
        }
    }

    private static void executeCommand(Connection conn, String command) throws Exception {
        if (".tables".equals(command)) {
            printTables(conn);
            return;
        }

        try (Statement stmt = conn.createStatement()) {
            boolean hasResultSet = stmt.execute(command);
            if (!hasResultSet) {
                System.out.println("OK rowsUpdated=" + stmt.getUpdateCount());
                return;
            }
            try (ResultSet rs = stmt.getResultSet()) {
                printResultSet(rs);
            }
        }
    }

    private static void printTables(Connection conn) throws Exception {
        String sql = """
                select name
                from sqlite_master
                where type in ('table', 'view')
                  and name not like 'sqlite_%'
                order by name
                """;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                System.out.println(rs.getString(1));
            }
        }
    }

    private static void printResultSet(ResultSet rs) throws Exception {
        ResultSetMetaData meta = rs.getMetaData();
        int columnCount = meta.getColumnCount();

        StringBuilder header = new StringBuilder();
        for (int i = 1; i <= columnCount; i++) {
            if (i > 1) {
                header.append('\t');
            }
            header.append(meta.getColumnLabel(i));
        }
        System.out.println(header);

        while (rs.next()) {
            StringBuilder row = new StringBuilder();
            for (int i = 1; i <= columnCount; i++) {
                if (i > 1) {
                    row.append('\t');
                }
                Object value = rs.getObject(i);
                row.append(value == null ? "NULL" : value);
            }
            System.out.println(row);
        }
    }

    private static void printUsage() {
        System.err.println(
                "Usage: ./gradlew sqliteQuery --args='<db-path> <command> [<command>...]'\n" +
                "Examples:\n" +
                "  ./gradlew sqliteQuery --args='data/game.db .tables'\n" +
                "  ./gradlew sqliteQuery --args='data/game.db \"select dungeon_map_id, name from dungeon_maps order by dungeon_map_id\"'\n" +
                "  ./gradlew sqliteQuery --args='data/game.db \"select 1; select 2\"'");
    }
}
