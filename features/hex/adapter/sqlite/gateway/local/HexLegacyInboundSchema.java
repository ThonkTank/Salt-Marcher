package features.hex.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Fail-closed inventory for released cross-owner references to legacy Hex surrogate keys. */
final class HexLegacyInboundSchema {

    private static final Set<String> HEX_TABLES = Set.of(
            "hex_maps", "hex_current_map", "hex_tiles", "hex_terrain_overrides", "hex_markers");
    private static final Set<String> KNOWN_EXTERNAL_CONSUMERS = Set.of(
            "world_locations", "tile_faction_influence", "campaign_state");
    private static final Pattern HEX_TABLE_REFERENCE = Pattern.compile(
            "(?i)(?<![A-Za-z0-9_])(?:hex_maps|hex_current_map|hex_tiles|"
                    + "hex_terrain_overrides|hex_markers)(?![A-Za-z0-9_])");

    private HexLegacyInboundSchema() {
    }

    static void validate(Connection connection) throws SQLException {
        rejectReferencingViewsAndTriggers(connection);
        Set<String> inboundConsumers = inboundConsumers(connection);
        if (!KNOWN_EXTERNAL_CONSUMERS.containsAll(inboundConsumers)) {
            throw failure("Unknown inbound owner references the Hex v1 schema.");
        }
        validateHexChildReferences(connection);
        for (String consumer : inboundConsumers) {
            validateKnownConsumer(connection, consumer);
        }
    }

    private static void rejectReferencingViewsAndTriggers(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT type,name,sql FROM sqlite_master "
                             + "WHERE type IN ('view','trigger') AND sql IS NOT NULL")) {
            while (result.next()) {
                if (HEX_TABLE_REFERENCE.matcher(result.getString("sql")).find()) {
                    throw failure("Unknown schema object references the Hex v1 schema: "
                            + result.getString("type") + " " + result.getString("name"));
                }
            }
        }
    }

    private static Set<String> inboundConsumers(Connection connection) throws SQLException {
        Set<String> consumers = new LinkedHashSet<>();
        for (String table : tables(connection)) {
            if (HEX_TABLES.contains(canonical(table))) {
                continue;
            }
            boolean referencesHex = foreignKeys(connection, table).stream()
                    .anyMatch(foreignKey -> HEX_TABLES.contains(foreignKey.targetTable()));
            if (referencesHex) {
                consumers.add(table);
            }
        }
        return Set.copyOf(consumers);
    }

    private static void validateHexChildReferences(Connection connection) throws SQLException {
        requireForeignKeys(connection, "hex_current_map", Set.of(
                foreignKey("hex_maps", "NO ACTION", "SET NULL", reference("map_id", "map_id"))));
        requireForeignKeys(connection, "hex_tiles", Set.of(
                foreignKey("hex_maps", "NO ACTION", "CASCADE", reference("map_id", "map_id"))));
        requireForeignKeys(connection, "hex_terrain_overrides", Set.of(
                foreignKey("hex_maps", "NO ACTION", "CASCADE", reference("map_id", "map_id")),
                foreignKey("hex_tiles", "NO ACTION", "CASCADE",
                        reference("map_id", "map_id"), reference("q", "q"), reference("r", "r"))));
        requireForeignKeys(connection, "hex_markers", Set.of(
                foreignKey("hex_maps", "NO ACTION", "CASCADE", reference("map_id", "map_id")),
                foreignKey("hex_tiles", "NO ACTION", "CASCADE",
                        reference("map_id", "map_id"), reference("q", "q"), reference("r", "r"))));
    }

    private static void validateKnownConsumer(Connection connection, String consumer) throws SQLException {
        switch (consumer) {
            case "world_locations" -> validateWorldLocations(connection);
            case "tile_faction_influence" -> validateTileFactionInfluence(connection);
            case "campaign_state" -> validateCampaignState(connection);
            default -> throw failure("Unknown inbound owner references the Hex v1 schema.");
        }
    }

    private static void validateWorldLocations(Connection connection) throws SQLException {
        requireColumns(connection, "world_locations", List.of(
                column("location_id", "INTEGER", false, null, 1),
                column("tile_id", "INTEGER", true, null, 0),
                column("name", "TEXT", true, null, 0),
                column("location_type", "TEXT", true, null, 0),
                column("description", "TEXT", false, null, 0),
                column("is_discovered", "INTEGER", true, "0", 0)));
        requireForeignKeys(connection, "world_locations", Set.of(
                foreignKey("hex_tiles", "NO ACTION", "CASCADE", reference("tile_id", "tile_id"))));
        requireIndexes(connection, "world_locations", Set.of(
                index("idx_world_locations_tile", false, "tile_id")));
    }

    private static void validateTileFactionInfluence(Connection connection) throws SQLException {
        requireColumns(connection, "tile_faction_influence", List.of(
                column("tile_id", "INTEGER", true, null, 1),
                column("faction_id", "INTEGER", true, null, 2),
                column("influence", "INTEGER", true, "0", 0),
                column("control_type", "TEXT", true, "'presence'", 0)));
        requireForeignKeys(connection, "tile_faction_influence", Set.of(
                foreignKey("hex_tiles", "NO ACTION", "CASCADE", reference("tile_id", "tile_id")),
                foreignKey("factions", "NO ACTION", "CASCADE", reference("faction_id", "faction_id"))));
        requireIndexes(connection, "tile_faction_influence", Set.of(
                index("idx_tile_influence_faction", false, "faction_id"),
                index("sqlite_autoindex_tile_faction_influence_1", true, "tile_id", "faction_id")));
    }

    private static void validateCampaignState(Connection connection) throws SQLException {
        requireColumns(connection, "campaign_state", List.of(
                column("campaign_id", "INTEGER", false, "1", 1),
                column("map_id", "INTEGER", false, null, 0),
                column("party_tile_id", "INTEGER", false, null, 0),
                column("calendar_id", "INTEGER", false, null, 0),
                column("current_epoch_day", "INTEGER", true, "0", 0),
                column("current_phase_id", "INTEGER", false, null, 0),
                column("current_weather", "TEXT", false, null, 0),
                column("notes", "TEXT", false, null, 0),
                column("dungeon_map_id", "INTEGER", false, null, 0),
                column("dungeon_room_id", "INTEGER", false, null, 0),
                column("dungeon_location_type", "TEXT", false, null, 0),
                column("dungeon_corridor_id", "INTEGER", false, null, 0),
                column("dungeon_location_key", "TEXT", false, null, 0)));
        requireForeignKeys(connection, "campaign_state", Set.of(
                foreignKey("hex_maps", "NO ACTION", "NO ACTION", reference("map_id", "map_id")),
                foreignKey("hex_tiles", "NO ACTION", "NO ACTION", reference("party_tile_id", "tile_id")),
                foreignKey("calendar_config", "NO ACTION", "NO ACTION", reference("calendar_id", "calendar_id")),
                foreignKey("time_of_day_phases", "NO ACTION", "NO ACTION",
                        reference("current_phase_id", "phase_id")),
                foreignKey("dungeon_maps", "NO ACTION", "SET NULL",
                        reference("dungeon_map_id", "dungeon_map_id")),
                foreignKey("dungeon_rooms", "NO ACTION", "SET NULL",
                        reference("dungeon_room_id", "room_id")),
                foreignKey("dungeon_corridors", "NO ACTION", "SET NULL",
                        reference("dungeon_corridor_id", "corridor_id"))));
        requireIndexes(connection, "campaign_state", Set.of());
    }

    private static void requireColumns(
            Connection connection,
            String table,
            List<ColumnSignature> expected
    ) throws SQLException {
        if (!columns(connection, table).equals(expected)) {
            throw failure("Known inbound Hex v1 owner has an unexpected table signature: " + table);
        }
    }

    private static void requireForeignKeys(
            Connection connection,
            String table,
            Set<ForeignKeySignature> expected
    ) throws SQLException {
        if (!Set.copyOf(foreignKeys(connection, table)).equals(expected)) {
            throw failure("Known inbound Hex v1 owner has unexpected foreign keys: " + table);
        }
    }

    private static void requireIndexes(
            Connection connection,
            String table,
            Set<IndexSignature> expected
    ) throws SQLException {
        if (!Set.copyOf(indexes(connection, table)).equals(expected)) {
            throw failure("Known inbound Hex v1 owner has unexpected indexes: " + table);
        }
    }

    private static List<String> tables(Connection connection) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
            while (result.next()) {
                tables.add(result.getString("name"));
            }
        }
        return List.copyOf(tables);
    }

    private static List<ColumnSignature> columns(Connection connection, String table) throws SQLException {
        List<ColumnSignature> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                columns.add(column(
                        result.getString("name"), result.getString("type"),
                        result.getInt("notnull") == 1, result.getString("dflt_value"), result.getInt("pk")));
            }
        }
        return List.copyOf(columns);
    }

    private static List<ForeignKeySignature> foreignKeys(Connection connection, String table) throws SQLException {
        Map<Integer, List<ForeignKeyRow>> byId = new LinkedHashMap<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                ForeignKeyRow row = new ForeignKeyRow(
                        result.getInt("seq"), canonical(result.getString("table")),
                        result.getString("from"), result.getString("to"),
                        result.getString("on_update"), result.getString("on_delete"));
                byId.computeIfAbsent(result.getInt("id"), ignored -> new ArrayList<>()).add(row);
            }
        }
        return byId.values().stream().map(HexLegacyInboundSchema::foreignKey).toList();
    }

    private static ForeignKeySignature foreignKey(List<ForeignKeyRow> rows) {
        List<ForeignKeyRow> ordered = rows.stream()
                .sorted(java.util.Comparator.comparingInt(ForeignKeyRow::sequence)).toList();
        ForeignKeyRow first = ordered.getFirst();
        return new ForeignKeySignature(
                first.targetTable(), first.onUpdate(), first.onDelete(),
                ordered.stream().map(row -> reference(row.sourceColumn(), row.targetColumn())).toList());
    }

    private static List<IndexSignature> indexes(Connection connection, String table) throws SQLException {
        List<IndexSignature> indexes = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_list(" + table + ")")) {
            while (result.next()) {
                String name = result.getString("name");
                indexes.add(new IndexSignature(name, result.getInt("unique") == 1, indexColumns(connection, name)));
            }
        }
        return List.copyOf(indexes);
    }

    private static List<String> indexColumns(Connection connection, String index) throws SQLException {
        List<String> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_info(" + index + ")")) {
            while (result.next()) {
                columns.add(result.getString("name"));
            }
        }
        return List.copyOf(columns);
    }

    private static ColumnSignature column(
            String name, String type, boolean notNull, String defaultValue, int primaryKeyPosition
    ) {
        return new ColumnSignature(
                name, type == null ? "" : type.toUpperCase(Locale.ROOT),
                notNull, defaultValue, primaryKeyPosition);
    }

    private static ForeignKeySignature foreignKey(
            String targetTable, String onUpdate, String onDelete, Reference... references
    ) {
        return new ForeignKeySignature(targetTable, onUpdate, onDelete, List.of(references));
    }

    private static Reference reference(String source, String target) {
        return new Reference(source, target);
    }

    private static IndexSignature index(String name, boolean unique, String... columns) {
        return new IndexSignature(name, unique, List.of(columns));
    }

    private static String canonical(String identifier) {
        return identifier.toLowerCase(Locale.ROOT);
    }

    private static SQLException failure(String message) {
        return new SQLException(message);
    }

    private record ColumnSignature(
            String name, String type, boolean notNull, String defaultValue, int primaryKeyPosition
    ) {
    }

    private record ForeignKeyRow(
            int sequence,
            String targetTable,
            String sourceColumn,
            String targetColumn,
            String onUpdate,
            String onDelete
    ) {
    }

    private record ForeignKeySignature(
            String targetTable, String onUpdate, String onDelete, List<Reference> references
    ) {
    }

    private record Reference(String sourceColumn, String targetColumn) {
    }

    private record IndexSignature(String name, boolean unique, List<String> columns) {
    }
}
