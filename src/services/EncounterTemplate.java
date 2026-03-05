package services;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

import services.RoleClassifier.MonsterRole;

/**
 * Procedural shape generator for encounter structures.
 *
 * Tuning parameters:
 *   groupCount — number of creature groups (1-4, or -1 = auto)
 *   balance    — 0.0 = extremely dominant (boss+filler), 1.0 = all equally strong (-1 = auto)
 *   strength   — 0.0 = many weak (swarm), 1.0 = few elite (-1 = auto)
 */
public class EncounterTemplate {

    // Tuning constants for buildSpecs — derived empirically to produce encounter shapes
    // that feel right for 4-player parties in the CR 1-15 range. CR fractions are relative
    // to party average level (e.g. CR_BASE_MAX 0.25 = max CR is 25% of avg level at strength=0).
    private static final double CR_STR_SCALE     = 0.6;  // How strongly strength raises min CR fraction
    private static final double CR_BASE_MAX      = 0.25; // Base max CR fraction when strength=0 (many weak)
    private static final double CR_STR_MAX_SCALE = 2.0;  // How strongly strength raises max CR fraction
    private static final double CR_DOMINANT_BOOST = 0.3;  // CR bonus for dominant groups (budget fraction >= 0.5)
    private static final double CR_MEDIUM_BOOST   = 0.1;  // CR bonus for medium groups (budget fraction >= 0.3)
    private static final int    COUNT_MAX_BASE    = 10;   // Max creature count when strength=0 (swarm)
    private static final int    COUNT_MAX_SCALE   = 9;    // Reduction in max count at strength=1 (elite)
    private static final int    COUNT_MIN_BASE    = 4;    // Min creature count when strength=0
    private static final int    COUNT_MIN_SCALE   = 3;    // Reduction in min count at strength=1

    // Budget-fraction thresholds — midpoints used consistently in buildSpecs and pickRoles
    private static final double FRACTION_DOMINANT = 0.50; // >= this: dominant group (boss/leader role)
    private static final double FRACTION_MEDIUM   = 0.40; // >= this: medium group (strong support role)
    private static final double FRACTION_SUPPORT  = 0.30; // >= this: medium CR boost applies
    private static final double FRACTION_SWARM    = 0.25; // < this: swarm count bonus applies

    public static class SlotSpec {
        public final MonsterRole[] preferredRoles;
        public final double budgetFraction;
        public final int minCount;
        public final int maxCount;
        public final double minCrFraction;
        public final double maxCrFraction;

        public SlotSpec(MonsterRole[] roles, double budget, int min, int max,
                        double minCr, double maxCr) {
            this.preferredRoles = roles;
            this.budgetFraction = budget;
            this.minCount = min;
            this.maxCount = max;
            this.minCrFraction = minCr;
            this.maxCrFraction = maxCr;
        }
    }

    public record ShapeResult(SlotSpec[] specs, String label) {}

    // --- Haupt-API ---

    public static ShapeResult generateShape(String difficulty, int groupCount,
                                              double balance, double strength) {
        int groups = (groupCount >= 1 && groupCount <= 4)
                ? groupCount
                : rollGroupCount(difficulty);
        double bal = (balance < 0) ? ThreadLocalRandom.current().nextDouble() : balance;
        double str = (strength < 0) ? ThreadLocalRandom.current().nextDouble() : strength;

        double[] curve = buildPowerCurve(groups, bal);
        SlotSpec[] specs = buildSpecs(curve, str);

        return new ShapeResult(specs, deriveLabel(specs));
    }

    // --- Gruppenanzahl ---

    private static int rollGroupCount(String difficulty) {
        double r = ThreadLocalRandom.current().nextDouble();
        return switch (difficulty) {
            case "Easy"   -> r < 0.15 ? 1 : (r < 0.55 ? 2 : 3);
            case "Medium" -> r < 0.10 ? 1 : (r < 0.45 ? 2 : (r < 0.85 ? 3 : 4));
            case "Hard"   -> r < 0.15 ? 1 : (r < 0.50 ? 2 : (r < 0.85 ? 3 : 4));
            case "Deadly" -> r < 0.25 ? 1 : (r < 0.55 ? 2 : (r < 0.85 ? 3 : 4));
            default       -> r < 0.1  ? 1 : (r < 0.5  ? 2 : 3);
        };
    }

    // --- Power Curve ---

    private static double[] buildPowerCurve(int groups, double bal) {
        if (groups == 1) return new double[]{ 1.0 };

        double[] fractions = new double[groups];

        // bal=0 → extrem dominant: erste Gruppe bekommt fast alles
        // bal=1 → komplett gleich: jede Gruppe bekommt 1/n
        double equalShare = 1.0 / groups;
        double maxDominance = switch (groups) {
            case 2 -> 0.85;
            case 3 -> 0.70;
            default -> 0.60;
        };

        double firstShare = maxDominance + (equalShare - maxDominance) * bal;
        fractions[0] = firstShare;
        double remaining = 1.0 - firstShare;

        // Rest gleichmäßig verteilen
        for (int i = 1; i < groups; i++) {
            fractions[i] = remaining / (groups - 1);
        }

        return fractions;
    }

    // --- SlotSpecs: Strength bestimmt CR/Count direkt ---

    private static SlotSpec[] buildSpecs(double[] curve, double str) {
        SlotSpec[] specs = new SlotSpec[curve.length];
        Set<MonsterRole> usedPrimary = new HashSet<>();

        for (int i = 0; i < curve.length; i++) {
            double fraction = curve[i];

            // Rollen: fraction bestimmt welcher Pool (dominant vs. support)
            MonsterRole[] roles = pickRoles(usedPrimary, fraction);
            usedPrimary.add(roles[0]);

            // CR and count are primarily determined by strength parameter.
            // Strength controls the encounter feel: str=0 generates swarms of weak creatures,
            // while str=1 creates elite encounters with few high-CR creatures.
            // Fraction (budget share) provides a secondary influence: dominant groups (fraction >= 0.5)
            // receive a slight CR boost to make them tactically distinct from support roles.
            // Tuning rationale: strength=1 at party level 5 yields approximately CR 3-5 creatures,
            // matching D&D Dungeon Master's Guide elite encounter guidelines.
            double fractionBoost = (fraction >= FRACTION_DOMINANT) ? CR_DOMINANT_BOOST
                                 : (fraction >= FRACTION_SUPPORT)  ? CR_MEDIUM_BOOST : 0.0;
            double minCr = Math.max(0.0, str * CR_STR_SCALE + fractionBoost - 0.1);
            double maxCr = CR_BASE_MAX + str * CR_STR_MAX_SCALE + fractionBoost;

            double fractionCountBoost = (fraction < FRACTION_SWARM) ? 2.0
                                      : (fraction < FRACTION_MEDIUM) ? 1.0 : 0.0;
            int maxCount = Math.max(1, (int) Math.round(COUNT_MAX_BASE - str * COUNT_MAX_SCALE + fractionCountBoost));
            int minCount = Math.max(1, (int) Math.round(COUNT_MIN_BASE - str * COUNT_MIN_SCALE));
            if (minCount > maxCount) minCount = maxCount;

            specs[i] = new SlotSpec(roles, fraction, minCount, maxCount, minCr, maxCr);
        }

        return specs;
    }

    // --- Rollen-Auswahl ---

    private static final MonsterRole[][] ROLE_POOLS_DOMINANT = {
        { MonsterRole.BRUTE, MonsterRole.TANK },
        { MonsterRole.LEADER, MonsterRole.BRUTE },
        { MonsterRole.TANK, MonsterRole.LEADER },
        { MonsterRole.CONTROLLER, MonsterRole.LEADER },
    };

    private static final MonsterRole[][] ROLE_POOLS_SUPPORT = {
        { MonsterRole.SKIRMISHER, MonsterRole.BRUTE },
        { MonsterRole.BRUTE, MonsterRole.SKIRMISHER },
        { MonsterRole.ARTILLERY, MonsterRole.SKIRMISHER },
        { MonsterRole.CONTROLLER, MonsterRole.ARTILLERY },
        { MonsterRole.BRUTE, MonsterRole.ARTILLERY },
        { MonsterRole.TANK, MonsterRole.CONTROLLER },
    };

    private static MonsterRole[] pickRoles(Set<MonsterRole> usedPrimary, double fraction) {
        MonsterRole[][] pools = (fraction >= FRACTION_MEDIUM) ? ROLE_POOLS_DOMINANT : ROLE_POOLS_SUPPORT;

        List<MonsterRole[]> preferred = new ArrayList<>();
        List<MonsterRole[]> fallback = new ArrayList<>();
        for (MonsterRole[] pool : pools) {
            if (!usedPrimary.contains(pool[0])) preferred.add(pool);
            else fallback.add(pool);
        }

        List<MonsterRole[]> source = preferred.isEmpty() ? fallback : preferred;
        if (source.isEmpty()) source = List.of(pools);
        return source.get(ThreadLocalRandom.current().nextInt(source.size()));
    }

    // --- Label ---

    private static String deriveLabel(SlotSpec[] specs) {
        if (specs.length == 1) {
            if (specs[0].maxCount <= 1) return "Einzelgegner";
            return "Einzelgruppe";
        }

        boolean hasDominant = false;
        int totalMaxCount = 0;
        for (SlotSpec s : specs) {
            if (s.budgetFraction >= FRACTION_DOMINANT) hasDominant = true;
            totalMaxCount += s.maxCount;
        }

        if (totalMaxCount >= 15) return "Schwarm";
        if (hasDominant) return specs.length + " Gruppen, Anführer";
        return specs.length + " Gruppen, gemischt";
    }
}
