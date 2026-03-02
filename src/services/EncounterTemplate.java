package services;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import services.RoleClassifier.MonsterRole;

/**
 * Prozeduraler Shape-Generator für Encounter-Strukturen.
 *
 * Steuerparameter:
 *   groupCount — Anzahl Kreaturgruppen (1-4, oder -1 = auto)
 *   balance    — 0.0 = extrem dominant (Boss+Filler), 1.0 = alle gleich stark (-1 = auto)
 *   strength   — 0.0 = viele schwache (Schwarm), 1.0 = wenige starke (Elite) (-1 = auto)
 */
public class EncounterTemplate {

    // Tuning-Konstanten für buildSpecs
    private static final double CR_STR_SCALE     = 0.6;  // Wie stark Strength den Min-CR beeinflusst
    private static final double CR_BASE_MAX      = 0.25; // Basis-Max-CR bei str=0
    private static final double CR_STR_MAX_SCALE = 2.0;  // Wie stark Strength den Max-CR erhöht
    private static final double CR_DOMINANT_BOOST = 0.3;  // CR-Bonus für dominante Gruppen (fraction >= 0.5)
    private static final double CR_MEDIUM_BOOST   = 0.1;  // CR-Bonus für mittlere Gruppen (fraction >= 0.3)
    private static final int    COUNT_MAX_BASE    = 10;   // Max-Count bei str=0
    private static final int    COUNT_MAX_SCALE   = 9;    // Reduktion des Max-Count bei str=1
    private static final int    COUNT_MIN_BASE    = 4;    // Min-Count bei str=0
    private static final int    COUNT_MIN_SCALE   = 3;    // Reduktion des Min-Count bei str=1

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
        double bal = (balance < 0) ? Math.random() : balance;
        double str = (strength < 0) ? Math.random() : strength;

        double[] curve = buildPowerCurve(groups, bal);
        SlotSpec[] specs = buildSpecs(curve, str);

        return new ShapeResult(specs, deriveLabel(specs));
    }

    // --- Gruppenanzahl ---

    private static int rollGroupCount(String difficulty) {
        double r = Math.random();
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

            // CR und Count werden primär von strength bestimmt.
            // fraction beeinflusst nur sekundär (dominante Gruppen etwas stärker).

            // CR-Bereich: str=0 → niedrig, str=1 → hoch
            //   str=0: minCr=0.0, maxCr=0.25
            //   str=0.5: minCr=0.2, maxCr=1.0
            //   str=1: minCr=0.5, maxCr=2.5
            // Dominante Gruppen (fraction >= 0.5) bekommen nochmal +0.2 auf CR
            double fractionBoost = (fraction >= 0.5) ? CR_DOMINANT_BOOST
                                 : (fraction >= 0.3) ? CR_MEDIUM_BOOST : 0.0;
            double minCr = Math.max(0.0, str * CR_STR_SCALE + fractionBoost - 0.1);
            double maxCr = CR_BASE_MAX + str * CR_STR_MAX_SCALE + fractionBoost;

            double fractionCountBoost = (fraction < 0.25) ? 2.0 : (fraction < 0.4 ? 1.0 : 0.0);
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
        MonsterRole[][] pools = (fraction >= 0.40) ? ROLE_POOLS_DOMINANT : ROLE_POOLS_SUPPORT;

        List<MonsterRole[]> preferred = new ArrayList<>();
        List<MonsterRole[]> fallback = new ArrayList<>();
        for (MonsterRole[] pool : pools) {
            if (!usedPrimary.contains(pool[0])) preferred.add(pool);
            else fallback.add(pool);
        }

        List<MonsterRole[]> source = preferred.isEmpty() ? fallback : preferred;
        if (source.isEmpty()) source = List.of(pools);
        return source.get((int) (Math.random() * source.size()));
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
            if (s.budgetFraction >= 0.50) hasDominant = true;
            totalMaxCount += s.maxCount;
        }

        if (totalMaxCount >= 15) return "Schwarm";
        if (hasDominant) return specs.length + " Gruppen, Anführer";
        return specs.length + " Gruppen, gemischt";
    }

    // --- Hilfsmethoden ---

    public static double crToNumber(String cr) {
        if (cr == null) return 0;
        return switch (cr.trim()) {
            case "0"   -> 0;
            case "1/8" -> 0.125;
            case "1/4" -> 0.25;
            case "1/2" -> 0.5;
            default -> {
                try { yield Double.parseDouble(cr.trim()); }
                catch (NumberFormatException e) { yield 0; }
            }
        };
    }
}
