package platform.persistence;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Feature-neutral PRAGMA validation for feature-declared SQLite target signatures. */
public final class SqliteSchemaValidator implements FeatureStoreDefinition.Validator {

    private final Map<String, TableSignature> tables;
    private final List<ForeignKeySignature> foreignKeys;
    private final List<IndexSignature> indexes;
    private final ExactSchema exactSchema;

    private SqliteSchemaValidator(
            Map<String, TableSignature> tables,
            List<ForeignKeySignature> foreignKeys,
            List<IndexSignature> indexes,
            ExactSchema exactSchema
    ) {
        this.tables = Map.copyOf(tables);
        this.foreignKeys = List.copyOf(foreignKeys);
        this.indexes = List.copyOf(indexes);
        this.exactSchema = exactSchema;
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Validates an owner schema against the schema SQLite itself derives from the canonical DDL.
     * The reference schema lives in a separate in-memory database, so validation cannot repair or
     * otherwise mutate the target connection.
     */
    public static SqliteSchemaValidator exactSchema(
            List<String> createTableSql,
            List<String> createIndexSql
    ) {
        ExactSchema exact = new ExactSchema(createTableSql, createIndexSql, List.of(), List.of());
        return new SqliteSchemaValidator(Map.of(), List.of(), List.of(), exact);
    }

    /**
     * Adds an exact inventory boundary for owner objects. Every table, index, view, or trigger
     * whose name starts with an owned prefix or equals a forbidden development name must be in the
     * canonical DDL inventory. This rejects adjacent partial or retired shapes at recorded v1.
     */
    public static SqliteSchemaValidator exactSchema(
            List<String> createTableSql,
            List<String> createIndexSql,
            List<String> ownedObjectPrefixes,
            List<String> forbiddenObjectNames
    ) {
        ExactSchema exact = new ExactSchema(
                createTableSql, createIndexSql, ownedObjectPrefixes, forbiddenObjectNames);
        return new SqliteSchemaValidator(Map.of(), List.of(), List.of(), exact);
    }

    @Override
    public void validate(Connection connection) throws SQLException {
        Connection safeConnection = Objects.requireNonNull(connection, "connection");
        if (exactSchema != null) {
            validateExactSchema(safeConnection, exactSchema);
            return;
        }
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

    private static void validateExactSchema(Connection target, ExactSchema exact) throws SQLException {
        try (Connection reference = DriverManager.getConnection("jdbc:sqlite::memory:")) {
            try (Statement statement = reference.createStatement()) {
                statement.execute("PRAGMA foreign_keys = ON");
                for (String sql : exact.createTableSql()) {
                    statement.execute(sql);
                }
                for (String sql : exact.createIndexSql()) {
                    statement.execute(sql);
                }
            }
            for (String table : userTables(reference)) {
                compareTable(reference, target, table);
            }
            compareOwnerInventory(reference, target, exact);
        }
    }

    private static void compareOwnerInventory(
            Connection reference,
            Connection target,
            ExactSchema exact
    ) throws SQLException {
        Set<String> canonicalOwnerTables = Set.copyOf(userTables(reference));
        List<SchemaObject> expected = boundSchemaObjects(reference, exact, canonicalOwnerTables);
        List<SchemaObject> actual = boundSchemaObjects(target, exact, canonicalOwnerTables);
        if (!actual.equals(expected)) {
            throw invalid("owner schema object inventory does not match the current target"
                    + " (expected " + expected + ", found " + actual + ")");
        }
    }

    private static List<SchemaObject> boundSchemaObjects(
            Connection connection,
            ExactSchema exact,
            Set<String> canonicalOwnerTables
    ) throws SQLException {
        Set<String> normalizedOwnerTables = canonicalOwnerTables.stream()
                .map(name -> name.toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        List<SchemaObject> bound = new ArrayList<>();
        for (SchemaObject object : schemaObjects(connection)) {
            if (exact.ownsDirectly(object, normalizedOwnerTables)
                    || isInboundForeignKeyTable(
                            connection, object, normalizedOwnerTables)
                    || isSqlDependentObject(
                            connection, object, normalizedOwnerTables)) {
                bound.add(object);
            }
        }
        return List.copyOf(bound);
    }

    private static boolean isInboundForeignKeyTable(
            Connection connection,
            SchemaObject object,
            Set<String> canonicalOwnerTables
    ) throws SQLException {
        if (!"table".equals(object.type())
                || canonicalOwnerTables.contains(object.name().toLowerCase(Locale.ROOT))) {
            return false;
        }
        try (var statement = connection.prepareStatement(
                "SELECT \"table\" FROM pragma_foreign_key_list(?)")) {
            statement.setString(1, object.name());
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String target = Objects.requireNonNullElse(rows.getString(1), "")
                            .toLowerCase(Locale.ROOT);
                    if (canonicalOwnerTables.contains(target)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static boolean isSqlDependentObject(
            Connection connection,
            SchemaObject object,
            Set<String> canonicalOwnerTables
    ) throws SQLException {
        if (!"view".equals(object.type()) && !"trigger".equals(object.type())) {
            return false;
        }
        return sqlReferencesAny(
                schemaObjectSql(connection, object.type(), object.name()),
                canonicalOwnerTables);
    }

    /**
     * Finds identifiers in stored DDL without treating string literals or comments as
     * dependencies. Exact validation is intentionally fail-closed: a view or trigger that names
     * an owner table is part of that owner's manifest even when the object itself has an unrelated
     * name and SQLite records a different {@code tbl_name}.
     */
    private static boolean sqlReferencesAny(String sql, Set<String> canonicalOwnerTables) {
        int cursor = 0;
        while (cursor < sql.length()) {
            char current = sql.charAt(cursor);
            if (current == '-' && cursor + 1 < sql.length() && sql.charAt(cursor + 1) == '-') {
                cursor += 2;
                while (cursor < sql.length() && sql.charAt(cursor) != '\n') {
                    cursor++;
                }
                continue;
            }
            if (current == '/' && cursor + 1 < sql.length() && sql.charAt(cursor + 1) == '*') {
                int close = sql.indexOf("*/", cursor + 2);
                cursor = close < 0 ? sql.length() : close + 2;
                continue;
            }
            if (current == '\'') {
                int end = quotedEnd(sql, cursor + 1, '\'', '\'');
                String identifier = unescapeQuoted(sql.substring(cursor + 1, end), '\'');
                /*
                 * SQLite accepts single-quoted identifiers in identifier-only contexts (for
                 * example FROM 'table_name'). Treat an owner-table spelling as a dependency even
                 * when the token could also be a string literal. The inventory boundary is
                 * deliberately fail-closed; a false negative would let a foreign view or trigger
                 * depend on owner truth without entering the exact manifest.
                 */
                if (canonicalOwnerTables.contains(identifier.toLowerCase(Locale.ROOT))) {
                    return true;
                }
                cursor = Math.min(end + 1, sql.length());
                continue;
            }
            if (current == '"' || current == '`') {
                int end = quotedEnd(sql, cursor + 1, current, current);
                String identifier = unescapeQuoted(sql.substring(cursor + 1, end), current);
                if (canonicalOwnerTables.contains(identifier.toLowerCase(Locale.ROOT))) {
                    return true;
                }
                cursor = Math.min(end + 1, sql.length());
                continue;
            }
            if (current == '[') {
                int end = quotedEnd(sql, cursor + 1, ']', ']');
                String identifier = sql.substring(cursor + 1, end).replace("]]", "]");
                if (canonicalOwnerTables.contains(identifier.toLowerCase(Locale.ROOT))) {
                    return true;
                }
                cursor = Math.min(end + 1, sql.length());
                continue;
            }
            if (Character.isLetter(current) || current == '_') {
                int end = cursor + 1;
                while (end < sql.length()
                        && (Character.isLetterOrDigit(sql.charAt(end))
                                || sql.charAt(end) == '_'
                                || sql.charAt(end) == '$')) {
                    end++;
                }
                if (canonicalOwnerTables.contains(
                        sql.substring(cursor, end).toLowerCase(Locale.ROOT))) {
                    return true;
                }
                cursor = end;
                continue;
            }
            cursor++;
        }
        return false;
    }

    private static int quotedEnd(String sql, int start, char closing, char escaped) {
        int cursor = start;
        while (cursor < sql.length()) {
            if (sql.charAt(cursor) == closing) {
                if (cursor + 1 < sql.length() && sql.charAt(cursor + 1) == escaped) {
                    cursor += 2;
                    continue;
                }
                return cursor;
            }
            cursor++;
        }
        return sql.length();
    }

    private static String unescapeQuoted(String value, char quote) {
        String doubled = String.valueOf(quote) + quote;
        return value.replace(doubled, String.valueOf(quote));
    }

    private static List<SchemaObject> schemaObjects(Connection connection) throws SQLException {
        List<SchemaObject> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                     "SELECT type, name, tbl_name FROM sqlite_master "
                             + "WHERE type IN ('table','index','view','trigger') "
                             + "AND name NOT LIKE 'sqlite_%' ORDER BY type, name")) {
            while (rows.next()) {
                result.add(new SchemaObject(
                        rows.getString("type"), rows.getString("name"), rows.getString("tbl_name")));
            }
        }
        return List.copyOf(result);
    }

    private static void compareTable(Connection reference, Connection target, String table) throws SQLException {
        List<ExactColumn> expectedColumns = exactColumns(reference, table);
        List<ExactColumn> actualColumns = exactColumns(target, table);
        if (actualColumns.isEmpty()) {
            throw invalid("required owner table is missing: " + table);
        }
        if (!actualColumns.equals(expectedColumns)) {
            throw invalid("owner table column definitions do not match the current target: " + table
                    + " (expected " + expectedColumns + ", found " + actualColumns + ")");
        }

        List<ExactForeignKey> expectedForeignKeys = exactForeignKeys(reference, table);
        List<ExactForeignKey> actualForeignKeys = exactForeignKeys(target, table);
        if (!actualForeignKeys.equals(expectedForeignKeys)) {
            throw invalid("owner table foreign keys do not match the current target: " + table
                    + " (expected " + expectedForeignKeys + ", found " + actualForeignKeys + ")");
        }

        List<ExactIndex> expectedIndexes = exactIndexes(reference, table);
        List<ExactIndex> actualIndexes = exactIndexes(target, table);
        if (!actualIndexes.equals(expectedIndexes)) {
            throw invalid("owner table indexes and unique constraints do not match the current target: " + table
                    + " (expected " + expectedIndexes + ", found " + actualIndexes + ")");
        }

        List<String> expectedChecks = checkExpressions(tableSql(reference, table));
        List<String> actualChecks = checkExpressions(tableSql(target, table));
        if (!actualChecks.equals(expectedChecks)) {
            throw invalid("owner table CHECK constraints do not match the current target: " + table
                    + " (expected " + expectedChecks + ", found " + actualChecks + ")");
        }

        TableFlags expectedFlags = tableFlags(reference, table);
        TableFlags actualFlags = tableFlags(target, table);
        if (!actualFlags.equals(expectedFlags)) {
            throw invalid("owner table flags do not match the current target: " + table);
        }

        String expectedDdl = normalizeDdl(tableSql(reference, table));
        String actualDdl = normalizeDdl(tableSql(target, table));
        if (!actualDdl.equals(expectedDdl)) {
            throw invalid("owner table DDL does not match the current target: " + table);
        }

        for (String index : namedIndexes(reference, table)) {
            String expectedIndexDdl = normalizeDdl(schemaObjectSql(reference, "index", index));
            String actualIndexDdl = normalizeDdl(schemaObjectSql(target, "index", index));
            if (!actualIndexDdl.equals(expectedIndexDdl)) {
                throw invalid("owner index DDL does not match the current target: " + index);
            }
        }
    }

    private static List<String> namedIndexes(Connection connection, String table) throws SQLException {
        List<String> indexes = new ArrayList<>();
        try (var statement = connection.prepareStatement(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? "
                        + "AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
            statement.setString(1, table);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    indexes.add(identifier(rows.getString(1)));
                }
            }
        }
        return List.copyOf(indexes);
    }

    private static String schemaObjectSql(
            Connection connection,
            String type,
            String name
    ) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT sql FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Objects.requireNonNullElse(result.getString(1), "") : "";
            }
        }
    }

    private static List<String> userTables(Connection connection) throws SQLException {
        List<String> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                     "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
            while (rows.next()) {
                result.add(identifier(rows.getString(1)));
            }
        }
        return List.copyOf(result);
    }

    private static List<ExactColumn> exactColumns(Connection connection, String table) throws SQLException {
        List<ExactColumn> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA table_xinfo(" + identifier(table) + ")")) {
            while (rows.next()) {
                result.add(new ExactColumn(
                        rows.getString("name"),
                        normalizeType(rows.getString("type")),
                        rows.getInt("notnull") == 1,
                        normalizeDefault(rows.getString("dflt_value")),
                        rows.getInt("pk"),
                        rows.getInt("hidden")));
            }
        }
        return List.copyOf(result);
    }

    private static List<ExactForeignKey> exactForeignKeys(Connection connection, String table) throws SQLException {
        Map<Integer, MutableExactForeignKey> grouped = new LinkedHashMap<>();
        try (Statement statement = connection.createStatement();
            ResultSet rows = statement.executeQuery("PRAGMA foreign_key_list(" + identifier(table) + ")")) {
            while (rows.next()) {
                int id = rows.getInt("id");
                MutableExactForeignKey foreignKey = grouped.get(id);
                if (foreignKey == null) {
                    foreignKey = new MutableExactForeignKey(
                            normalizeKeyword(rows.getString("table")),
                            normalizeKeyword(rows.getString("on_update")),
                            normalizeKeyword(rows.getString("on_delete")),
                            normalizeKeyword(rows.getString("match")));
                    grouped.put(id, foreignKey);
                }
                foreignKey.columns.add(new SequencedForeignKeyColumn(
                        rows.getInt("seq"), rows.getString("from"), rows.getString("to")));
            }
        }
        return grouped.values().stream()
                .map(MutableExactForeignKey::freeze)
                .sorted(Comparator.comparing(ExactForeignKey::sortKey))
                .toList();
    }

    private static List<ExactIndex> exactIndexes(Connection connection, String table) throws SQLException {
        List<ExactIndex> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA index_list(" + identifier(table) + ")")) {
            while (rows.next()) {
                String name = rows.getString("name");
                String origin = rows.getString("origin");
                result.add(new ExactIndex(
                        "c".equals(origin) ? name : null,
                        rows.getInt("unique") == 1,
                        origin,
                        rows.getInt("partial") == 1,
                        exactIndexColumns(connection, name)));
            }
        }
        result.sort(Comparator.comparing(ExactIndex::sortKey));
        return List.copyOf(result);
    }

    private static List<ExactIndexColumn> exactIndexColumns(Connection connection, String index) throws SQLException {
        List<ExactIndexColumn> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA index_xinfo(" + identifier(index) + ")")) {
            while (rows.next()) {
                result.add(new ExactIndexColumn(
                        rows.getInt("seqno"),
                        rows.getInt("cid"),
                        rows.getString("name"),
                        rows.getInt("desc") == 1,
                        rows.getString("coll"),
                        rows.getInt("key") == 1));
            }
        }
        result.sort(Comparator.comparingInt(ExactIndexColumn::sequence));
        return List.copyOf(result);
    }

    private static String tableSql(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Objects.requireNonNullElse(result.getString(1), "") : "";
            }
        }
    }

    private static TableFlags tableFlags(Connection connection, String table) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA table_list")) {
            while (rows.next()) {
                if (table.equals(rows.getString("name")) && "main".equals(rows.getString("schema"))) {
                    return new TableFlags(rows.getInt("wr") == 1, rows.getInt("strict") == 1);
                }
            }
        }
        throw invalid("required owner table is missing: " + table);
    }

    private static List<String> checkExpressions(String sql) throws SQLException {
        List<String> checks = new ArrayList<>();
        int cursor = 0;
        while (cursor < sql.length()) {
            int check = nextKeyword(sql, "CHECK", cursor);
            if (check < 0) {
                break;
            }
            int open = skipWhitespace(sql, check + "CHECK".length());
            if (open >= sql.length() || sql.charAt(open) != '(') {
                throw invalid("cannot inspect malformed CHECK constraint");
            }
            int close = matchingParenthesis(sql, open);
            checks.add(normalizeExpression(sql.substring(open + 1, close)));
            cursor = close + 1;
        }
        checks.sort(String::compareTo);
        return List.copyOf(checks);
    }

    private static int nextKeyword(String sql, String keyword, int start) {
        char quote = 0;
        for (int index = start; index <= sql.length() - keyword.length(); index++) {
            char current = sql.charAt(index);
            if (quote != 0) {
                if (current == quote) {
                    if (index + 1 < sql.length() && sql.charAt(index + 1) == quote) {
                        index++;
                    } else {
                        quote = 0;
                    }
                }
                continue;
            }
            if (current == '\'' || current == '"') {
                quote = current;
                continue;
            }
            if (sql.regionMatches(true, index, keyword, 0, keyword.length())
                    && (index == 0 || !isIdentifierPart(sql.charAt(index - 1)))
                    && (index + keyword.length() == sql.length()
                    || !isIdentifierPart(sql.charAt(index + keyword.length())))) {
                return index;
            }
        }
        return -1;
    }

    private static int matchingParenthesis(String sql, int open) throws SQLException {
        int depth = 0;
        char quote = 0;
        for (int index = open; index < sql.length(); index++) {
            char current = sql.charAt(index);
            if (quote != 0) {
                if (current == quote) {
                    if (index + 1 < sql.length() && sql.charAt(index + 1) == quote) {
                        index++;
                    } else {
                        quote = 0;
                    }
                }
                continue;
            }
            if (current == '\'' || current == '"') {
                quote = current;
            } else if (current == '(') {
                depth++;
            } else if (current == ')' && --depth == 0) {
                return index;
            }
        }
        throw invalid("cannot inspect unterminated CHECK constraint");
    }

    private static String normalizeExpression(String value) {
        StringBuilder normalized = new StringBuilder();
        boolean pendingSpace = false;
        char quote = 0;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (quote != 0) {
                normalized.append(current);
                if (current == quote) {
                    if (index + 1 < value.length() && value.charAt(index + 1) == quote) {
                        normalized.append(value.charAt(++index));
                    } else {
                        quote = 0;
                    }
                }
            } else if (current == '\'' || current == '"') {
                if (pendingSpace && !normalized.isEmpty()) {
                    normalized.append(' ');
                }
                pendingSpace = false;
                quote = current;
                normalized.append(current);
            } else if (Character.isWhitespace(current)) {
                pendingSpace = true;
            } else {
                if (pendingSpace && !normalized.isEmpty()) {
                    normalized.append(' ');
                }
                pendingSpace = false;
                normalized.append(Character.toUpperCase(current));
            }
        }
        return normalized.toString().trim();
    }

    /**
     * Normalizes layout and keyword case while preserving every quoted token and every unquoted
     * SQLite grammar token. Comparing this complete sqlite_master form catches schema semantics
     * that the PRAGMA projections omit, including conflict clauses, deferred foreign keys,
     * collations, and partial-index predicates.
     */
    private static String normalizeDdl(String value) {
        StringBuilder normalized = new StringBuilder();
        boolean pendingSpace = false;
        char quote = 0;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (quote != 0) {
                normalized.append(current);
                if (current == quote) {
                    if (index + 1 < value.length() && value.charAt(index + 1) == quote) {
                        normalized.append(value.charAt(++index));
                    } else {
                        quote = 0;
                    }
                }
                continue;
            }
            if (current == '\'' || current == '"' || current == '`') {
                appendDdlSpaceIfNeeded(normalized, pendingSpace, current);
                pendingSpace = false;
                quote = current;
                normalized.append(current);
            } else if (current == '[') {
                appendDdlSpaceIfNeeded(normalized, pendingSpace, current);
                pendingSpace = false;
                quote = ']';
                normalized.append(current);
            } else if (Character.isWhitespace(current)) {
                pendingSpace = true;
            } else {
                appendDdlSpaceIfNeeded(normalized, pendingSpace, current);
                pendingSpace = false;
                normalized.append(Character.toUpperCase(current));
            }
        }
        return normalized.toString().trim();
    }

    private static void appendDdlSpaceIfNeeded(
            StringBuilder normalized,
            boolean pendingSpace,
            char next
    ) {
        if (pendingSpace && !normalized.isEmpty()
                && isDdlWordPart(normalized.charAt(normalized.length() - 1))
                && isDdlWordPart(next)) {
            normalized.append(' ');
        }
    }

    private static boolean isDdlWordPart(char value) {
        return Character.isLetterOrDigit(value) || value == '_' || value == '$'
                || value == '\'' || value == '"' || value == '`' || value == ']' || value == '[';
    }

    private static int skipWhitespace(String value, int start) {
        int cursor = start;
        while (cursor < value.length() && Character.isWhitespace(value.charAt(cursor))) {
            cursor++;
        }
        return cursor;
    }

    private static boolean isIdentifierPart(char value) {
        return Character.isLetterOrDigit(value) || value == '_';
    }

    private static String normalizeType(String value) {
        return Objects.requireNonNullElse(value, "").trim().replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
    }

    private static String normalizeDefault(String value) {
        return value == null ? null : normalizeExpression(value);
    }

    private static String normalizeKeyword(String value) {
        return Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT);
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
            return new SqliteSchemaValidator(immutableTables, foreignKeys, indexes, null);
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

    private record ExactSchema(
            List<String> createTableSql,
            List<String> createIndexSql,
            List<String> ownedObjectPrefixes,
            List<String> forbiddenObjectNames
    ) {
        private ExactSchema {
            createTableSql = validatedSql(createTableSql, "table");
            createIndexSql = validatedSql(createIndexSql, "index");
            ownedObjectPrefixes = normalizedObjectNames(ownedObjectPrefixes, "owner prefixes");
            forbiddenObjectNames = normalizedObjectNames(forbiddenObjectNames, "forbidden names");
            if (createTableSql.isEmpty()) {
                throw new IllegalArgumentException("exact schema requires at least one table statement");
            }
        }

        private boolean ownsDirectly(
                SchemaObject object,
                Set<String> normalizedCanonicalOwnerTables
        ) {
            String normalizedTable = object.table().toLowerCase(Locale.ROOT);
            String normalizedName = object.name().toLowerCase(Locale.ROOT);
            return normalizedCanonicalOwnerTables.contains(normalizedTable)
                    || forbiddenObjectNames.contains(normalizedName)
                    || ownedObjectPrefixes.stream().anyMatch(normalizedName::startsWith);
        }

        private static List<String> validatedSql(List<String> statements, String kind) {
            List<String> safe = List.copyOf(Objects.requireNonNull(statements, kind + " statements"));
            if (safe.stream().anyMatch(sql -> sql == null || sql.isBlank())) {
                throw new IllegalArgumentException(kind + " statements must not contain blank SQL");
            }
            return safe;
        }

        private static List<String> normalizedObjectNames(
                List<String> values,
                String label
        ) {
            List<String> safe = List.copyOf(Objects.requireNonNull(values, label));
            for (String value : safe) {
                if (value == null || !value.matches("[A-Za-z_][A-Za-z0-9_]*")) {
                    throw new IllegalArgumentException("invalid " + label);
                }
            }
            return safe.stream()
                    .map(value -> value.toLowerCase(Locale.ROOT))
                    .toList();
        }
    }

    private record SchemaObject(String type, String name, String table) {
    }

    private record ExactColumn(
            String name,
            String declaredType,
            boolean notNull,
            String defaultValue,
            int primaryKeyPosition,
            int hidden
    ) {
    }

    private static final class MutableExactForeignKey {
        private final String targetTable;
        private final String onUpdate;
        private final String onDelete;
        private final String match;
        private final List<SequencedForeignKeyColumn> columns = new ArrayList<>();

        private MutableExactForeignKey(String targetTable, String onUpdate, String onDelete, String match) {
            this.targetTable = targetTable;
            this.onUpdate = onUpdate;
            this.onDelete = onDelete;
            this.match = match;
        }

        private ExactForeignKey freeze() {
            columns.sort(Comparator.comparingInt(SequencedForeignKeyColumn::sequence));
            return new ExactForeignKey(targetTable, onUpdate, onDelete, match, List.copyOf(columns));
        }
    }

    private record ExactForeignKey(
            String targetTable,
            String onUpdate,
            String onDelete,
            String match,
            List<SequencedForeignKeyColumn> columns
    ) {
        private String sortKey() {
            return targetTable + '|' + onUpdate + '|' + onDelete + '|' + match + '|' + columns;
        }
    }

    private record SequencedForeignKeyColumn(int sequence, String source, String target) {
    }

    private record ExactIndex(
            String declaredName,
            boolean unique,
            String origin,
            boolean partial,
            List<ExactIndexColumn> columns
    ) {
        private String sortKey() {
            return Objects.toString(declaredName, "") + '|' + unique + '|' + origin + '|' + partial + '|' + columns;
        }
    }

    private record ExactIndexColumn(
            int sequence,
            int columnId,
            String name,
            boolean descending,
            String collation,
            boolean key
    ) {
    }

    private record TableFlags(boolean withoutRowId, boolean strict) {
    }
}
