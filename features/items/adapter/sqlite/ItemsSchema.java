package features.items.adapter.sqlite;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class ItemsSchema {

    void migrate(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS items (
                        source_key TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        category TEXT NOT NULL,
                        subcategory TEXT NOT NULL DEFAULT '',
                        magic INTEGER NOT NULL CHECK (magic IN (0, 1)),
                        rarity TEXT NOT NULL DEFAULT '',
                        attunement INTEGER NOT NULL CHECK (attunement IN (0, 1)),
                        cost_cp INTEGER,
                        cost_display TEXT NOT NULL DEFAULT '',
                        weight REAL,
                        damage TEXT NOT NULL DEFAULT '',
                        armor_class TEXT NOT NULL DEFAULT '',
                        description TEXT NOT NULL DEFAULT '',
                        source_version TEXT NOT NULL,
                        source_url TEXT NOT NULL
                    )
                    """);
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS item_tags (
                        item_source_key TEXT NOT NULL,
                        tag TEXT NOT NULL,
                        PRIMARY KEY (item_source_key, tag),
                        FOREIGN KEY (item_source_key) REFERENCES items(source_key) ON DELETE CASCADE
                    )
                    """);
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category, subcategory)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_cost ON items(cost_cp)");
        }
    }
}
