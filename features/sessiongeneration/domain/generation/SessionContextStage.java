package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Progression;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Rarity;
import features.sessiongeneration.domain.generation.GeneratedRun.PartyLevel;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class SessionContextStage {

    private static final BigDecimal OVERSTOCK_SHARE = new BigDecimal("0.20");

    Result calculate(GenerationInput input, CatalogSnapshot catalog) {
        Map<Integer, Progression> byLevel = new HashMap<>();
        catalog.progression().forEach(row -> byLevel.put(row.level(), row));
        int partyCount = input.party().stream().mapToInt(PartyLevel::players).sum();
        long dayXp = 0L;
        BigDecimal weightedGoldRate = BigDecimal.ZERO;
        List<BigDecimal> weightedMagicRates = new ArrayList<>(List.of(
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
        for (PartyLevel partyLevel : input.party()) {
            Progression progression = requireProgression(byLevel, partyLevel.level());
            dayXp += progression.dayXp() * partyLevel.players();
            weightedGoldRate = weightedGoldRate.add(
                    progression.goldPerXp().multiply(BigDecimal.valueOf(partyLevel.players())));
            for (int rarity = 0; rarity < weightedMagicRates.size(); rarity++) {
                weightedMagicRates.set(rarity, weightedMagicRates.get(rarity).add(
                        progression.magicRates().get(rarity).multiply(BigDecimal.valueOf(partyLevel.players()))));
            }
        }
        long sessionTarget = GenerationMath.rounded(input.adventureDayFraction().multiply(BigDecimal.valueOf(dayXp)));
        BigDecimal averageLevel = interpolateAverageLevel(dayXp, catalog.progression());
        BigDecimal perCharacterXp = BigDecimal.valueOf(sessionTarget)
                .divide(BigDecimal.valueOf(Math.max(1, partyCount)), 12, RoundingMode.HALF_UP);
        long normalBudget = GenerationMath.rounded(
                perCharacterXp.multiply(weightedGoldRate).multiply(BigDecimal.valueOf(100L)));
        long overstockBudget = GenerationMath.rounded(BigDecimal.valueOf(normalBudget).multiply(OVERSTOCK_SHARE));
        List<Rarity> magic = magicTargets(input.seed(), perCharacterXp, weightedMagicRates);
        int enhancedCap = Math.min(2, Math.max(1, input.adventureDayFraction().multiply(BigDecimal.valueOf(2L))
                .setScale(0, RoundingMode.CEILING).intValue()));
        int normalMagic = Math.min(magic.size(), enhancedCap);
        int overstockMagic = stochasticRound(
                normalMagic * 0.20,
                Math.floorMod(input.seed() + 4049L, 10_000L) / 10_000.0);
        int fullDayTreasures = GenerationMath.clamp(
                2 + Math.floorMod(input.seed() + 997L * 719L + 1009L, 3), 2, 4);
        int scaledTreasures = GenerationMath.rounded(input.adventureDayFraction().min(BigDecimal.ONE)
                .multiply(BigDecimal.valueOf(fullDayTreasures))) > Integer.MAX_VALUE
                ? Integer.MAX_VALUE
                : (int) GenerationMath.rounded(input.adventureDayFraction().min(BigDecimal.ONE)
                        .multiply(BigDecimal.valueOf(fullDayTreasures)));
        int treasureCount = Math.max(2, scaledTreasures);
        int fullDaySlots = 6 + (int) Math.floorMod(input.seed() + 1009L * 719L + 997L, 5L);
        int scaledSlots = (int) GenerationMath.rounded(input.adventureDayFraction().min(BigDecimal.ONE)
                .multiply(BigDecimal.valueOf(fullDaySlots)));
        int encounterCount = input.encounterCount().orElseGet(() -> automaticEncounterCount(input));
        SessionContext context = new SessionContext(
                partyCount, input.adventureDayFraction(), encounterCount, dayXp, sessionTarget, averageLevel,
                normalBudget, overstockBudget, Math.max(treasureCount, scaledSlots), normalMagic,
                overstockMagic, treasureCount);
        return new Result(context, magic.subList(0, Math.min(normalMagic, magic.size())));
    }

    private static int automaticEncounterCount(GenerationInput input) {
        double value = Math.abs(Math.sin((input.seed() + 409L) * 12.9898)) * 1_000_000.0;
        int fullDay = 6 + (int) Math.floorMod((long) Math.floor(value), 3L);
        return Math.max(1, (int) GenerationMath.rounded(
                input.adventureDayFraction().multiply(BigDecimal.valueOf(fullDay))));
    }

    private static List<Rarity> magicTargets(long seed, BigDecimal xp, List<BigDecimal> rates) {
        List<Rarity> result = new ArrayList<>();
        Rarity[] rarities = Rarity.values();
        for (int index = 0; index < rarities.length; index++) {
            BigDecimal expected = xp.multiply(rates.get(index));
            int base = expected.setScale(0, RoundingMode.FLOOR).intValue();
            double roll = Math.floorMod(seed + (index + 1L) * 997L, 10_000L) / 10_000.0;
            int target = base + (roll < expected.subtract(BigDecimal.valueOf(base)).doubleValue() ? 1 : 0);
            for (int count = 0; count < target; count++) result.add(rarities[index]);
        }
        result.sort(Comparator.comparingInt(SessionContextStage::rarityPriority));
        return List.copyOf(result);
    }

    private static int rarityPriority(Rarity rarity) {
        return switch (rarity) {
            case LEGENDARY -> 0;
            case VERY_RARE -> 1;
            case RARE -> 2;
            case UNCOMMON -> 3;
            case COMMON -> 4;
        };
    }

    private static BigDecimal interpolateAverageLevel(long dayXp, List<Progression> rows) {
        List<Progression> ordered = rows.stream().sorted(Comparator.comparingLong(Progression::dayXpPartyFour)).toList();
        if (dayXp <= ordered.getFirst().dayXpPartyFour()) return BigDecimal.valueOf(ordered.getFirst().level()).setScale(2);
        if (dayXp >= ordered.getLast().dayXpPartyFour()) return BigDecimal.valueOf(ordered.getLast().level()).setScale(2);
        for (int index = 0; index < ordered.size() - 1; index++) {
            Progression lower = ordered.get(index);
            Progression upper = ordered.get(index + 1);
            if (dayXp >= lower.dayXpPartyFour() && dayXp <= upper.dayXpPartyFour()) {
                BigDecimal fraction = BigDecimal.valueOf(dayXp - lower.dayXpPartyFour())
                        .divide(BigDecimal.valueOf(upper.dayXpPartyFour() - lower.dayXpPartyFour()), 8,
                                RoundingMode.HALF_UP);
                return BigDecimal.valueOf(lower.level()).add(fraction).setScale(2, RoundingMode.HALF_UP);
            }
        }
        throw new IllegalStateException("progression interpolation failed");
    }

    private static Progression requireProgression(Map<Integer, Progression> rows, int level) {
        Progression result = rows.get(level);
        if (result == null) throw new IllegalStateException("catalog progression is missing level " + level);
        return result;
    }

    private static int stochasticRound(double value, double roll) {
        int base = (int) Math.floor(value);
        return base + (roll < value - base ? 1 : 0);
    }

    record Result(SessionContext context, List<Rarity> magicRarities) {
        Result {
            magicRarities = List.copyOf(magicRarities);
        }
    }
}
