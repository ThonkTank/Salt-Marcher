package platform.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Feature-neutral PRAGMA validation for feature-declared SQLite target signatures. */
public final class SqliteSchemaValidator implements FeatureStoreDefinition.Validator {

    private final Map<String, TableSignature> tables;
    private final List<ForeignKeySignature> foreignKeys;
    private final List<IndexSignature> indexes;

    private SqliteSchemaValidator(
            Map<String, TableSignature> tables,
            List<ForeignKeySignature> foreignKeys,
            List<IndexSignature> indexes
    ) {
        this.tables = Map.copyOf(tables);
        this.foreignKeys = List.copyOf(foreignKeys);
        this.indexes = List.copyOf(indexes);
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public void validate(Connection connection) throws SQLException {
        Connection safeConnection = Objects.requireNonNull(connection, "connection");
        for (TableSignature table : tables.values()) {
            validateTable(safeConnection, table);
        }
        for (ForeignKeySignature foreignKey : foreignKeys) {
            validateForeignKey(safeConnection, foreignKey);
        }
        for (IndexSignature index : indexes) {
            validateIndex(safeConnection, index);
        }
    }

    private static void validateTable(Connection connection, TableSignature expected) throws SQLException {
        List<Column> actual = columns(connection, expected.name());
        if (actual.isEmpty()) {
            throw invalid("required owner table is missing: " + expected.name());
        }
        if (!expected.columns().isEmpty()) {
            Set<String> actualNames = new LinkedHashSet<>();
            actual.forEach(column -> actualNames.add(column.name()));
            Set<String> expectedNames = new LinkedHashSet<>(expected.columns());
            boolean columnsMatch = expected.columnMatch() == ColumnMatch.EXACT
                    ? actualNames.equals(expectedNames)
                    : actualNames.containsAll(expectedNames);
            if (!columnsMatch) {
                if (expected.columnMatch() == ColumnMatch.REQUIRED_SUBSET) {
                    throw invalid("owner table is missing required columns: " + expected.name());
                }
                throw invalid("owner table columns do not match the target signature: " + expected.name());
            }
        }
        if (!expected.primaryKey().isEmpty()) {
            List<String> actualPrimaryKey = actual.stream()
                    .filter(column -> column.primaryKeyPosition() > 0)
                    .sorted(Comparator.comparingInt(Column::primaryKeyPosition))
                    .map(Column::name)
                    .toList();
            if (!actualPrimaryKey.equals(expected.primaryKey())) {
                throw invalid("owner table primary key does not match the target signature: " + expected.name());
            }
        }
    }

    private static void validateForeignKey(Connection connection, ForeignKeySignature expected) throws SQLException {
        List<ForeignKeyRow> rows = foreignKeyRows(connection, expected.table()).stream()
                .filter(row -> row.targetTable().equals(expected.targetTable()))
                .filter(row -> row.onDelete().equalsIgnoreCase(expected.onDelete()))
                .toList();
        Map<Integer, List<ForeignKeyRow>> byId = new LinkedHashMap<>();
        rows.forEach(row -> byId.computeIfAbsent(row.id(), ignored -> new ArrayList<>()).add(row));
        boolean matched = byId.values().stream().anyMatch(group -> {
            List<ForeignKeyColumn> columns = group.stream()
                    .sorted(Comparator.comparingInt(ForeignKeyRow::sequence))
                    .map(row -> new ForeignKeyColumn(row.sourceColumn(), row.targetColumn()))
                    .toList();
            return columns.equals(expected.columns());
        });
        if (!matched) {
            throw invalid("owner table foreign key does not match the target signature: " + expected.table());
        }
    }

    private static void validateIndex(Connection connection, IndexSignature expected) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_list(" + expected.table() + ")")) {
            while (result.next()) {
                if (expected.name().equals(result.getString("name"))) {
                    if ((result.getInt("unique") == 1) != expected.unique()
                            || !indexColumns(connection, expected.name()).equals(expected.columns())) {
                        throw invalid("owner index does not match the target signature: " + expected.name());
                    }
                    return;
                }
            }
        }
        throw invalid("required owner index is missing: " + expected.name());
    }

    private static List<Column> columns(Connection connection, String table) throws SQLException {
        List<Column> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                columns.add(new Column(result.getString("name"), result.getInt("pk")));
            }
        }
        return List.copyOf(columns);
    }

    private static List<ForeignKeyRow> foreignKeyRows(Connection connection, String table) throws SQLException {
        List<ForeignKeyRow> rows = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                rows.add(new ForeignKeyRow(
                        result.getInt("id"),
                        result.getInt("seq"),
                        result.getString("table"),
                        result.getString("from"),
                        result.getString("to"),
                        result.getString("on_delete")));
            }
        }
        return List.copyOf(rows);
    }

    private static List<String> indexColumns(Connection connection, String index) throws SQLException {
        List<IndexColumn> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_info(" + index + ")")) {
            while (result.next()) {
                columns.add(new IndexColumn(result.getInt("seqno"), result.getString("name")));
            }
        }
        columns.sort(Comparator.comparingInt(IndexColumn::position));
        return columns.stream().map(IndexColumn::name).toList();
    }

    private static SQLException invalid(String message) {
        return new SQLException(message);
    }

    public static final class Builder {

        private final Map<String, MutableTable> tables = new LinkedHashMap<>();
        private final List<ForeignKeySignature> foreignKeys = new ArrayList<>();
        private final List<IndexSignature> indexes = new ArrayList<>();

        private Builder() {
        }

        public Builder requiredTable(String name) {
            table(name);
            return this;
        }

        public Builder table(String name, String... columns) {
            return table(name, ColumnMatch.EXACT, columns);
        }

        /** Requires named columns while permitting additional provider-owned columns. */
        public Builder tableContaining(String name, String... requiredColumns) {
            List<String> safeColumns = identifiers(requiredColumns);
            if (safeColumns.isEmpty()) {
                throw new IllegalArgumentException("required owner table columns must not be empty");
            }
            return table(name, ColumnMatch.REQUIRED_SUBSET, safeColumns.toArray(String[]::new));
        }

        public Builder tableContaining(SqliteTableSpec table) {
            SqliteTableSpec safeTable = Objects.requireNonNull(table, "table");
            return tableContaining(safeTable.name(), safeTable.columns().stream()
                    .map(SqliteTableSpec.ColumnSpec::name).toArray(String[]::new));
        }

        private Builder table(String name, ColumnMatch columnMatch, String... columns) {
            String safeName = identifier(name);
            List<String> safeColumns = identifiers(columns);
            MutableTable previous = tables.putIfAbsent(
                    safeName, new MutableTable(safeName, safeColumns, columnMatch));
            if (previous != null
                    && (!previous.columns.equals(safeColumns) || previous.columnMatch != columnMatch)) {
                throw new IllegalArgumentException("conflicting owner table signature");
            }
            return this;
        }

        public Builder table(SqliteTableSpec table) {
            SqliteTableSpec safeTable = Objects.requireNonNull(table, "table");
            return table(safeTable.name(), safeTable.columns().stream()
                    .map(SqliteTableSpec.ColumnSpec::name).toArray(String[]::new));
        }

        public Builder primaryKey(String table, String... columns) {
            MutableTable signature = requireTable(table);
            signature.primaryKey = identifiers(columns);
            return this;
        }

        public Builder foreignKey(
                String table,
                String targetTable,
                String onDelete,
                ForeignKeyColumn... columns
        ) {
            requireTable(table);
            foreignKeys.add(new ForeignKeySignature(
                    identifier(table),
                    identifier(targetTable),
                    Objects.requireNonNull(onDelete, "onDelete").trim().toUpperCase(java.util.Locale.ROOT),
                    List.copyOf(Arrays.asList(columns))));
            return this;
        }

        public Builder index(String name, String table, boolean unique, String... columns) {
            requireTable(table);
            indexes.add(new IndexSignature(
                    identifier(name), identifier(table), unique, identifiers(columns)));
            return this;
        }

        public SqliteSchemaValidator build() {
            Map<String, TableSignature> immutableTables = new LinkedHashMap<>();
            tables.forEach((name, table) -> immutableTables.put(
                    name,
                    new TableSignature(name, table.columns, table.primaryKey, table.columnMatch)));
            return new SqliteSchemaValidator(immutableTables, foreignKeys, indexes);
        }

        private MutableTable requireTable(String table) {
            MutableTable signature = tables.get(identifier(table));
            if (signature == null) {
                throw new IllegalArgumentException("owner table must be declared before its constraints");
            }
            return signature;
        }
    }

    public record ForeignKeyColumn(String source, String target) {
        public ForeignKeyColumn {
            source = identifier(source);
            target = identifier(target);
        }
    }

    public static ForeignKeyColumn reference(String source, String target) {
        return new ForeignKeyColumn(source, target);
    }

    private static String identifier(String value) {
        String identifier = Objects.requireNonNull(value, "identifier");
        if (!identifier.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("invalid SQLite identifier");
        }
        return identifier;
    }

    private static List<String> identifiers(String... values) {
        if (values == null) {
            return List.of();
        }
        return Arrays.stream(values).map(SqliteSchemaValidator::identifier).toList();
    }

    private enum ColumnMatch {
        EXACT,
        REQUIRED_SUBSET
    }

    private record TableSignature(
            String name,
            List<String> columns,
            List<String> primaryKey,
            ColumnMatch columnMatch
    ) {
        private TableSignature {
            columns = List.copyOf(columns);
            primaryKey = List.copyOf(primaryKey);
        }
    }

    private static final class MutableTable {
        private final String name;
        private final List<String> columns;
        private final ColumnMatch columnMatch;
        private List<String> primaryKey = List.of();

        private MutableTable(String name, List<String> columns, ColumnMatch columnMatch) {
            this.name = name;
            this.columns = List.copyOf(columns);
            this.columnMatch = Objects.requireNonNull(columnMatch, "columnMatch");
        }
    }

    private record ForeignKeySignature(
            String table,
            String targetTable,
            String onDelete,
            List<ForeignKeyColumn> columns
    ) {
        private ForeignKeySignature {
            columns = List.copyOf(columns);
        }
    }

    private record IndexSignature(String name, String table, boolean unique, List<String> columns) {
        private IndexSignature {
            columns = List.copyOf(columns);
        }
    }

    private record Column(String name, int primaryKeyPosition) {
    }

    private record ForeignKeyRow(
            int id,
            int sequence,
            String targetTable,
            String sourceColumn,
            String targetColumn,
            String onDelete
    ) {
    }

    private record IndexColumn(int position, String name) {
    }
}
