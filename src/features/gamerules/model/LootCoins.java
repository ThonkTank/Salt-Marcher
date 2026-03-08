package features.gamerules.model;

import java.util.ArrayList;
import java.util.List;

/** Canonical loot value object using copper pieces as internal unit. */
public record LootCoins(int totalCp) {
    public static final int CP_PER_SP = 10;
    public static final int CP_PER_GP = 100;
    public static final int CP_PER_PP = 1000;

    private static final LootCoins ZERO = new LootCoins(0);

    public LootCoins {
        if (totalCp < 0) {
            throw new IllegalArgumentException("totalCp must be >= 0");
        }
    }

    public static LootCoins zero() {
        return ZERO;
    }

    public static LootCoins ofCp(int totalCp) {
        return totalCp == 0 ? ZERO : new LootCoins(totalCp);
    }

    public static LootCoins ofGold(int gold) {
        if (gold < 0) {
            throw new IllegalArgumentException("gold must be >= 0");
        }
        return ofCp(Math.multiplyExact(gold, CP_PER_GP));
    }

    public static LootCoins fromDenominations(int platinum, int gold, int silver, int copper) {
        if (platinum < 0 || gold < 0 || silver < 0 || copper < 0) {
            throw new IllegalArgumentException("coin values must be >= 0");
        }
        int total = 0;
        total = Math.addExact(total, Math.multiplyExact(platinum, CP_PER_PP));
        total = Math.addExact(total, Math.multiplyExact(gold, CP_PER_GP));
        total = Math.addExact(total, Math.multiplyExact(silver, CP_PER_SP));
        total = Math.addExact(total, copper);
        return ofCp(total);
    }

    public LootCoins plus(LootCoins other) {
        if (other == null || other.totalCp == 0) {
            return this;
        }
        return ofCp(Math.addExact(totalCp, other.totalCp));
    }

    public LootCoins dividedBy(int divisor) {
        if (divisor <= 0) {
            throw new IllegalArgumentException("divisor must be > 0");
        }
        return ofCp(totalCp / divisor);
    }

    public int platinum() {
        return totalCp / CP_PER_PP;
    }

    public int gold() {
        return (totalCp % CP_PER_PP) / CP_PER_GP;
    }

    public int silver() {
        return (totalCp % CP_PER_GP) / CP_PER_SP;
    }

    public int copper() {
        return totalCp % CP_PER_SP;
    }

    public String formatCompact() {
        if (totalCp == 0) {
            return "0 cp";
        }
        List<String> parts = new ArrayList<>(4);
        int pp = platinum();
        int gp = gold();
        int sp = silver();
        int cp = copper();
        if (pp > 0) parts.add(pp + " pp");
        if (gp > 0) parts.add(gp + " gp");
        if (sp > 0) parts.add(sp + " sp");
        if (cp > 0) parts.add(cp + " cp");
        return String.join(" ", parts);
    }
}
