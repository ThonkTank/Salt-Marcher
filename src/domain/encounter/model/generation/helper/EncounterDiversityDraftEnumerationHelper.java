package src.domain.encounter.model.generation.helper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterProfileCopies;

final class EncounterDiversityDraftEnumerationHelper {

    private static final int DIVERSITY_POOL_LIMIT = 12;

    private EncounterDiversityDraftEnumerationHelper() {
    }

    static void append(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        EncounterTuningTargets targets =
                EncounterTuningTargetHelper.targetsFor(request.tuning(), request.partySize());
        int additionalDistinct = targets.targetDistinctStatBlocks() - baseCounts.size();
        if (additionalDistinct <= 2 || pool.size() < additionalDistinct) {
            return;
        }
        List<EncounterCandidateProfile> candidates = pool.subList(0, Math.min(pool.size(), DIVERSITY_POOL_LIMIT));
        appendCombinations(new DiversityDraftRequest(
                drafts,
                profiles,
                request,
                baseCounts,
                candidates,
                additionalDistinct,
                targets.targetCreatureCount()), new ArrayList<>(), 0);
    }

    private static void appendCombinations(
            DiversityDraftRequest diversityRequest,
            List<EncounterCandidateProfile> selected,
            int startIndex
    ) {
        if (selected.size() == diversityRequest.additionalDistinct) {
            appendSelected(diversityRequest, selected);
            return;
        }
        int remaining = diversityRequest.additionalDistinct - selected.size();
        for (int index = startIndex; index <= diversityRequest.candidates.size() - remaining; index++) {
            selected.add(diversityRequest.candidates.get(index));
            appendCombinations(diversityRequest, selected, index + 1);
            selected.removeLast();
        }
    }

    private static void appendSelected(DiversityDraftRequest diversityRequest, List<EncounterCandidateProfile> selected) {
        Map<Long, Integer> counts = new LinkedHashMap<>(diversityRequest.baseCounts);
        for (EncounterCandidateProfile profile : selected) {
            counts.merge(profile.id(), 1, Integer::sum);
        }
        topUpCounts(counts, selected, diversityRequest.targetCreatureCount);
        EncounterDraftCollectionHelper.add(
                diversityRequest.drafts,
                diversityRequest.profiles,
                diversityRequest.request,
                counts);
    }

    private static void topUpCounts(
            Map<Long, Integer> counts,
            List<EncounterCandidateProfile> selected,
            int targetCreatureCount
    ) {
        int creatureCount = counts.values().stream().mapToInt(Integer::intValue).sum();
        if (creatureCount >= targetCreatureCount || selected.isEmpty()) {
            return;
        }
        for (EncounterCandidateProfile profile : byLowXp(selected)) {
            creatureCount = topUpProfile(counts, profile, creatureCount, targetCreatureCount);
            if (creatureCount >= targetCreatureCount) {
                return;
            }
        }
    }

    private static List<EncounterCandidateProfile> byLowXp(List<EncounterCandidateProfile> selected) {
        return selected.stream()
                .sorted(Comparator.comparingInt(EncounterCandidateProfile::xp)
                        .thenComparing(EncounterCandidateProfile::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static int topUpProfile(
            Map<Long, Integer> counts,
            EncounterCandidateProfile profile,
            int creatureCount,
            int targetCreatureCount
    ) {
        int current = counts.getOrDefault(profile.id(), 0);
        while (creatureCount < targetCreatureCount
                && current < EncounterProfileCopies.maxAdditionalCopies(profile)) {
            current++;
            creatureCount++;
            counts.put(profile.id(), current);
        }
        return creatureCount;
    }

    private static final class DiversityDraftRequest {

        private final Map<String, EncounterDraft> drafts;
        private final Map<Long, EncounterCandidateProfile> profiles;
        private final EncounterDraftBuildRequest request;
        private final Map<Long, Integer> baseCounts;
        private final List<EncounterCandidateProfile> candidates;
        private final int additionalDistinct;
        private final int targetCreatureCount;

        private DiversityDraftRequest(
                Map<String, EncounterDraft> drafts,
                Map<Long, EncounterCandidateProfile> profiles,
                EncounterDraftBuildRequest request,
                Map<Long, Integer> baseCounts,
                List<EncounterCandidateProfile> candidates,
                int additionalDistinct,
                int targetCreatureCount
        ) {
            this.drafts = drafts;
            this.profiles = profiles;
            this.request = request;
            this.baseCounts = baseCounts;
            this.candidates = candidates;
            this.additionalDistinct = additionalDistinct;
            this.targetCreatureCount = targetCreatureCount;
        }
    }
}
