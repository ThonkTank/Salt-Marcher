package src.domain.encounter.generation.factory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.generation.policy.EncounterDraftCollector;
import src.domain.encounter.generation.policy.EncounterDraftOrdering;
import src.domain.encounter.generation.policy.EncounterTuningTargets;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftBuildRequest;
import src.domain.encounter.generation.value.EncounterProfileCopies;

final class EncounterDraftEnumerator {

    private static final int DRAFT_LIMIT = 30;
    private static final int DIVERSITY_POOL_LIMIT = 12;
    private static final int MAX_FIRST_DUAL_COPIES = 3;
    private static final int MAX_SECOND_DUAL_COPIES = 4;

    private EncounterDraftEnumerator() {
    }

    static List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        Map<String, EncounterDraft> drafts = new LinkedHashMap<>();
        Map<Long, Integer> baseCounts = new LinkedHashMap<>(request.lockedQuantities());
        Map<Long, EncounterCandidateProfile> profiles = profileLookup(request);
        EncounterDraftCollector.add(drafts, profiles, request, baseCounts);
        appendSingleCreatureDrafts(drafts, profiles, request, baseCounts, request.pool());
        appendDualCreatureDrafts(drafts, profiles, request, baseCounts, request.pool());
        appendDiversityDrafts(drafts, profiles, request, baseCounts, request.pool());
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
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (EncounterCandidateProfile first : pool) {
            appendSingleProfileCounts(drafts, profiles, request, baseCounts, first);
        }
    }

    private static void appendSingleProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first
    ) {
        for (int firstCount = 1; firstCount <= EncounterProfileCopies.maxAdditionalCopies(first); firstCount++) {
            Map<Long, Integer> single = new LinkedHashMap<>(baseCounts);
            single.merge(first.id(), firstCount, Integer::sum);
            EncounterDraftCollector.add(drafts, profiles, request, single);
        }
    }

    private static void appendDualCreatureDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (int i = 0; i < pool.size(); i++) {
            appendDualsForFirstProfile(drafts, profiles, request, baseCounts, pool, i);
        }
    }

    private static void appendDiversityDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        EncounterTuningTargets.Targets targets =
                EncounterTuningTargets.targetsFor(request.tuning(), request.partySize());
        int additionalDistinct = targets.targetDistinctStatBlocks() - baseCounts.size();
        if (additionalDistinct <= 2 || pool.size() < additionalDistinct) {
            return;
        }
        List<EncounterCandidateProfile> candidates = pool.subList(0, Math.min(pool.size(), DIVERSITY_POOL_LIMIT));
        appendDiversityCombinations(new DiversityDraftRequest(
                drafts,
                profiles,
                request,
                baseCounts,
                candidates,
                additionalDistinct,
                targets.targetCreatureCount()), new ArrayList<>(), 0);
    }

    private static void appendDiversityCombinations(
            DiversityDraftRequest diversityRequest,
            List<EncounterCandidateProfile> selected,
            int startIndex
    ) {
        if (selected.size() == diversityRequest.additionalDistinct()) {
            Map<Long, Integer> counts = new LinkedHashMap<>(diversityRequest.baseCounts());
            for (EncounterCandidateProfile profile : selected) {
                counts.merge(profile.id(), 1, Integer::sum);
            }
            topUpCounts(counts, selected, diversityRequest.targetCreatureCount());
            EncounterDraftCollector.add(
                    diversityRequest.drafts(),
                    diversityRequest.profiles(),
                    diversityRequest.request(),
                    counts);
            return;
        }
        int remaining = diversityRequest.additionalDistinct() - selected.size();
        for (int index = startIndex; index <= diversityRequest.candidates().size() - remaining; index++) {
            selected.add(diversityRequest.candidates().get(index));
            appendDiversityCombinations(diversityRequest, selected, index + 1);
            selected.removeLast();
        }
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
        List<EncounterCandidateProfile> byLowXp = selected.stream()
                .sorted(Comparator.comparingInt(EncounterCandidateProfile::xp)
                        .thenComparing(EncounterCandidateProfile::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
        while (creatureCount < targetCreatureCount) {
            boolean added = false;
            for (EncounterCandidateProfile profile : byLowXp) {
                int current = counts.getOrDefault(profile.id(), 0);
                if (current >= EncounterProfileCopies.maxAdditionalCopies(profile)) {
                    continue;
                }
                counts.put(profile.id(), current + 1);
                creatureCount++;
                added = true;
                if (creatureCount >= targetCreatureCount) {
                    break;
                }
            }
            if (!added) {
                return;
            }
        }
    }

    private static void appendDualsForFirstProfile(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool,
            int firstIndex
    ) {
        EncounterCandidateProfile first = pool.get(firstIndex);
        for (int j = firstIndex + 1; j < pool.size(); j++) {
            appendDualProfileCounts(drafts, profiles, request, baseCounts, first, pool.get(j));
        }
    }

    private static void appendDualProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first,
            EncounterCandidateProfile second
    ) {
        int firstLimit = Math.min(MAX_FIRST_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(first));
        int secondLimit = Math.min(MAX_SECOND_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(second));
        for (int firstCount = 1; firstCount <= firstLimit; firstCount++) {
            appendSecondProfileCounts(
                    drafts,
                    profiles,
                    request,
                    baseCounts,
                    new DualProfileCountRequest(first, second, firstCount, secondLimit));
        }
    }

    private static void appendSecondProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest buildRequest,
            Map<Long, Integer> baseCounts,
            DualProfileCountRequest dualRequest
    ) {
        for (int secondCount = 1; secondCount <= dualRequest.secondLimit(); secondCount++) {
            Map<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
            dual.merge(dualRequest.first().id(), dualRequest.firstCount(), Integer::sum);
            dual.merge(dualRequest.second().id(), secondCount, Integer::sum);
            EncounterDraftCollector.add(drafts, profiles, buildRequest, dual);
        }
    }

    private record DualProfileCountRequest(
            EncounterCandidateProfile first,
            EncounterCandidateProfile second,
            int firstCount,
            int secondLimit
    ) {
    }

    private record DiversityDraftRequest(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> candidates,
            int additionalDistinct,
            int targetCreatureCount
    ) {
    }
}
