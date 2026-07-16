package src.data.items;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import src.domain.items.model.ItemCatalogData;

class SqliteItemCatalogAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void distinguishesMissingImportFromAQueryableCatalog() throws Exception {
        Path database = temporaryDirectory.resolve("game.db");
        SqliteItemCatalogAdapter adapter = new SqliteItemCatalogAdapter(database);

        assertFalse(adapter.isAvailable());
        seed(database);

        assertTrue(adapter.isAvailable());
        ItemCatalogData.CatalogPage page = adapter.search(new ItemCatalogData.SearchSpec(
                "shield", "Armor", null, null, false, null, 100, 2000,
                "COST", false, 50, 0));
        assertEquals(1, page.totalCount());
        assertEquals("Shield", page.rows().getFirst().name());
        assertEquals("AC 2", adapter.loadDetail("equipment:shield").armorClass());
        assertEquals("Armor", adapter.loadFilterValues().categories().getFirst());
    }

    private static void seed(Path database) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database);
             Statement statement = connection.createStatement()) {
            ItemsSchema.ensure(connection);
            statement.executeUpdate("""
                    INSERT INTO items(source_key, name, category, subcategory, magic, rarity, attunement,
                        cost_cp, cost_display, weight, damage, armor_class, description, source_version, source_url)
                    VALUES ('equipment:shield', 'Shield', 'Armor', 'Shield', 0, '', 0,
                        1000, '10 gp', 6, '', 'AC 2', 'A shield.', '2014 SRD',
                        'https://www.dnd5eapi.co/api/2014/equipment/shield')
                    """);
            statement.executeUpdate("INSERT INTO item_tags(item_source_key, tag) "
                    + "VALUES ('equipment:shield', 'Armor')");
        }
    }
}
