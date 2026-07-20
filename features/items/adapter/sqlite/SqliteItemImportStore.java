package features.items.adapter.sqlite;

import features.items.domain.catalog.ItemCatalogAccessException;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import features.items.domain.importing.ItemImportStore;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.persistence.FeatureStoreBackup;
import platform.persistence.FeatureStoreMaintenance;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;

/** Operator-only Items replacement adapter backed by one inseparable maintenance capability. */
public final class SqliteItemImportStore implements ItemImportStore {

  private final FeatureStoreMaintenance maintenance;

  public SqliteItemImportStore(FeatureStoreMaintenance maintenance) {
    this.maintenance =
        FeatureStoreMaintenance.requireOwner(maintenance, SqliteItemCatalogAdapter.OWNER);
  }

  @Override
  public void initialize() {
    try (Connection ignored = maintenance.openConnection()) {
      // Coordinated preparation already established and validated the Items schema.
    } catch (SQLException exception) {
      throw failure(exception);
    }
  }

  @Override
  public BackupReceipt createVerifiedBackup() {
    try {
      FeatureStoreBackup backup = maintenance.createVerifiedBackup();
      return new BackupReceipt(backup.createdAt());
    } catch (SQLException exception) {
      throw failure(exception);
    }
  }

  @Override
  public void replaceAll(ItemImportBatch batch) {
    Objects.requireNonNull(batch, "batch");
    try (Connection connection = maintenance.openConnection()) {
      replaceTransaction(connection, batch.items());
    } catch (SQLException exception) {
      throw failure(exception);
    }
  }

  private static void replaceTransaction(Connection connection, List<ImportedItem> items)
      throws SQLException {
    boolean autoCommit = connection.getAutoCommit();
    connection.setAutoCommit(false);
    try {
      try (var statement = connection.createStatement()) {
        statement.executeUpdate("DELETE FROM " + ItemsSchema.TAGS_TABLE);
        statement.executeUpdate("DELETE FROM " + ItemsSchema.ENTRIES_TABLE);
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
    String itemSql =
        "INSERT INTO "
            + ItemsSchema.ENTRIES_TABLE
            + "(source_key, name, category, subcategory, magic, rarity, attunement,"
            + " cost_cp, cost_display, weight, damage, armor_class, description,"
            + " source_version, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    String tagSql =
        "INSERT INTO " + ItemsSchema.TAGS_TABLE + "(item_source_key, tag) VALUES (?, ?)";
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

  private static void bindItem(PreparedStatement statement, ImportedItem item)
      throws SQLException {
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

  private static void nullableInteger(
      PreparedStatement statement, int index, @Nullable Integer value) throws SQLException {
    if (value == null) {
      statement.setNull(index, Types.INTEGER);
    } else {
      statement.setInt(index, value);
    }
  }

  private static void nullableDouble(
      PreparedStatement statement, int index, @Nullable Double value) throws SQLException {
    if (value == null) {
      statement.setNull(index, Types.REAL);
    } else {
      statement.setDouble(index, value);
    }
  }

  private static ItemCatalogAccessException failure(SQLException exception) {
    ItemCatalogAccessException.Reason reason =
        exception instanceof FeatureStoreUnavailableException unavailable
                && (unavailable.readiness() == FeatureStoreReadiness.MIGRATION_FAILED
                    || unavailable.readiness() == FeatureStoreReadiness.NEWER_SCHEMA)
            ? ItemCatalogAccessException.Reason.INCOMPATIBLE
            : ItemCatalogAccessException.Reason.STORAGE;
    return new ItemCatalogAccessException(reason, exception);
  }
}
