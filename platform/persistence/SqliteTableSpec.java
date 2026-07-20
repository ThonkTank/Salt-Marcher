package platform.persistence;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public final class SqliteTableSpec {

    private final String name;
    private final List<ColumnSpec> columns;

    public SqliteTableSpec(String name, List<ColumnSpec> columns) {
        this.name = requireIdentifier(name);
        this.columns = List.copyOf(Objects.requireNonNull(columns, "columns"));
    }

    public static SqliteTableSpec table(String name, ColumnSpec... columns) {
        return new SqliteTableSpec(name, Arrays.asList(columns));
    }

    public static ColumnSpec column(String name, String definition) {
        return new ColumnSpec(name, definition);
    }

    public String name() {
        return name;
    }

    public List<ColumnSpec> columns() {
        return columns;
    }

    public String createTableSql() {
        return "CREATE TABLE IF NOT EXISTS " + name + " ("
                + columns.stream().map(ColumnSpec::sql).collect(Collectors.joining(", "))
                + ")";
    }

    private static String requireIdentifier(String value) {
        String identifier = Objects.requireNonNull(value, "identifier");
        if (!identifier.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("invalid SQLite identifier");
        }
        return identifier;
    }

    public record ColumnSpec(String name, String definition) {

        public ColumnSpec {
            name = requireIdentifier(name);
            definition = Objects.requireNonNull(definition, "definition").trim();
            if (definition.isEmpty()) {
                throw new IllegalArgumentException("column definition must not be blank");
            }
        }

        String sql() {
            return name + " " + definition;
        }
    }
}
