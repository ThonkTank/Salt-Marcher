package features.creaturecatalog.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MobAttackCalculatorTest {

    @Test
    void expectedHitsMatchesTableForNormalRoll() {
        assertEquals(4, MobAttackCalculator.expectedHits(1, 4, MobAttackCalculator.RollMode.NORMAL));
        assertEquals(6, MobAttackCalculator.expectedHits(10, 10, MobAttackCalculator.RollMode.NORMAL));
        assertEquals(0, MobAttackCalculator.expectedHits(20, 4, MobAttackCalculator.RollMode.NORMAL));
    }

    @Test
    void expectedHitsAppliesAdvantageAndDisadvantageMapping() {
        assertEquals(3, MobAttackCalculator.expectedHits(15, 6, MobAttackCalculator.RollMode.ADVANTAGE));
        assertEquals(1, MobAttackCalculator.expectedHits(15, 6, MobAttackCalculator.RollMode.DISADVANTAGE));
    }

    @Test
    void requiredRollIsClampedToDmgTableRange() {
        assertEquals(1, MobAttackCalculator.requiredRoll(5, 20));
        assertEquals(20, MobAttackCalculator.requiredRoll(30, 5));
    }
}
