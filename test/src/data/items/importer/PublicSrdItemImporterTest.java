package src.data.items.importer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PublicSrdItemImporterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void importsBothPublicFeedsAndRestoreChecksAnExistingDatabaseBackup() throws Exception {
        Map<String, JsonObject> responses = Map.of(
                "/api/2014/equipment", json("""
                        {"results":[{"url":"/api/2014/equipment/club"}]}
                        """),
                "/api/2014/magic-items", json("""
                        {"results":[{"url":"/api/2014/magic-items/adamantine-armor"}]}
                        """),
                "/api/2014/equipment/club", json("""
                        {"index":"club","name":"Club","equipment_category":{"name":"Weapon"},
                         "weapon_category":"Simple","cost":{"quantity":1,"unit":"sp"},"weight":2,
                         "damage":{"damage_dice":"1d4","damage_type":{"name":"Bludgeoning"}},
                         "properties":[{"name":"Light"}],"desc":["A wooden club."],
                         "url":"/api/2014/equipment/club"}
                        """),
                "/api/2014/magic-items/adamantine-armor", json("""
                        {"index":"adamantine-armor","name":"Adamantine Armor",
                         "equipment_category":{"name":"Armor"},"rarity":{"name":"Uncommon"},
                         "desc":["Armor (medium or heavy, but not hide), uncommon"],
                         "url":"/api/2014/magic-items/adamantine-armor"}
                        """));
        Clock clock = Clock.fixed(Instant.parse("2026-07-16T12:00:00Z"), ZoneOffset.UTC);
        PublicSrdItemImporter importer = new PublicSrdItemImporter(responses::get, clock);
        Path database = temporaryDirectory.resolve("salt-marcher/game.db");

        PublicSrdItemImporter.ImportResult first = importer.importTo(database);
        PublicSrdItemImporter.ImportResult second = importer.importTo(database);

        assertEquals(2, first.itemCount());
        assertEquals(2, countRows(database));
        assertNotNull(second.backupPath());
        assertTrue(Files.isRegularFile(second.backupPath()));
    }

    private static int countRows(Path database) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM items")) {
            result.next();
            return result.getInt(1);
        }
    }

    private static JsonObject json(String source) {
        return JsonParser.parseString(source).getAsJsonObject();
    }
}
