package features.creaturecatalog.service;

/**
 * DMG mob-attack approximation table helper.
 */
public final class MobAttackCalculator {
    private MobAttackCalculator() {
        throw new AssertionError("No instances");
    }

    public enum RollMode {
        NORMAL,
        ADVANTAGE,
        DISADVANTAGE
    }

    private static final int MIN_REQUIRED_ROLL = 1;
    private static final int MAX_REQUIRED_ROLL = 20;

    // Rows 1..20, columns for mob size 4/5/6/8/10 in that order.
    private static final int[][] SUCCESS_TABLE = {
            {4, 5, 6, 8, 10},
            {4, 5, 6, 8, 10},
            {4, 5, 5, 7, 9},
            {3, 4, 5, 7, 9},
            {3, 4, 5, 6, 8},
            {3, 4, 5, 6, 8},
            {3, 4, 4, 6, 7},
            {3, 3, 4, 5, 7},
            {2, 3, 4, 5, 6},
            {2, 3, 3, 4, 6},
            {2, 3, 3, 4, 5},
            {2, 2, 3, 4, 5},
            {2, 2, 2, 3, 4},
            {1, 2, 2, 3, 4},
            {1, 2, 2, 2, 3},
            {1, 1, 2, 2, 3},
            {1, 1, 1, 2, 2},
            {1, 1, 1, 1, 2},
            {0, 1, 1, 1, 1},
            {0, 0, 0, 0, 1}
    };

    private static final int[] TABLE_MOB_SIZES = {4, 5, 6, 8, 10};
    private static final int[] ADVANTAGE_TO_NORMAL_ROW = buildAdvantageMap();
    private static final int[] DISADVANTAGE_TO_NORMAL_ROW = buildDisadvantageMap();

    public static int requiredRoll(int targetAc, int attackBonus) {
        return clampRequiredRoll(targetAc - attackBonus);
    }

    public static int expectedHits(int requiredRoll, int mobCount, RollMode rollMode) {
        int normalizedMobCount = clampMobCount(mobCount);
        int tableRow = toNormalTableRow(clampRequiredRoll(requiredRoll), rollMode);
        if (tableRow < MIN_REQUIRED_ROLL || tableRow > MAX_REQUIRED_ROLL) {
            return 0;
        }
        return successesForRowAndMobSize(tableRow, normalizedMobCount);
    }

    public static int clampMobCount(int mobCount) {
        return Math.max(TABLE_MOB_SIZES[0], Math.min(TABLE_MOB_SIZES[TABLE_MOB_SIZES.length - 1], mobCount));
    }

    private static int clampRequiredRoll(int requiredRoll) {
        return Math.max(MIN_REQUIRED_ROLL, Math.min(MAX_REQUIRED_ROLL, requiredRoll));
    }

    private static int toNormalTableRow(int requiredRoll, RollMode rollMode) {
        if (rollMode == RollMode.ADVANTAGE) {
            return ADVANTAGE_TO_NORMAL_ROW[requiredRoll];
        }
        if (rollMode == RollMode.DISADVANTAGE) {
            return DISADVANTAGE_TO_NORMAL_ROW[requiredRoll];
        }
        return requiredRoll;
    }

    private static int successesForRowAndMobSize(int row, int mobSize) {
        int rowIndex = row - 1;
        int exactColumn = indexOfSize(mobSize);
        if (exactColumn >= 0) {
            return SUCCESS_TABLE[rowIndex][exactColumn];
        }
        if (mobSize == 7) {
            return interpolate(rowIndex, 2, 3, mobSize); // between 6 and 8
        }
        if (mobSize == 9) {
            return interpolate(rowIndex, 3, 4, mobSize); // between 8 and 10
        }
        return SUCCESS_TABLE[rowIndex][0];
    }

    private static int interpolate(int rowIndex, int lowerCol, int upperCol, int mobSize) {
        int lowerSize = TABLE_MOB_SIZES[lowerCol];
        int upperSize = TABLE_MOB_SIZES[upperCol];
        int lowerHits = SUCCESS_TABLE[rowIndex][lowerCol];
        int upperHits = SUCCESS_TABLE[rowIndex][upperCol];
        double ratio = (mobSize - lowerSize) / (double) (upperSize - lowerSize);
        return (int) Math.round(lowerHits + (upperHits - lowerHits) * ratio);
    }

    private static int indexOfSize(int mobSize) {
        for (int i = 0; i < TABLE_MOB_SIZES.length; i++) {
            if (TABLE_MOB_SIZES[i] == mobSize) {
                return i;
            }
        }
        return -1;
    }

    private static int[] buildAdvantageMap() {
        int[] map = new int[21];
        for (int needed = 1; needed <= 4; needed++) map[needed] = 1;
        for (int needed = 5; needed <= 6; needed++) map[needed] = 2;
        for (int needed = 7; needed <= 8; needed++) map[needed] = 3;
        map[9] = 4;
        map[10] = 5;
        map[11] = 6;
        map[12] = 7;
        map[13] = 8;
        map[14] = 9;
        map[15] = 11;
        map[16] = 12;
        map[17] = 14;
        map[18] = 15;
        map[19] = 17;
        map[20] = 19;
        return map;
    }

    private static int[] buildDisadvantageMap() {
        int[] map = new int[21];
        map[1] = 1;
        map[2] = 3;
        map[3] = 5;
        map[4] = 7;
        map[5] = 8;
        map[6] = 10;
        map[7] = 11;
        map[8] = 13;
        map[9] = 14;
        map[10] = 15;
        map[11] = 16;
        map[12] = 17;
        map[13] = 18;
        map[14] = 19;
        map[15] = 19;
        map[16] = 20;
        map[17] = 20;
        map[18] = 21; // not listed in DMG table -> 0 expected hits
        map[19] = 21;
        map[20] = 21;
        return map;
    }
}
