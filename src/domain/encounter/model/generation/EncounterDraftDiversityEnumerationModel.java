package src.domain.encounter.model.generation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterDraftDiversityEnumerationModel {

    private static final int DIVERSITY_POOL_LIMIT = 12;

    private EncounterDraftDiversityEnumerationModel() {
    }

    static void appendDiversityDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        EncounterTuningTargets targets = EncounterTuningTargetModel.targetsFor(request.tuning(), request.partySize());
        int additionalDistinct = targets.targetDistinctStatBlocks() - baseCounts.size();
        if (additionalDistinct <= 2 || pool.size() < additionalDistinct) {
            return;
        }
        List<EncounterCandidateProfile> candidates = pool.subList(0, Math.min(pool.size(), DIVERSITY_POOL_LIMIT));
        appendCombinations(
                new DiversityDraftRequest(drafts, profiles, request, baseCounts, targets.targetCreatureCount()),
                candidates,
                additionalDistinct,
                new ArrayList<>(),
                0);
    }

    private static void appendCombinations(
            DiversityDraftRequest diversityRequest,
            List<EncounterCandidateProfile> candidates,
            int additionalDistinct,
            List<EncounterCandidateProfile> selected,
            int startIndex
    ) {
        if (selected.size() == additionalDistinct) {
            appendSelected(diversityRequest, selected);
            return;
        }
        int remaining = additionalDistinct - selected.size();
        for (int index = startIndex; index <= candidates.size() - remaining; index++) {
            selected.add(candidates.get(index));
            appendCombinations(diversityRequest, candidates, additionalDistinct, selected, index + 1);
            selected.remove(selected.size() - 1);
        }
    }

    private static void appendSelected(DiversityDraftRequest diversityRequest, List<EncounterCandidateProfile> selected) {
        Map<Long, Integer> counts = new LinkedHashMap<>(diversityRequest.baseCounts);
        for (EncounterCandidateProfile profile : selected) {
            EncounterDraftEnumerationModel.addCount(counts, profile.id(), 1);
        }
        topUpCounts(counts, selected, diversityRequest.targetCreatureCount);
        EncounterDraftEnumerationModel.addDraft(
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
        int creatureCount = 0;
        for (Integer count : counts.values()) {
            creatureCount += count == null ? 0 : count;
        }
        if (creatureCount >= targetCreatureCount || selected.isEmpty()) {
            return;
        }
        for (EncounterCandidateProfile profile : EncounterSearchPoolModel.byLowXp(selected)) {
            creatureCount = topUpProfile(counts, profile, creatureCount, targetCreatureCount);
            if (creatureCount >= targetCreatureCount) {
                return;
            }
        }
    }

    private static int topUpProfile(
            Map<Long, Integer> counts,
            EncounterCandidateProfile profile,
            int creatureCount,
            int targetCreatureCount
    ) {
        int current = counts.getOrDefault(profile.id(), 0);
        int nextCreatureCount = creatureCount;
        while (nextCreatureCount < targetCreatureCount && current < EncounterProfileCopies.maxAdditionalCopies(profile)) {
            current++;
            nextCreatureCount++;
            counts.put(profile.id(), current);
        }
        return nextCreatureCount;
    }

    private record DiversityDraftRequest(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            int targetCreatureCount
    ) {
    }
}
