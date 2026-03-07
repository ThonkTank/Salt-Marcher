package features.encountertable.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EncounterTableNameNormalizerTest {
    @Test
    void normalizeForStorageStripsWhitespace() {
        assertEquals("Forest Ambush", EncounterTableNameNormalizer.normalizeForStorage("  Forest Ambush  "));
    }

    @Test
    void normalizeForComparisonCollapsesCaseAndWhitespace() {
        String left = EncounterTableNameNormalizer.normalizeForComparison("  FOREST Ambush  ");
        String right = EncounterTableNameNormalizer.normalizeForComparison("forest ambush");
        assertEquals(right, left);
    }

    @Test
    void isBlankForStorageReturnsTrueForNullAndWhitespace() {
        assertTrue(EncounterTableNameNormalizer.isBlankForStorage(null));
        assertTrue(EncounterTableNameNormalizer.isBlankForStorage("   "));
    }
}
