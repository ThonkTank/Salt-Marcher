package src.domain.encounter.generation.value;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterDraftEnumerator {

    private static final int DRAFT_LIMIT = 30;
    private static final int MAX_FIRST_DUAL_COPIES = 3;
    private static final int MAX_SECOND_DUAL_COPIES = 4;

    private EncounterDraftEnumerator() {
    }

    static List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        Map<String, EncounterDraft> drafts = new LinkedHashMap<>();
        Map<Long, Integer> baseCounts = new LinkedHashMap<>(request.lockedQuantities());
        EncounterDraftCollector collector = new EncounterDraftCollector(drafts, profileLookup(request), request);
        collector.add(baseCounts);
        appendSingleCreatureDrafts(collector, baseCounts, request.pool());
        appendDualCreatureDrafts(collector, baseCounts, request.pool());
        return EncounterDraftOrdering.topDrafts(drafts.values(), DRAFT_LIMIT);
    }

    private static Map<Long, EncounterCandidateProfile> profileLookup(EncounterDraftBuildRequest request) {
        Map<Long, EncounterCandidateProfile> profiles = new LinkedHashMap<>();
        for (EncounterCandidateProfile locked : request.lockedProfiles()) {
            profiles.put(locked.id(), locked);
        }
        for (EncounterCandidateProfile profile : request.pool()) {
            profiles.put(profile.id(), profile);
        }
        return profiles;
    }

    private static void appendSingleCreatureDrafts(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (EncounterCandidateProfile first : pool) {
            appendSingleProfileCounts(collector, baseCounts, first);
        }
    }

    private static void appendSingleProfileCounts(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first
    ) {
        for (int firstCount = 1; firstCount <= EncounterProfileCopies.maxAdditionalCopies(first); firstCount++) {
            Map<Long, Integer> single = new LinkedHashMap<>(baseCounts);
            single.merge(first.id(), firstCount, Integer::sum);
            collector.add(single);
        }
    }

    private static void appendDualCreatureDrafts(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (int i = 0; i < pool.size(); i++) {
            appendDualsForFirstProfile(collector, baseCounts, pool, i);
        }
    }

    private static void appendDualsForFirstProfile(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool,
            int firstIndex
    ) {
        EncounterCandidateProfile first = pool.get(firstIndex);
        for (int j = firstIndex + 1; j < pool.size(); j++) {
            appendDualProfileCounts(collector, baseCounts, first, pool.get(j));
        }
    }

    private static void appendDualProfileCounts(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first,
            EncounterCandidateProfile second
    ) {
        int firstLimit = Math.min(MAX_FIRST_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(first));
        int secondLimit = Math.min(MAX_SECOND_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(second));
        for (int firstCount = 1; firstCount <= firstLimit; firstCount++) {
            appendSecondProfileCounts(
                    collector,
                    baseCounts,
                    new DualProfileCountRequest(first, second, firstCount, secondLimit));
        }
    }

    private static void appendSecondProfileCounts(
            EncounterDraftCollector collector,
            Map<Long, Integer> baseCounts,
            DualProfileCountRequest request
    ) {
        for (int secondCount = 1; secondCount <= request.secondLimit(); secondCount++) {
            Map<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
            dual.merge(request.first().id(), request.firstCount(), Integer::sum);
            dual.merge(request.second().id(), secondCount, Integer::sum);
            collector.add(dual);
        }
    }

    private record DualProfileCountRequest(
            EncounterCandidateProfile first,
            EncounterCandidateProfile second,
            int firstCount,
            int secondLimit
    ) {
    }
}
