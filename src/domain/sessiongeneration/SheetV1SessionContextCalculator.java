package src.domain.sessiongeneration;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessiongeneration.GenerationResult.RarityTarget;
import src.domain.sessiongeneration.GenerationResult.SessionContext;

final class SheetV1SessionContextCalculator {

    private static final List<String> RARITY_PRIORITY =
            List.of("Legendary", "Very Rare", "Rare", "Uncommon", "Common");

    private final List<Map<String, String>> progression;

    SheetV1SessionContextCalculator(SessionGenerationCatalog catalog) {
        progression = catalog.table("DB_Progression");
    }

    SessionContext calculate(GenerationRequest request) {
        int partyCount = request.playersByLevel().values().stream().mapToInt(Integer::intValue).sum();
        int dayXp = sumByLevel(request, "Day_XP_Per_Character");
        int sessionXp = round(BigDecimal.valueOf(dayXp).multiply(request.adventureDayFraction()));
        BigDecimal averageLevel = interpolatedAverageLevel(dayXp);
        BigDecimal weightedGoldRate = weightedRate(request, "Gold_Per_XP");
        BigDecimal preciseNormalBudget = BigDecimal.valueOf(sessionXp)
                .divide(BigDecimal.valueOf(Math.max(1, partyCount)), 12, RoundingMode.HALF_UP)
                .multiply(weightedGoldRate)
                .multiply(BigDecimal.valueOf(100));
        long normalBudget = preciseNormalBudget.setScale(0, RoundingMode.HALF_UP).longValue();
        long overstockBudget = preciseNormalBudget.multiply(new BigDecimal("0.20"))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
        List<RarityTarget> rarityTargets = rarityTargets(request, partyCount, sessionXp);
        int treasureCount = treasureCount(request);
        int nonMagicSlots = Math.max(treasureCount, round(BigDecimal.valueOf(fullDaySlots(request.seed()))
                .multiply(clampOne(request.adventureDayFraction()))));
        return new SessionContext(
                partyCount,
                dayXp,
                sessionXp,
                averageLevel,
                normalBudget,
                overstockBudget,
                nonMagicSlots,
                treasureCount,
                rarityTargets);
    }

    int threshold(GenerationRequest request, String column) {
        return sumByLevel(request, column);
    }

    private List<RarityTarget> rarityTargets(GenerationRequest request, int partyCount, int sessionXp) {
        Map<String, Integer> desired = new LinkedHashMap<>();
        List<String> naturalOrder = List.of("Common", "Uncommon", "Rare", "Very Rare", "Legendary");
        for (int index = 0; index < naturalOrder.size(); index++) {
            String rarity = naturalOrder.get(index);
            BigDecimal expected = BigDecimal.valueOf(sessionXp)
                    .divide(BigDecimal.valueOf(Math.max(1, partyCount)), 12, RoundingMode.HALF_UP)
                    .multiply(weightedRate(request, columnFor(rarity)));
            int base = expected.setScale(0, RoundingMode.FLOOR).intValue();
            BigDecimal fraction = expected.subtract(BigDecimal.valueOf(base));
            double roll = Math.floorMod(request.seed() + (long) (index + 1) * 997L, 10_000L) / 10_000d;
            desired.put(rarity, base + (roll < fraction.doubleValue() ? 1 : 0));
        }
        int rawMagic = desired.values().stream().mapToInt(Integer::intValue).sum();
        int cap = Math.min(2, Math.max(1, request.adventureDayFraction()
                .multiply(BigDecimal.valueOf(2)).setScale(0, RoundingMode.CEILING).intValue()));
        int effective = Math.min(rawMagic, cap);
        Map<String, Integer> normal = allocateByPriority(desired, effective);
        double expectedOverstock = effective * 0.20d;
        int overstock = (int) Math.floor(expectedOverstock);
        double fraction = expectedOverstock - overstock;
        double roll = Math.floorMod(request.seed() + 5L * 997L, 10_000L) / 10_000d;
        if (roll < fraction) {
            overstock++;
        }
        Map<String, Integer> overstockByRarity = allocateByPriority(normal, overstock);
        List<RarityTarget> result = new ArrayList<>();
        for (String rarity : naturalOrder) {
            result.add(new RarityTarget(
                    rarity,
                    normal.getOrDefault(rarity, 0),
                    overstockByRarity.getOrDefault(rarity, 0)));
        }
        return List.copyOf(result);
    }

    private static Map<String, Integer> allocateByPriority(Map<String, Integer> available, int count) {
        Map<String, Integer> result = new LinkedHashMap<>();
        int remaining = count;
        for (String rarity : RARITY_PRIORITY) {
            int assigned = Math.min(available.getOrDefault(rarity, 0), remaining);
            result.put(rarity, assigned);
            remaining -= assigned;
        }
        return result;
    }

    private int treasureCount(GenerationRequest request) {
        int fullDay = clamp(3 - 1 + (int) Math.floorMod(request.seed() + 997L * 719L + 1009L, 3L), 2, 4);
        int scaled = round(BigDecimal.valueOf(fullDay).multiply(clampOne(request.adventureDayFraction())));
        return Math.max(2, scaled);
    }

    private static int fullDaySlots(long seed) {
        return 6 + (int) Math.floorMod(seed + 1009L * 719L + 997L, 5L);
    }

    private BigDecimal interpolatedAverageLevel(int dayXp) {
        List<Map<String, String>> sorted = progression.stream()
                .sorted(Comparator.comparingDouble(row -> number(row, "Day_XP_Party_4")))
                .toList();
        if (dayXp <= number(sorted.get(0), "Day_XP_Party_4")) {
            return decimal(sorted.get(0), "Level").setScale(2, RoundingMode.HALF_UP);
        }
        for (int index = 0; index < sorted.size() - 1; index++) {
            Map<String, String> lower = sorted.get(index);
            Map<String, String> upper = sorted.get(index + 1);
            double lowerXp = number(lower, "Day_XP_Party_4");
            double upperXp = number(upper, "Day_XP_Party_4");
            if (dayXp <= upperXp) {
                double ratio = (dayXp - lowerXp) / Math.max(1d, upperXp - lowerXp);
                double level = number(lower, "Level") + ratio * (number(upper, "Level") - number(lower, "Level"));
                return BigDecimal.valueOf(level).setScale(2, RoundingMode.HALF_UP);
            }
        }
        return decimal(sorted.get(sorted.size() - 1), "Level").setScale(2, RoundingMode.HALF_UP);
    }

    private int sumByLevel(GenerationRequest request, String column) {
        BigDecimal result = BigDecimal.ZERO;
        for (Map.Entry<Integer, Integer> entry : request.playersByLevel().entrySet()) {
            result = result.add(decimal(rowForLevel(entry.getKey()), column).multiply(BigDecimal.valueOf(entry.getValue())));
        }
        return round(result);
    }

    private BigDecimal weightedRate(GenerationRequest request, String column) {
        BigDecimal result = BigDecimal.ZERO;
        for (Map.Entry<Integer, Integer> entry : request.playersByLevel().entrySet()) {
            result = result.add(decimal(rowForLevel(entry.getKey()), column).multiply(BigDecimal.valueOf(entry.getValue())));
        }
        return result;
    }

    private Map<String, String> rowForLevel(int level) {
        return progression.stream()
                .filter(row -> (int) number(row, "Level") == level)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Missing progression level " + level));
    }

    private static String columnFor(String rarity) {
        return rarity.replace(" ", "_") + "_Per_XP";
    }

    static BigDecimal decimal(Map<String, String> row, String column) {
        String value = row.getOrDefault(column, "");
        return value.isBlank() ? BigDecimal.ZERO : new BigDecimal(value);
    }

    static double number(Map<String, String> row, String column) {
        return decimal(row, column).doubleValue();
    }

    static boolean active(Map<String, String> row) {
        return Boolean.parseBoolean(row.getOrDefault("Active", "false"));
    }

    static int round(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private static BigDecimal clampOne(BigDecimal value) {
        return value.max(BigDecimal.ZERO).min(BigDecimal.ONE);
    }

    private static int clamp(int value, int minimum, int maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
