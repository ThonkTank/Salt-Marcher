package src.data.items.importer;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.data.items.ItemsDatabase;
import src.data.items.ItemsSchema;

/** Explicit public-source import entrypoint; never called by desktop startup. */
public final class PublicSrdItemImporter {

    static final String API_ROOT = "https://www.dnd5eapi.co";
    static final String API_VERSION = "2014 SRD";
    private static final String EQUIPMENT_INDEX = "/api/2014/equipment";
    private static final String MAGIC_ITEM_INDEX = "/api/2014/magic-items";
    private static final DateTimeFormatter BACKUP_TIME = DateTimeFormatter
            .ofPattern("yyyyMMdd-HHmmss")
            .withLocale(Locale.ROOT)
            .withZone(ZoneOffset.UTC);
    private final ItemSource source;
    private final Clock clock;

    public PublicSrdItemImporter(HttpClient client, Clock clock) {
        this(path -> get(client, path), clock);
    }

    PublicSrdItemImporter(ItemSource source, Clock clock) {
        this.source = source;
        this.clock = clock;
    }

    public static void main(String[] arguments) {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        new PublicSrdItemImporter(client, Clock.systemUTC()).importTo(ItemsDatabase.resolvePath());
    }

    public ImportResult importTo(Path databasePath) {
        Path target = databasePath.toAbsolutePath().normalize();
        try {
            List<ImportedItem> items = fetchAll();
            validate(items);
            Path backup = backupAndVerify(target);
            replace(target, items);
            return new ImportResult(items.size(), backup);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Public SRD item import failed; prior item data was retained.", exception);
        } catch (IOException | SQLException exception) {
            throw new IllegalStateException("Public SRD item import failed; prior item data was retained.", exception);
        }
    }

    private List<ImportedItem> fetchAll() throws IOException, InterruptedException {
        List<ImportedItem> items = new ArrayList<>();
        for (String detailUrl : indexUrls(EQUIPMENT_INDEX)) {
            items.add(parseEquipment(get(detailUrl)));
        }
        for (String detailUrl : indexUrls(MAGIC_ITEM_INDEX)) {
            items.add(parseMagicItem(get(detailUrl)));
        }
        return List.copyOf(items);
    }

    private List<String> indexUrls(String path) throws IOException, InterruptedException {
        JsonArray results = array(get(path), "results");
        List<String> urls = new ArrayList<>();
        for (JsonElement element : results) {
            urls.add(string(element.getAsJsonObject(), "url"));
        }
        return List.copyOf(urls);
    }

    private JsonObject get(String path) throws IOException, InterruptedException {
        return source.get(path);
    }

    private static JsonObject get(HttpClient client, String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(API_ROOT + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("GET " + path + " returned HTTP " + response.statusCode());
        }
        return JsonParser.parseString(response.body()).getAsJsonObject();
    }

    static ImportedItem parseEquipment(JsonObject json) {
        Cost cost = cost(json.getAsJsonObject("cost"));
        String url = string(json, "url");
        List<String> properties = objectNames(array(json, "properties"));
        return new ImportedItem(
                "equipment:" + string(json, "index"),
                string(json, "name"),
                objectName(json, "equipment_category"),
                equipmentSubcategory(json),
                false,
                "",
                false,
                cost.copperPieces(),
                cost.display(),
                optionalDouble(json, "weight"),
                damage(json),
                armorClass(json),
                properties,
                descriptions(json),
                API_VERSION,
                API_ROOT + url);
    }

    static ImportedItem parseMagicItem(JsonObject json) {
        String description = descriptions(json);
        String url = string(json, "url");
        return new ImportedItem(
                "magic-item:" + string(json, "index"),
                string(json, "name"),
                objectName(json, "equipment_category"),
                "Magic Item",
                true,
                objectName(json, "rarity"),
                description.toLowerCase(Locale.ROOT).contains("requires attunement"),
                null,
                "",
                null,
                "",
                "",
                List.of(),
                description,
                API_VERSION,
                API_ROOT + url);
    }

    private Path backupAndVerify(Path databasePath) throws IOException, SQLException {
        if (!Files.exists(databasePath) || Files.size(databasePath) == 0L) {
            return null;
        }
        Path backupDirectory = databasePath.getParent().resolve("backups");
        Files.createDirectories(backupDirectory);
        Path backup = backupDirectory.resolve("before-items-import-" + BACKUP_TIME.format(clock.instant()) + ".db");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA wal_checkpoint(FULL)");
            statement.execute("VACUUM INTO '" + escapeSql(backup.toString()) + "'");
        }
        verifyIntegrity(backup);
        Path restored = Files.createTempFile(backupDirectory, "items-restore-check-", ".db");
        try {
            Files.copy(backup, restored, StandardCopyOption.REPLACE_EXISTING);
            verifyIntegrity(restored);
        } finally {
            Files.deleteIfExists(restored);
        }
        return backup;
    }

    private static void replace(Path databasePath, List<ImportedItem> items) throws SQLException {
        try (Connection connection = open(databasePath)) {
            ItemsSchema.ensure(connection);
            connection.setAutoCommit(false);
            try {
                try (Statement statement = connection.createStatement()) {
                    statement.executeUpdate("DELETE FROM item_tags");
                    statement.executeUpdate("DELETE FROM items");
                }
                insert(connection, items);
                connection.commit();
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(true);
            }
        }
    }

    private static void insert(Connection connection, List<ImportedItem> items) throws SQLException {
        String itemSql = "INSERT INTO items(source_key, name, category, subcategory, magic, rarity, attunement, "
                + "cost_cp, cost_display, weight, damage, armor_class, description, source_version, source_url) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        String tagSql = "INSERT INTO item_tags(item_source_key, tag) VALUES (?, ?)";
        try (PreparedStatement item = connection.prepareStatement(itemSql);
             PreparedStatement tag = connection.prepareStatement(tagSql)) {
            for (ImportedItem imported : items) {
                bindItem(item, imported);
                item.addBatch();
                for (String property : imported.properties()) {
                    tag.setString(1, imported.sourceKey());
                    tag.setString(2, property);
                    tag.addBatch();
                }
            }
            item.executeBatch();
            tag.executeBatch();
        }
    }

    private static void bindItem(PreparedStatement statement, ImportedItem item) throws SQLException {
        statement.setString(1, item.sourceKey());
        statement.setString(2, item.name());
        statement.setString(3, item.category());
        statement.setString(4, item.subcategory());
        statement.setInt(5, item.magic() ? 1 : 0);
        statement.setString(6, item.rarity());
        statement.setInt(7, item.attunement() ? 1 : 0);
        nullableInteger(statement, 8, item.costCp());
        statement.setString(9, item.costDisplay());
        nullableDouble(statement, 10, item.weight());
        statement.setString(11, item.damage());
        statement.setString(12, item.armorClass());
        statement.setString(13, item.description());
        statement.setString(14, item.sourceVersion());
        statement.setString(15, item.sourceUrl());
    }

    private static void validate(List<ImportedItem> items) {
        if (items.isEmpty()) {
            throw new IllegalStateException("Public source returned no items.");
        }
        Set<String> keys = new HashSet<>();
        for (ImportedItem item : items) {
            if (item.sourceKey().isBlank() || item.name().isBlank() || item.sourceUrl().isBlank()) {
                throw new IllegalStateException("Public source returned an incomplete item.");
            }
            if (!keys.add(item.sourceKey())) {
                throw new IllegalStateException("Duplicate public item key: " + item.sourceKey());
            }
        }
    }

    private static Connection open(Path databasePath) throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
            Path parent = databasePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
        } catch (ClassNotFoundException | IOException exception) {
            throw new SQLException("Could not prepare SQLite item import.", exception);
        }
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA journal_mode = WAL");
        }
        return connection;
    }

    private static void verifyIntegrity(Path databasePath) throws SQLException {
        try (Connection connection = open(databasePath);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA integrity_check")) {
            if (!result.next() || !"ok".equalsIgnoreCase(result.getString(1))) {
                throw new SQLException("SQLite integrity_check failed for " + databasePath);
            }
        }
    }

    private static String equipmentSubcategory(JsonObject json) {
        for (String field : List.of("gear_category", "tool_category")) {
            String value = objectName(json, field);
            if (!value.isBlank()) {
                return value;
            }
        }
        for (String field : List.of("weapon_category", "armor_category", "vehicle_category")) {
            String value = optionalString(json, field);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static String damage(JsonObject json) {
        JsonObject damage = object(json, "damage");
        if (damage == null) {
            return "";
        }
        String dice = optionalString(damage, "damage_dice");
        String type = objectName(damage, "damage_type");
        return (dice + " " + type).trim();
    }

    private static String armorClass(JsonObject json) {
        JsonObject armor = object(json, "armor_class");
        if (armor == null) {
            return "";
        }
        String base = optionalString(armor, "base");
        return base.isBlank() ? "" : "AC " + base;
    }

    private static Cost cost(@Nullable JsonObject cost) {
        if (cost == null) {
            return new Cost(null, "");
        }
        int quantity = cost.has("quantity") ? cost.get("quantity").getAsInt() : 0;
        String unit = optionalString(cost, "unit").toLowerCase(Locale.ROOT);
        int factor = switch (unit) {
            case "sp" -> 10;
            case "ep" -> 50;
            case "gp" -> 100;
            case "pp" -> 1000;
            default -> 1;
        };
        return new Cost(quantity * factor, quantity + " " + unit);
    }

    private static String descriptions(JsonObject json) {
        List<String> descriptions = new ArrayList<>();
        for (JsonElement element : array(json, "desc")) {
            descriptions.add(element.getAsString());
        }
        return String.join("\n\n", descriptions);
    }

    private static List<String> objectNames(JsonArray array) {
        List<String> names = new ArrayList<>();
        for (JsonElement element : array) {
            String name = objectName(element.getAsJsonObject());
            if (!name.isBlank() && !names.contains(name)) {
                names.add(name);
            }
        }
        return List.copyOf(names);
    }

    private static JsonArray array(JsonObject object, String field) {
        JsonElement element = object.get(field);
        return element == null || !element.isJsonArray() ? new JsonArray() : element.getAsJsonArray();
    }

    private static @Nullable JsonObject object(JsonObject object, String field) {
        JsonElement element = object.get(field);
        return element == null || !element.isJsonObject() ? null : element.getAsJsonObject();
    }

    private static String objectName(JsonObject object, String field) {
        return objectName(object(object, field));
    }

    private static String objectName(@Nullable JsonObject object) {
        return object == null ? "" : optionalString(object, "name");
    }

    private static String string(JsonObject object, String field) {
        String value = optionalString(object, field);
        if (value.isBlank()) {
            throw new IllegalStateException("Public item field is missing: " + field);
        }
        return value;
    }

    private static String optionalString(JsonObject object, String field) {
        JsonElement element = object.get(field);
        return element == null || element.isJsonNull() ? "" : element.getAsString();
    }

    private static @Nullable Double optionalDouble(JsonObject object, String field) {
        JsonElement element = object.get(field);
        return element == null || element.isJsonNull() ? null : element.getAsDouble();
    }

    private static void nullableInteger(PreparedStatement statement, int index, @Nullable Integer value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, java.sql.Types.INTEGER);
        } else {
            statement.setInt(index, value);
        }
    }

    private static void nullableDouble(PreparedStatement statement, int index, @Nullable Double value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, java.sql.Types.REAL);
        } else {
            statement.setDouble(index, value);
        }
    }

    private static String escapeSql(String value) {
        return value.replace("'", "''");
    }

    public record ImportResult(int itemCount, @Nullable Path backupPath) {
    }

    record Cost(@Nullable Integer copperPieces, String display) {
    }

    record ImportedItem(
            String sourceKey,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean attunement,
            @Nullable Integer costCp,
            String costDisplay,
            @Nullable Double weight,
            String damage,
            String armorClass,
            List<String> properties,
            String description,
            String sourceVersion,
            String sourceUrl
    ) {
        ImportedItem {
            properties = properties == null ? List.of() : List.copyOf(properties);
        }
    }

    @FunctionalInterface
    interface ItemSource {
        JsonObject get(String path) throws IOException, InterruptedException;
    }
}
