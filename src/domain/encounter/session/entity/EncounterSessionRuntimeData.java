package src.domain.encounter.session.entity;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterSessionRuntimeData {

    private static final String DEFAULT_CREATURE_ROLE = "Creature";

    private EncounterSessionRuntimeData() {
    }

    public enum GenerationStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        NO_SOLUTION,
        INVALID_REQUEST,
        STORAGE_ERROR;

        public static GenerationStatus defaultFailure() {
            return STORAGE_ERROR;
        }
    }

    public enum SavedPlanStatus {
        SUCCESS,
        NOT_FOUND,
        INVALID_REQUEST,
        STORAGE_ERROR
    }

    public record BudgetData(
            List<Integer> partyLevels,
            int averageLevel,
            int easyXp,
            int mediumXp,
            int hardXp,
            int deadlyXp
    ) {
        public BudgetData {
            partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
        }
    }

    public record CreatureDetailData(
            long id,
            String name,
            String challengeRating,
            int xp,
            int hitPoints,
            int armorClass,
            int initiativeBonus,
            String creatureType
    ) {
        public CreatureDetailData {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            creatureType = creatureType == null ? "" : creatureType;
        }
    }

    public record SavedPlanData(
            long id,
            String name,
            String generatedLabel,
            List<PlanCreatureData> creatures
    ) {
        public SavedPlanData {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
        }
    }

    public record PlanCreatureData(long creatureId, int quantity) {
        public PlanCreatureData {
            quantity = Math.max(1, quantity);
        }
    }

    public record SavedPlanSummaryData(long id, String name, String generatedLabel, int creatureCount) {
        public SavedPlanSummaryData {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
        }
    }

    public record SavePlanOutcome(
            SavedPlanStatus status,
            Optional<SavedPlanData> plan,
            String message
    ) {
        public SavePlanOutcome {
            status = status == null ? SavedPlanStatus.STORAGE_ERROR : status;
            plan = plan == null ? Optional.empty() : plan;
            message = message == null ? "" : message;
        }
    }

    public record LoadPlanOutcome(
            SavedPlanStatus status,
            Optional<SavedPlanData> plan,
            String message
    ) {
        public LoadPlanOutcome {
            status = status == null ? SavedPlanStatus.STORAGE_ERROR : status;
            plan = plan == null ? Optional.empty() : plan;
            message = message == null ? "" : message;
        }
    }

    public record ListPlansOutcome(
            SavedPlanStatus status,
            List<SavedPlanSummaryData> plans,
            String message
    ) {
        public ListPlansOutcome {
            status = status == null ? SavedPlanStatus.STORAGE_ERROR : status;
            plans = plans == null ? List.of() : List.copyOf(plans);
            message = message == null ? "" : message;
        }
    }

    public record AwardXpOutcome(boolean success) {
    }

    public record GeneratedEncounterData(
            String title,
            EncounterDifficultyIntent achievedDifficulty,
            int adjustedXp,
            List<GeneratedCreatureData> creatures
    ) {
        public GeneratedEncounterData {
            title = title == null ? "" : title;
            achievedDifficulty = achievedDifficulty == null ? EncounterDifficultyIntent.MEDIUM : achievedDifficulty;
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
        }
    }

    public record GeneratedCreatureData(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int quantity,
            String role,
            List<String> tags
    ) {
        public GeneratedCreatureData {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            quantity = Math.max(1, quantity);
            role = role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    public record GenerationDiagnosticsData(
            EncounterDifficultyIntent resolvedDifficulty,
            EncounterTuningIntent resolvedTuning
    ) {
        public GenerationDiagnosticsData {
            resolvedDifficulty = resolvedDifficulty == null ? EncounterDifficultyIntent.MEDIUM : resolvedDifficulty;
            resolvedTuning = resolvedTuning == null ? EncounterTuningIntent.defaultIntent() : resolvedTuning;
        }
    }

    public record GenerationResultData(
            GenerationStatus status,
            List<GeneratedEncounterData> encounters,
            String message,
            Optional<GenerationDiagnosticsData> diagnostics,
            boolean fallbackUsed
    ) {
        public GenerationResultData {
            status = status == null ? GenerationStatus.defaultFailure() : status;
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
            diagnostics = diagnostics == null ? Optional.empty() : diagnostics;
        }
    }
}
