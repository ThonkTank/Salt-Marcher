package features.items.adapter.sqlite;

import features.items.domain.catalog.ItemCatalogAccessException;
import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.catalog.ItemCatalogData.Detail;
import features.items.domain.catalog.ItemCatalogPort;
import org.jspecify.annotations.Nullable;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** SQLite-backed read projection for Items-owned truth. */
public final class SqliteItemCatalogAdapter implements ItemCatalogPort {

    public static final String OWNER = "items";
    public static final int SCHEMA_VERSION = 2;

    private static final String FILTERS = " WHERE "
            + "(? IS NULL OR LOWER(name) LIKE LOWER(?)) "
            + "AND (? IS NULL OR LOWER(category) = LOWER(?)) "
            + "AND (? IS NULL OR LOWER(subcategory) = LOWER(?)) "
            + "AND (? IS NULL OR LOWER(rarity) = LOWER(?)) "
            + "AND (? IS NULL OR magic = ?) "
            + "AND (? IS NULL OR attunement = ?) "
            + "AND (? IS NULL OR cost_cp >= ?) "
            + "AND (? IS NULL OR cost_cp <= ?) ";

    private final FeatureStoreHandle connections;

    public static FeatureStoreDefinition storeDefinition() {
        ItemsSchema schema = new ItemsSchema();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(ItemsSchema.ENTRIES_TABLE,
                        "source_key", "legacy_id", "name", "category", "subcategory", "magic", "rarity",
                        "attunement", "attunement_condition", "cost_cp", "cost_display", "weight", "damage",
                        "armor_class", "description", "source_version", "source_url", "source_properties_text",
                        "source_tags_text")
                .primaryKey(ItemsSchema.ENTRIES_TABLE, "source_key")
                .table(ItemsSchema.TAGS_TABLE, "item_source_key", "tag")
                .primaryKey(ItemsSchema.TAGS_TABLE, "item_source_key", "tag")
                .foreignKey(ItemsSchema.TAGS_TABLE, ItemsSchema.ENTRIES_TABLE, "CASCADE",
                        SqliteSchemaValidator.reference("item_source_key", "source_key"))
                .index("idx_items_catalog_name", ItemsSchema.ENTRIES_TABLE, false, "name")
                .index("idx_items_catalog_category", ItemsSchema.ENTRIES_TABLE,
                        false, "category", "subcategory")
                .index("idx_items_catalog_rarity", ItemsSchema.ENTRIES_TABLE, false, "rarity")
                .index("idx_items_catalog_cost", ItemsSchema.ENTRIES_TABLE, false, "cost_cp")
                .index("idx_items_catalog_tag", ItemsSchema.TAGS_TABLE, false, "tag")
                .build();
        return FeatureStoreDefinition.validated(
                OWNER,
                targetSchema,
                new SqliteMigration(1, schema::migrateV1),
                new SqliteMigration(SCHEMA_VERSION, schema::migrateV2));
    }

    public SqliteItemCatalogAdapter(FeatureStoreHandle store) {
        connections = FeatureStoreHandle.requireOwner(store, OWNER);
    }

    @Override
    public boolean isAvailable() {
        try (Connection connection = connections.openConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT COUNT(*) FROM " + ItemsSchema.ENTRIES_TABLE);
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
                + "cost_cp, cost_display FROM " + ItemsSchema.ENTRIES_TABLE
                + FILTERS + orderBy(spec.sortField(), spec.ascending())
                + " LIMIT ? OFFSET ?";
        String countSql = "SELECT COUNT(*) FROM " + ItemsSchema.ENTRIES_TABLE + FILTERS;
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
        String sql =
                "SELECT source_key, name, category, subcategory, magic, rarity, attunement,"
                    + " cost_cp, cost_display, weight, damage, armor_class, description,"
                    + " source_version, source_url FROM "
                        + ItemsSchema.ENTRIES_TABLE + " WHERE source_key = ?";
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


    private static List<String> distinct(Connection connection, String column) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + ItemsSchema.ENTRIES_TABLE
                + " WHERE " + column + " <> '' ORDER BY " + column;
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
                "SELECT tag FROM " + ItemsSchema.TAGS_TABLE + " WHERE item_source_key = ? ORDER BY tag")) {
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


    private static IllegalStateException failure(String action, SQLException exception) {
        ItemCatalogAccessException.Reason reason = exception instanceof FeatureStoreUnavailableException unavailable
                && (unavailable.readiness() == FeatureStoreReadiness.MIGRATION_FAILED
                    || unavailable.readiness() == FeatureStoreReadiness.NEWER_SCHEMA)
                ? ItemCatalogAccessException.Reason.INCOMPATIBLE
                : ItemCatalogAccessException.Reason.STORAGE;
        return new ItemCatalogAccessException(reason, exception);
    }
}
