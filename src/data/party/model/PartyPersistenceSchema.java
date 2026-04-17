package src.data.party.model;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Canonical persistence schema for the party feature.
 */
public final class PartyPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";
    public static final TableSpec PLAYER_CHARACTERS = new TableSpec(
            "player_characters",
            List.of(
                    new ColumnSpec("id", "INTEGER PRIMARY KEY"),
                    new ColumnSpec("name", "TEXT NOT NULL"),
                    new ColumnSpec("player_name", "TEXT"),
                    new ColumnSpec("level", "INTEGER NOT NULL DEFAULT 1"),
                    new ColumnSpec("current_xp", "INTEGER NOT NULL DEFAULT 0"),
                    new ColumnSpec("xp_since_long_rest", "INTEGER NOT NULL DEFAULT 0"),
                    new ColumnSpec("xp_since_short_rest", "INTEGER NOT NULL DEFAULT 0"),
                    new ColumnSpec("passive_perception", "INTEGER NOT NULL DEFAULT 10"),
                    new ColumnSpec("ac", "INTEGER NOT NULL DEFAULT 10"),
                    new ColumnSpec("in_party", "INTEGER NOT NULL DEFAULT 1")));
    public static final TableSpec PARTY_ROSTER_METADATA = new TableSpec(
            "party_roster_metadata",
            List.of(
                    new ColumnSpec("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
                    new ColumnSpec("next_character_id", "INTEGER NOT NULL")));
    public static final String INITIALIZE_METADATA_SQL =
            "INSERT OR IGNORE INTO party_roster_metadata(singleton_id, next_character_id) VALUES (1, 1)";

    private PartyPersistenceSchema() {
    }

    public static final class TableSpec {

        private final String name;
        private final List<ColumnSpec> columns;
        private final Map<String, ColumnSpec> columnsByName;

        public TableSpec(String name, List<ColumnSpec> columns) {
            this.name = Objects.requireNonNull(name, "name");
            this.columns = List.copyOf(columns);
            Map<String, ColumnSpec> byName = new LinkedHashMap<>();
            for (ColumnSpec column : this.columns) {
                byName.put(column.name(), column);
            }
            this.columnsByName = Map.copyOf(byName);
        }

        public String name() {
            return name;
        }

        public List<ColumnSpec> columns() {
            return columns;
        }

        public ColumnSpec column(String columnName) {
            ColumnSpec column = columnsByName.get(columnName);
            if (column == null) {
                throw new IllegalArgumentException("Unknown column '" + columnName + "' for table '" + name + "'.");
            }
            return column;
        }

        public String createTableSql() {
            String joinedColumns = columns.stream()
                    .map(column -> column.name() + " " + column.definition())
                    .reduce((left, right) -> left + "," + right)
                    .orElseThrow();
            return "CREATE TABLE IF NOT EXISTS " + name + " (" + joinedColumns + ")";
        }
    }

    public record ColumnSpec(String name, String definition) {

        public ColumnSpec {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(definition, "definition");
        }
    }
}
