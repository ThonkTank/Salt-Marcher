package src.data.sessiongeneration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class TsvSessionGenerationCatalogTest {

    @Test
    void loadsTheCompleteSheetV1ReferenceSnapshot() {
        TsvSessionGenerationCatalog catalog = new TsvSessionGenerationCatalog();

        assertEquals(20, catalog.table("DB_Progression").size());
        assertEquals(680, catalog.table("DB_EncounterRoleBands").size());
        assertEquals(681, catalog.table("DB_LootItems").size());
        assertEquals(1698, catalog.table("DB_LootRelations").size());
        assertEquals(552, catalog.table("DB_MagicItems").size());
        assertEquals(300, catalog.table("DB_MagicCurses").size());
        assertEquals(TsvSessionGenerationCatalog.CONTENT_HASH, catalog.contentHash());
    }
}
