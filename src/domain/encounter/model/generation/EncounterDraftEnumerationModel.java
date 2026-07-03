package src.domain.encounter.model.generation;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterDraftEnumerationModel {

    private static final int MAX_DEADLY_MULTIPLE = 2;
    private static final int DRAFT_LIMIT = 30;
    private static final int MAX_FIRST_DUAL_COPIES = 3;
    private static final int MAX_SECOND_DUAL_COPIES = 4;

    private EncounterDraftEnumerationModel() {
    }

    static List<EncounterDraft> createDrafts(
            EncounterDifficultyIntent targetDifficulty,
            EncounterDifficultyThresholds thresholds,
            int partySize,
            EncounterTuningIntent tuning,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> unlockedProfiles,
            Map<Long, Integer> finiteCreatureStockCaps
    ) {
        List<EncounterCandidateProfile> pool =
                EncounterSearchPoolModel.buildSearchPool(unlockedProfiles, thresholds, targetDifficulty);
        return enumerate(new EncounterDraftBuildRequest(
                targetDifficulty,
                thresholds,
                partySize,
                tuning,
                lockedProfiles,
                lockedQuantities,
                pool,
                finiteCreatureStockCaps));
    }

    static List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        Map<String, EncounterDraft> drafts = new LinkedHashMap<>();
        Map<Long, Integer> baseCounts = new LinkedHashMap<>(request.lockedQuantities());
        Map<Long, EncounterCandidateProfile> profiles = profileLookup(request);
        addDraft(drafts, profiles, request, baseCounts);
        appendSingleDrafts(drafts, profiles, request, baseCounts, request.pool());
        appendDualDrafts(drafts, profiles, request, baseCounts, request.pool());
        EncounterDraftDiversityEnumerationModel.appendDiversityDrafts(drafts, profiles, request, baseCounts, request.pool());
        return EncounterDraftRankingModel.topDrafts(drafts.values(), DRAFT_LIMIT);
    }

    static void addDraft(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> counts
    ) {
        EncounterDraftComposition composition = EncounterDraftComposition.from(counts, profiles);
        if (!withinFiniteStockCaps(counts, request.finiteCreatureStockCaps())) {
            return;
        }
        for (EncounterDraft draft : create(composition, request)) {
            drafts.put(draft.canonicalKey(), draft);
        }
    }

    static List<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        if (!composition.valid()) {
            return List.of();
        }
        EncounterDraftXpProfile xpProfile = EncounterDraftXpModel.xpProfile(composition.stats(), request);
        int maxAllowedAdjustedXp =
                EncounterDifficultyBandModel.of(EncounterDifficultyIntent.DEADLY, request.thresholds()).maxAdjustedXp();
        if (xpProfile.adjustedXp() > maxAllowedAdjustedXp * MAX_DEADLY_MULTIPLE) {
            return List.of();
        }
        EncounterDifficultyIntent achievedDifficulty =
                EncounterDifficultyBandModel.bandFor(xpProfile.adjustedXp(), request.thresholds());
        int score = EncounterDraftScoringModel.score(new EncounterDraftGenerationModel.ScoreInput(
                composition,
                new EncounterDraftGenerationModel.ScoreContext(
                        request.targetDifficulty(),
                        achievedDifficulty,
                        request.thresholds(),
                        xpProfile,
                        request.tuning(),
                        request.partySize())));
        return List.of(EncounterDraft.create(
                achievedDifficulty,
                EncounterDraftXpModel.metrics(composition.stats(), xpProfile, score),
                composition.entries()));
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

    private static void appendSingleDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (EncounterCandidateProfile first : pool) {
            for (int firstCount = 1; firstCount <= EncounterProfileCopies.maxAdditionalCopies(first); firstCount++) {
                Map<Long, Integer> single = new LinkedHashMap<>(baseCounts);
                addCount(single, first.id(), firstCount);
                addDraft(drafts, profiles, request, single);
            }
        }
    }

    private static void appendDualDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (int firstIndex = 0; firstIndex < pool.size(); firstIndex++) {
            EncounterCandidateProfile first = pool.get(firstIndex);
            for (int secondIndex = firstIndex + 1; secondIndex < pool.size(); secondIndex++) {
                appendDualProfileCounts(drafts, profiles, request, baseCounts, first, pool.get(secondIndex));
            }
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
            for (int secondCount = 1; secondCount <= secondLimit; secondCount++) {
                Map<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
                addCount(dual, first.id(), firstCount);
                addCount(dual, second.id(), secondCount);
                addDraft(drafts, profiles, request, dual);
            }
        }
    }

    static void addCount(Map<Long, Integer> counts, long id, int count) {
        counts.put(id, counts.getOrDefault(id, 0) + count);
    }

    private static boolean withinFiniteStockCaps(Map<Long, Integer> counts, Map<Long, Integer> finiteStockCaps) {
        if (finiteStockCaps == null || finiteStockCaps.isEmpty()) {
            return true;
        }
        for (Map.Entry<Long, Integer> cap : finiteStockCaps.entrySet()) {
            if (counts.getOrDefault(cap.getKey(), 0) > cap.getValue()) {
                return false;
            }
        }
        return true;
    }

}
