package features.items.adapter.http;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.domain.importing.ImportedItem;
import java.util.Map;
import org.junit.jupiter.api.Test;

class Dnd5e2014HttpItemSourceTest {

    @Test
    void rejectsAPartialIndexBeforeFetchingAnyReplacementBatch() {
        Map<String, String> responses = Map.of(
                Dnd5e2014HttpItemSource.EQUIPMENT_INDEX,
                "{\"count\":2,\"results\":[{\"url\":\"/api/2014/equipment/club\"}]}");

        Dnd5e2014HttpItemSource source = new Dnd5e2014HttpItemSource(responses::get);

        assertThrows(IllegalStateException.class, source::fetchAll);
    }

    @Test
    void fetchesAndParsesEveryEntryFromBothPinnedIndexes() {
        Map<String, String> responses = Map.of(
                Dnd5e2014HttpItemSource.EQUIPMENT_INDEX,
                "{\"count\":1,\"results\":[{\"url\":\"/api/2014/equipment/club\"}]}",
                Dnd5e2014HttpItemSource.MAGIC_ITEM_INDEX,
                "{\"count\":1,\"results\":[{\"url\":\"/api/2014/magic-items/ring\"}]}",
                "/api/2014/equipment/club", """
                        {"index":"club","name":"Club","equipment_category":{"name":"Weapon"},
                         "weapon_category":"Simple","cost":{"quantity":1,"unit":"sp"},"weight":2,
                         "damage":{"damage_dice":"1d4","damage_type":{"name":"Bludgeoning"}},
                         "properties":[{"name":"Light"}],"desc":["A wooden club."],
                         "url":"/api/2014/equipment/club"}
                        """,
                "/api/2014/magic-items/ring", """
                        {"index":"ring","name":"Ring","equipment_category":{"name":"Adventuring Gear"},
                         "rarity":{"name":"Rare"},"desc":["Requires attunement by a bard."],
                         "url":"/api/2014/magic-items/ring"}
                        """);

        var items = new Dnd5e2014HttpItemSource(responses::get).fetchAll();

        assertEquals(2, items.size());
        ImportedItem equipment = items.getFirst();
        assertEquals(10, equipment.costCp());
        assertEquals("1d4 Bludgeoning", equipment.damage());
        assertEquals("Light", equipment.properties().getFirst());
        ImportedItem magicItem = items.getLast();
        assertTrue(magicItem.magic());
        assertTrue(magicItem.attunement());
        assertEquals("2014 SRD", magicItem.sourceVersion());
    }
}
