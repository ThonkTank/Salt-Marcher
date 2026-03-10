package features.gamerules.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Physical loot representation with explicit coin denominations.
 *
 * <p>Equality is denomination-sensitive by design (for example {@code 1 pp != 10 gp}).
 * Use {@link #totalCpValue()} only for backend calculations that need a numeric value.
 */
public record LootCoins(int platinum, int gold, int silver, int copper) {
    public static final int CP_PER_SP = 10;
    public static final int CP_PER_GP = 100;
    public static final int CP_PER_PP = 1000;

    private static final LootCoins ZERO = new LootCoins(0, 0, 0, 0);

    public LootCoins {
        if (platinum < 0 || gold < 0 || silver < 0 || copper < 0) {
            throw new IllegalArgumentException("coin values must be >= 0");
        }
    }

    public static LootCoins zero() {
        return ZERO;
    }

    public static LootCoins ofCp(int totalCp) {
        if (totalCp < 0) {
            throw new IllegalArgumentException("totalCp must be >= 0");
        }
        if (totalCp == 0) {
            return ZERO;
        }
        int pp = totalCp / CP_PER_PP;
        int remAfterPp = totalCp % CP_PER_PP;
        int gp = remAfterPp / CP_PER_GP;
        int remAfterGp = remAfterPp % CP_PER_GP;
        int sp = remAfterGp / CP_PER_SP;
        int cp = remAfterGp % CP_PER_SP;
        return new LootCoins(pp, gp, sp, cp);
    }

    public static LootCoins ofGold(int gold) {
        if (gold < 0) {
            throw new IllegalArgumentException("gold must be >= 0");
        }
        return fromDenominations(0, gold, 0, 0);
    }

    public static LootCoins fromDenominations(int platinum, int gold, int silver, int copper) {
        if (platinum == 0 && gold == 0 && silver == 0 && copper == 0) return ZERO;
        return new LootCoins(platinum, gold, silver, copper);
    }

    public int totalCpValue() {
        int total = 0;
        total = Math.addExact(total, Math.multiplyExact(platinum, CP_PER_PP));
        total = Math.addExact(total, Math.multiplyExact(gold, CP_PER_GP));
        total = Math.addExact(total, Math.multiplyExact(silver, CP_PER_SP));
        total = Math.addExact(total, copper);
        return total;
    }

    public LootCoins plus(LootCoins other) {
        if (other == null || other.totalCpValue() == 0) {
            return this;
        }
        return fromDenominations(
                Math.addExact(platinum, other.platinum),
                Math.addExact(gold, other.gold),
                Math.addExact(silver, other.silver),
                Math.addExact(copper, other.copper));
    }

    public LootCoins dividedBy(int divisor) {
        if (divisor <= 0) {
            throw new IllegalArgumentException("divisor must be > 0");
        }
        return ofCp(totalCpValue() / divisor);
    }

    public String formatCompact() {
        if (totalCpValue() == 0) {
            return "0 cp";
        }
        List<String> parts = new ArrayList<>(4);
        if (platinum > 0) parts.add(platinum + " pp");
        if (gold > 0) parts.add(gold + " gp");
        if (silver > 0) parts.add(silver + " sp");
        if (copper > 0) parts.add(copper + " cp");
        return String.join(" ", parts);
    }
}
