package src.data.persistencecore.model;

import java.util.List;
import java.util.Objects;

/**
 * Shared SQLite table schema helper for feature persistence declarations.
 */
public final class SqliteTableSpec {

    private final String name;
    private final List<ColumnSpec> columns;

    public SqliteTableSpec(String name, List<ColumnSpec> columns) {
        this.name = Objects.requireNonNull(name, "name");
        this.columns = List.copyOf(columns);
    }

    public static SqliteTableSpec table(String name, ColumnSpec... columns) {
        return new SqliteTableSpec(name, List.of(columns));
    }

    public static ColumnSpec column(String name, String definition) {
        return new ColumnSpec(name, definition);
    }

    public String name() {
        return name;
    }

    public String createTableSql() {
        String joinedColumns = columns.stream()
                .map(column -> column.name() + " " + column.definition())
                .reduce((left, right) -> left + "," + right)
                .orElseThrow();
        return "CREATE TABLE IF NOT EXISTS " + name + " (" + joinedColumns + ")";
    }

    public record ColumnSpec(String name, String definition) {

        public ColumnSpec {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(definition, "definition");
        }
    }
}
