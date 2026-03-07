package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import features.creaturecatalog.model.Creature;
import features.gamerules.model.MonsterRole;
import features.gamerules.model.MonsterRoleParser;

final class CandidateScorer {

    private CandidateScorer() {}

    static double scoreCandidate(Creature c,
                                 MonsterRole role,
                                 int targetXpPerCreature,
                                 int globalMinXp,
                                 int globalMaxXp,
                                 double amountValue,
                                 int balanceLevel,
                                 List<Creature> picked,
                                 Map<Long, MonsterRole> roleMap,
                                 Map<Long, Integer> selectionWeights) {
        return closenessWeight(c.XP, targetXpPerCreature)
                * amountXpBias(c.XP, globalMinXp, globalMaxXp, amountValue)
                * balancePairWeight(c, picked, globalMinXp, globalMaxXp, balanceLevel)
                * diversityWeight(c, role, picked, roleMap)
                * tableSelectionWeight(c.Id, selectionWeights);
    }

    static int weightedRandomIndex(List<Double> weights) {
        return weightedRandomIndex(weights, null);
    }

    static int weightedRandomIndex(List<Double> weights, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        double total = 0.0;
        for (double w : weights) total += Math.max(0.0, w);
        if (total <= 0.0) return ctx.nextInt(weights.size());
        double roll = ctx.nextDouble() * total;
        double c = 0.0;
        for (int i = 0; i < weights.size(); i++) {
            c += Math.max(0.0, weights.get(i));
            if (roll <= c) return i;
        }
        return weights.size() - 1;
    }

    static List<Creature> filterUsable(List<Creature> candidates, int xpCeiling, double maxAllowedCr) {
        List<Creature> out = new ArrayList<>();
        Set<Long> seenIds = new HashSet<>();
        for (Creature c : candidates) {
            if (c == null || c.Id == null) continue;
            if (!seenIds.add(c.Id)) continue;
            if (c.XP <= 0) continue;
            if (c.XP > xpCeiling) continue;
            if (c.CR != null && c.CR.numeric > maxAllowedCr) continue;
            out.add(c);
        }
        return out;
    }

    static MonsterRole parseRole(String role) {
        return MonsterRoleParser.parseOrBrute(role);
    }

    private static double closenessWeight(int xp, int targetXp) {
        int d = Math.abs(xp - targetXp);
        return 1.0 / (1.0 + (d / (double) Math.max(25, targetXp)) * 2.5);
    }

    private static double amountXpBias(int xp, int minXp, int maxXp, double amountValue) {
        if (minXp >= maxXp) return 1.0;
        double x = (xp - minXp) / (double) (maxXp - minXp);
        x = Math.max(0.0, Math.min(1.0, x));
        double highXpPreference = (3.0 - amountValue) / 2.0;
        return Math.exp(highXpPreference * (x - 0.5) * 3.0);
    }

    private static double balancePairWeight(Creature c,
                                            List<Creature> picked,
                                            int minXp,
                                            int maxXp,
                                            int balanceLevel) {
        if (picked.isEmpty() || minXp >= maxXp) return 1.0;

        double mean = 0.0;
        for (Creature p : picked) mean += p.XP;
        mean /= picked.size();

        double dist = Math.abs(c.XP - mean) / (double) (maxXp - minXp);
        dist = Math.max(0.0, Math.min(1.0, dist));

        return switch (balanceLevel) {
            case 1 -> 0.5 + dist * 1.5;
            case 2 -> 0.75 + dist;
            case 3 -> 1.0;
            case 4 -> 0.75 + (1.0 - dist);
            case 5 -> 0.5 + (1.0 - dist) * 1.5;
            default -> 1.0;
        };
    }

    private static double diversityWeight(Creature c,
                                          MonsterRole role,
                                          List<Creature> picked,
                                          Map<Long, MonsterRole> roleMap) {
        if (picked.isEmpty()) return 1.0;
        boolean sameTypeSeen = false;
        boolean sameRoleSeen = false;
        for (Creature p : picked) {
            if (p.CreatureType != null && p.CreatureType.equals(c.CreatureType)) sameTypeSeen = true;
            if (roleMap.getOrDefault(p.Id, MonsterRole.BRUTE) == role) sameRoleSeen = true;
        }
        double w = 1.0;
        if (!sameTypeSeen) w += 0.3;
        else w *= 0.85;
        if (!sameRoleSeen) w += 0.25;
        else w *= 0.85;
        return w;
    }

    private static double tableSelectionWeight(Long creatureId, Map<Long, Integer> selectionWeights) {
        return Math.max(1, selectionWeights.getOrDefault(creatureId, 1));
    }
}
