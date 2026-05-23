package src.domain.encounter.model.generation.model;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record EncounterDraftGenerationModel(
        EncounterDifficultyIntent targetDifficulty,
        EncounterDifficultyThresholds thresholds,
        int partySize,
        EncounterTuningIntent tuning,
        Collection<EncounterCandidateProfile> lockedProfiles,
        Map<Long, Integer> lockedQuantities,
        List<EncounterCandidateProfile> unlockedProfiles
) {

    public EncounterDraftGenerationModel {
        partySize = Math.max(1, partySize);
        tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        lockedProfiles = lockedProfiles == null ? List.of() : List.copyOf(lockedProfiles);
        lockedQuantities = lockedQuantities == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities));
        unlockedProfiles = unlockedProfiles == null ? List.of() : List.copyOf(unlockedProfiles);
    }

    public static EncounterDraftGenerationModel fromRequest(EncounterDraftBuildRequest request) {
        return new EncounterDraftGenerationModel(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.tuning(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                request.pool());
    }

    public List<EncounterDraft> createDrafts() {
        return EncounterDraftEnumerationModel.createDrafts(
                targetDifficulty,
                thresholds,
                partySize,
                tuning,
                lockedProfiles,
                lockedQuantities,
                unlockedProfiles);
    }

    public List<EncounterCandidateProfile> buildSearchPool() {
        return EncounterSearchPoolModel.buildSearchPool(unlockedProfiles, thresholds, targetDifficulty);
    }

    public List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        return EncounterDraftEnumerationModel.enumerate(request);
    }

    public void addDraft(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> counts
    ) {
        EncounterDraftEnumerationModel.addDraft(drafts, profiles, request, counts);
    }

    public void appendDiversityDrafts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        EncounterDraftDiversityEnumerationModel.appendDiversityDrafts(drafts, profiles, request, baseCounts, pool);
    }

    public List<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        return EncounterDraftEnumerationModel.create(composition, request);
    }

    public List<EncounterDraft> topDrafts(Collection<EncounterDraft> drafts, int limit) {
        return EncounterDraftEnumerationModel.topDrafts(drafts, limit);
    }

    public int score(ScoreInput input) {
        return EncounterDraftScoringModel.score(input);
    }

    public EncounterTuningTargets targetsFor() {
        return EncounterTuningTargetModel.targetsFor(tuning, partySize);
    }

    public int tuningScore(EncounterDraftComposition composition) {
        return EncounterDraftTuningScoringModel.tuningScore(composition, tuning, partySize);
    }

    @Override
    public Collection<EncounterCandidateProfile> lockedProfiles() {
        return List.copyOf(lockedProfiles);
    }

    @Override
    public Map<Long, Integer> lockedQuantities() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities));
    }

    @Override
    public List<EncounterCandidateProfile> unlockedProfiles() {
        return List.copyOf(unlockedProfiles);
    }

    public record ScoreInput(
            EncounterDraftComposition composition,
            ScoreContext context
    ) {
    }

    public record ScoreContext(
            EncounterDifficultyIntent targetDifficulty,
            EncounterDifficultyIntent achievedDifficulty,
            EncounterDifficultyThresholds thresholds,
            EncounterDraftXpProfile xpProfile,
            EncounterTuningIntent tuning,
            int partySize
    ) {
        public ScoreContext {
            tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
            partySize = Math.max(1, partySize);
        }
    }
}
