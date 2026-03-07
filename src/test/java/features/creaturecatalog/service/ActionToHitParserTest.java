package features.creaturecatalog.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ActionToHitParserTest {

    @Test
    void extractToHitBonusParsesPositiveBonus() {
        String description = "Melee Weapon Attack: +7 to hit, reach 5 ft., one target.";
        assertEquals(7, ActionToHitParser.extractToHitBonus(description));
    }

    @Test
    void extractToHitBonusParsesNegativeBonus() {
        String description = "Ranged Spell Attack: -1 to hit, range 30 ft., one target.";
        assertEquals(-1, ActionToHitParser.extractToHitBonus(description));
    }

    @Test
    void extractToHitBonusReturnsNullWhenMissing() {
        String description = "Each creature in a 10-foot cone must make a DC 13 Dex save.";
        assertNull(ActionToHitParser.extractToHitBonus(description));
    }
}
