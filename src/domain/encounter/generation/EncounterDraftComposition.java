package src.domain.encounter.generation;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

record EncounterDraftComposition(
        boolean valid,
        List<EncounterDraftEntry> entries,
        EncounterDraftCompositionStats stats,
        Set<String> roles
) {

    private static final int MAX_CREATURES_PER_DRAFT = 8;
    private static final int MAX_BOSSES_PER_DRAFT = 1;

    static EncounterDraftComposition from(
            Map<Long, Integer> counts,
            Map<Long, EncounterCandidateProfile> profiles
    ) {
        if (counts.isEmpty()) {
            return invalid();
        }
        EncounterDraftCompositionAccumulator accumulator = new EncounterDraftCompositionAccumulator();
        for (Map.Entry<Long, Integer> countEntry : counts.entrySet()) {
            EncounterCandidateProfile profile = profiles.get(countEntry.getKey());
            if (profile == null) {
                return invalid();
            }
            accumulator.add(profile, countEntry.getValue());
        }
        return new EncounterDraftComposition(
                validStats(accumulator.stats()),
                accumulator.entries(),
                accumulator.stats(),
                accumulator.roles());
    }

    private static boolean validStats(EncounterDraftCompositionStats stats) {
        return stats.creatureCount() <= MAX_CREATURES_PER_DRAFT
                && stats.bossCount() <= MAX_BOSSES_PER_DRAFT
                && stats.totalBaseXp() > 0;
    }

    private static EncounterDraftComposition invalid() {
        return new EncounterDraftComposition(
                false,
                List.of(),
                new EncounterDraftCompositionStats(0, 0, 0),
                Set.of());
    }

    private static final class EncounterDraftCompositionAccumulator {

        private final List<EncounterDraftEntry> entries = new ArrayList<>();
        private final Set<String> roles = new LinkedHashSet<>();
        private int totalBaseXp;
        private int creatureCount;
        private int bossCount;

        private void add(EncounterCandidateProfile profile, int requestedQuantity) {
            int quantity = Math.max(1, requestedQuantity);
            creatureCount += quantity;
            totalBaseXp += profile.xp() * quantity;
            if (EncounterRoleNames.BOSS.equals(profile.role)) {
                bossCount += quantity;
            }
            roles.add(profile.role);
            entries.add(new EncounterDraftEntry(profile, quantity));
        }

        private List<EncounterDraftEntry> entries() {
            return List.copyOf(entries);
        }

        private EncounterDraftCompositionStats stats() {
            return new EncounterDraftCompositionStats(totalBaseXp, creatureCount, bossCount);
        }

        private Set<String> roles() {
            return Set.copyOf(roles);
        }
    }
}
