package features.items.adapter.sqlite;

import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.catalog.ItemCatalogData.Detail;
import features.items.domain.catalog.ItemCatalogPort;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import features.items.domain.importing.ItemImportStore;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** SQLite-backed read projection and atomic replacement adapter for Items-owned truth. */
public final class SqliteItemCatalogAdapter implements ItemCatalogPort, ItemImportStore {

    public static final String OWNER = "items";
    public static final int SCHEMA_VERSION = 1;

    private static final String FILTERS = " WHERE "
            + "(? IS NULL OR LOWER(name) LIKE LOWER(?)) "
            + "AND (? IS NULL OR LOWER(category) = LOWER(?)) "
            + "AND (? IS NULL OR LOWER(subcategory) = LOWER(?)) "
            + "AND (? IS NULL OR LOWER(rarity) = LOWER(?)) "
            + "AND (? IS NULL OR magic = ?) "
            + "AND (? IS NULL OR attunement = ?) "
            + "AND (? IS NULL OR cost_cp >= ?) "
            + "AND (? IS NULL OR cost_cp <= ?) ";

    private final SqliteDatabase database;
    private final FeatureStoreHandle connections;

    public SqliteItemCatalogAdapter(SqliteDatabase database) {
        this.database = Objects.requireNonNull(database, "database");
        ItemsSchema schema = new ItemsSchema();
        connections = database.featureStore(FeatureStoreDefinition.of(
                OWNER,
                new SqliteMigration(SCHEMA_VERSION, schema::migrate)));
    }

    @Override
    public boolean isAvailable() {
        try (Connection connection = connections.openConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT COUNT(*) FROM items");
             ResultSet result = statement.executeQuery()) {
            return result.next() && result.getInt(1) > 0;
        } catch (SQLException exception) {
            throw failure("check item catalog availability", exception);
        }
    }

    @Override
    public ItemCatalogData.FilterValues loadFilterValues() {
        try (Connection connection = connections.openConnection()) {
            return new ItemCatalogData.FilterValues(
                    distinct(connection, "category"),
                    distinct(connection, "subcategory"),
                    distinct(connection, "rarity"));
        } catch (SQLException exception) {
            throw failure("load item filters", exception);
        }
    }

    @Override
    public ItemCatalogData.CatalogPage search(ItemCatalogData.SearchSpec spec) {
        Objects.requireNonNull(spec, "spec");
        String rowSql = "SELECT source_key, name, category, subcategory, magic, rarity, attunement, "
                + "cost_cp, cost_display FROM items" + FILTERS + orderBy(spec.sortField(), spec.ascending())
                + " LIMIT ? OFFSET ?";
        String countSql = "SELECT COUNT(*) FROM items" + FILTERS;
        try (Connection connection = connections.openConnection();
             PreparedStatement count = connection.prepareStatement(countSql);
             PreparedStatement rows = connection.prepareStatement(rowSql)) {
            bindFilters(count, spec);
            bindFilters(rows, spec);
            rows.setInt(17, spec.pageSize());
            rows.setInt(18, spec.pageOffset());
            return new ItemCatalogData.CatalogPage(
                    readRows(rows),
                    readCount(count),
                    spec.pageSize(),
                    spec.pageOffset());
        } catch (SQLException exception) {
            throw failure("search items", exception);
        }
    }

    @Override
    public @Nullable Detail loadDetail(String sourceKey) {
        String sql = "SELECT source_key, name, category, subcategory, magic, rarity, attunement, cost_cp, "
                + "cost_display, weight, damage, armor_class, description, source_version, source_url "
                + "FROM items WHERE source_key = ?";
        try (Connection connection = connections.openConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, sourceKey);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    return null;
                }
                ItemCatalogData.CatalogRow row = row(result);
                return new ItemCatalogData.Detail(
                        row,
                        nullableDouble(result, "weight"),
                        result.getString("damage"),
                        result.getString("armor_class"),
                        tags(connection, sourceKey),
                        result.getString("description"),
                        result.getString("source_version"),
                        result.getString("source_url"));
            }
        } catch (SQLException exception) {
            throw failure("load item detail", exception);
        }
    }

    @Override
    public void initialize() {
        try (Connection ignored = connections.openConnection()) {
            // Opening through the shared database lifecycle applies the Items schema migration.
        } catch (SQLException exception) {
            throw failure("initialize item catalog", exception);
        }
    }

    @Override
    public BackupReceipt createVerifiedBackup() {
        try {
            SqliteDatabase.MaintenanceBackup backup = database.createVerifiedMaintenanceBackup(OWNER);
            return new BackupReceipt(backup.createdAt());
        } catch (SQLException exception) {
            throw failure("create verified item-import backup", exception);
        }
    }

    @Override
    public void replaceAll(ItemImportBatch batch) {
        Objects.requireNonNull(batch, "batch");
        try (Connection connection = connections.openConnection()) {
            replaceTransaction(connection, batch.items());
        } catch (SQLException exception) {
            throw failure("replace imported items", exception);
        }
    }

    private static void replaceTransaction(Connection connection, List<ImportedItem> items) throws SQLException {
        boolean autoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("DELETE FROM item_tags");
                statement.executeUpdate("DELETE FROM items");
            }
            insert(connection, items);
            connection.commit();
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(autoCommit);
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

    private static List<String> distinct(Connection connection, String column) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM items WHERE " + column + " <> '' ORDER BY " + column;
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                values.add(result.getString(1));
            }
        }
        return List.copyOf(values);
    }

    private static int readCount(PreparedStatement statement) throws SQLException {
        try (ResultSet result = statement.executeQuery()) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static List<ItemCatalogData.CatalogRow> readRows(PreparedStatement statement) throws SQLException {
        List<ItemCatalogData.CatalogRow> rows = new ArrayList<>();
        try (ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                rows.add(row(result));
            }
        }
        return List.copyOf(rows);
    }

    private static ItemCatalogData.CatalogRow row(ResultSet result) throws SQLException {
        return new ItemCatalogData.CatalogRow(
                result.getString("source_key"),
                result.getString("name"),
                result.getString("category"),
                result.getString("subcategory"),
                result.getInt("magic") != 0,
                result.getString("rarity"),
                result.getInt("attunement") != 0,
                nullableInteger(result, "cost_cp"),
                result.getString("cost_display"));
    }

    private static List<String> tags(Connection connection, String sourceKey) throws SQLException {
        List<String> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT tag FROM item_tags WHERE item_source_key = ? ORDER BY tag")) {
            statement.setString(1, sourceKey);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    values.add(result.getString(1));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void bindFilters(PreparedStatement statement, ItemCatalogData.SearchSpec spec)
            throws SQLException {
        bindStringPair(statement, 1, like(spec.name()));
        bindStringPair(statement, 3, spec.category());
        bindStringPair(statement, 5, spec.subcategory());
        bindStringPair(statement, 7, spec.rarity());
        bindBooleanPair(statement, 9, spec.magic());
        bindBooleanPair(statement, 11, spec.attunement());
        bindIntegerPair(statement, 13, spec.minimumCostCp());
        bindIntegerPair(statement, 15, spec.maximumCostCp());
    }

    private static void bindStringPair(PreparedStatement statement, int index, @Nullable String value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
            statement.setNull(index + 1, Types.VARCHAR);
        } else {
            statement.setString(index, value);
            statement.setString(index + 1, value);
        }
    }

    private static void bindBooleanPair(PreparedStatement statement, int index, @Nullable Boolean value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.INTEGER);
            statement.setNull(index + 1, Types.INTEGER);
        } else {
            statement.setInt(index, value ? 1 : 0);
            statement.setInt(index + 1, value ? 1 : 0);
        }
    }

    private static void bindIntegerPair(PreparedStatement statement, int index, @Nullable Integer value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.INTEGER);
            statement.setNull(index + 1, Types.INTEGER);
        } else {
            statement.setInt(index, value);
            statement.setInt(index + 1, value);
        }
    }

    private static String orderBy(ItemCatalogData.SortField field, boolean ascending) {
        String column = switch (field == null ? ItemCatalogData.SortField.NAME : field) {
            case CATEGORY -> "category";
            case RARITY -> "rarity";
            case COST -> "cost_cp";
            case NAME -> "name";
        };
        return " ORDER BY " + column + (ascending ? " ASC" : " DESC") + ", name ASC";
    }

    private static @Nullable String like(@Nullable String value) {
        return value == null ? null : "%" + value + "%";
    }

    private static @Nullable Integer nullableInteger(ResultSet result, String column) throws SQLException {
        int value = result.getInt(column);
        return result.wasNull() ? null : value;
    }

    private static @Nullable Double nullableDouble(ResultSet result, String column) throws SQLException {
        double value = result.getDouble(column);
        return result.wasNull() ? null : value;
    }

    private static void nullableInteger(PreparedStatement statement, int index, @Nullable Integer value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.INTEGER);
        } else {
            statement.setInt(index, value);
        }
    }

    private static void nullableDouble(PreparedStatement statement, int index, @Nullable Double value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.REAL);
        } else {
            statement.setDouble(index, value);
        }
    }

    private static IllegalStateException failure(String action, SQLException exception) {
        return new IllegalStateException("Could not " + action + " in SQLite.", exception);
    }
}
