package src.domain.encounter.model.generation.model;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class EncounterDraftGenerationModel {

    private final EncounterDifficultyIntent targetDifficulty;
    private final EncounterDifficultyThresholds thresholds;
    private final int partySize;
    private final EncounterTuningIntent tuning;
    private final Collection<EncounterCandidateProfile> lockedProfiles;
    private final Map<Long, Integer> lockedQuantities;
    private final List<EncounterCandidateProfile> unlockedProfiles;

    public EncounterDraftGenerationModel(
            EncounterDifficultyIntent targetDifficulty,
            EncounterDifficultyThresholds thresholds,
            int partySize,
            EncounterTuningIntent tuning,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
        this.targetDifficulty = targetDifficulty;
        this.thresholds = thresholds;
        this.partySize = Math.max(1, partySize);
        this.tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        this.lockedProfiles = lockedProfiles == null ? List.of() : List.copyOf(lockedProfiles);
        this.lockedQuantities = lockedQuantities == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities));
        this.unlockedProfiles = unlockedProfiles == null ? List.of() : List.copyOf(unlockedProfiles);
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
