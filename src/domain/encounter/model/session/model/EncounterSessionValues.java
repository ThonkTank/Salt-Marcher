package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;

public final class EncounterSessionValues {

    private EncounterSessionValues() {
    }

    public static BuilderStateData emptyBuilderState() {
        return BuilderStateData.empty();
    }

    public static final class Mode {

        public static final int BUILDER = 0;
        public static final int INITIATIVE = 1;
        public static final int COMBAT = 2;
        public static final int RESULTS = 3;

        private Mode() {
        }

        public static boolean isCombatMode(int mode) {
            return mode == COMBAT;
        }
    }

    public enum CombatantKind {
        PLAYER_CHARACTER("SC"),
        MONSTER("Monster");

        private final String label;

        CombatantKind(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }

        public boolean playerCharacter() {
            return this == PLAYER_CHARACTER;
        }

        public static CombatantKind playerCharacterKind() {
            return PLAYER_CHARACTER;
        }
    }

    public record PartyMemberData(String id, long numericId, String name, int level) {
        public PartyMemberData {
            id = defaultString(id);
            name = defaultString(name);
        }
    }

    public record EncounterCreatureData(
            String id,
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int hp,
            int armorClass,
            int initiativeBonus,
            String creatureType,
            String encounterRole,
            int count,
            List<String> tags
    ) {

        private static final String DEFAULT_ROLE = "Creature";

        public EncounterCreatureData {
            id = defaultString(id);
            name = defaultString(name);
            challengeRating = defaultString(challengeRating);
            creatureType = defaultString(creatureType);
            encounterRole = encounterRole == null || encounterRole.isBlank() ? DEFAULT_ROLE : encounterRole;
            count = Math.max(1, count);
            tags = copyOfOrEmpty(tags);
        }

        public int totalXp() {
            return xp * count;
        }

        public EncounterCreatureData withCount(int nextCount, int maxCount) {
            return new EncounterCreatureData(
                    id,
                    creatureId,
                    name,
                    challengeRating,
                    xp,
                    hp,
                    armorClass,
                    initiativeBonus,
                    creatureType,
                    encounterRole,
                    Math.max(1, Math.min(maxCount, nextCount)),
                    tags);
        }
    }

    public record RemovedRosterEntryData(long token, int index, EncounterCreatureData creature) {
    }

    public record DifficultySummaryData(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
        public DifficultySummaryData {
            difficulty = defaultString(difficulty);
        }

        public static DifficultySummaryData empty() {
            return new DifficultySummaryData(0, 0, 0, 0, 0, "");
        }
    }

    public record BuilderStateData(
            List<PartyMemberData> party,
            List<EncounterCreatureData> roster,
            String templateLabel,
            DifficultySummaryData difficulty,
            EncounterGenerationInputs builderInputs,
            List<String> generationAdvisoryMessages,
            List<EncounterPlanSummary> savedPlans,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            Optional<RemovedRosterEntryData> pendingUndo
    ) {
        public BuilderStateData {
            party = copyOfOrEmpty(party);
            roster = copyOfOrEmpty(roster);
            templateLabel = defaultString(templateLabel);
            difficulty = difficulty == null ? DifficultySummaryData.empty() : difficulty;
            builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
            generationAdvisoryMessages = copyOfOrEmpty(generationAdvisoryMessages);
            savedPlans = copyOfOrEmpty(savedPlans);
            pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
        }

        public static BuilderStateData empty() {
            return new BuilderStateData(
                    List.of(),
                    List.of(),
                    "",
                    DifficultySummaryData.empty(),
                    EncounterGenerationInputs.empty(),
                    List.of(),
                    List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    Optional.empty());
        }
    }

    public record InitiativeEntryData(String id, String label, CombatantKind kind, int initiative) {
        public InitiativeEntryData {
            id = defaultString(id);
            label = defaultString(label);
            kind = kind == null ? CombatantKind.MONSTER : kind;
        }
    }

    public record InitiativeInput(String id, int initiative) {
        public InitiativeInput {
            id = defaultString(id);
        }
    }

    public record CombatProjectionData(
            int currentTurnIndex,
            int round,
            String status,
            List<CombatCardData> cards,
            boolean allEnemiesDefeated
    ) {
        public CombatProjectionData {
            status = defaultString(status);
            cards = copyOfOrEmpty(cards);
        }

        public static CombatProjectionData empty() {
            return new CombatProjectionData(-1, 1, "", List.of(), false);
        }
    }

    public record CombatCardData(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
        public CombatCardData {
            id = defaultString(id);
            name = defaultString(name);
            detail = defaultString(detail);
        }
    }

    public record ResultEnemyData(
            String name,
            String status,
            int hpLoss,
            int xp,
            boolean defeatedByDefault,
            String loot
    ) {
        public ResultEnemyData {
            name = defaultString(name);
            status = defaultString(status);
            loot = defaultString(loot);
        }
    }

    public record ResultStateData(
            List<ResultEnemyData> enemies,
            long defeatedCount,
            int eligibleXp,
            int perPlayerXp,
            String goldSummary,
            String lootDetail,
            String awardStatus,
            boolean xpAwarded,
            boolean canAwardXp,
            int partySize
    ) {

        private static final String DEFAULT_GOLD_SUMMARY = "Kein Loot";

        public ResultStateData {
            enemies = copyOfOrEmpty(enemies);
            goldSummary = goldSummary == null ? DEFAULT_GOLD_SUMMARY : goldSummary;
            lootDetail = defaultString(lootDetail);
            awardStatus = defaultString(awardStatus);
            partySize = Math.max(1, partySize);
        }

        public static ResultStateData empty() {
            return new ResultStateData(List.of(), 0, 0, 0, DEFAULT_GOLD_SUMMARY, "", "", false, false, 1);
        }

        public ResultStateData withAwardStatus(String nextAwardStatus, boolean awarded) {
            return new ResultStateData(
                    enemies,
                    defeatedCount,
                    eligibleXp,
                    perPlayerXp,
                    goldSummary,
                    lootDetail,
                    nextAwardStatus,
                    awarded,
                    !awarded && canAwardXp,
                    partySize);
        }
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

    public record PlanOutcome(Optional<EncounterPlan> plan, String message) {
        public PlanOutcome {
            plan = plan == null ? Optional.empty() : plan;
            message = defaultString(message);
        }

        public boolean success() {
            return plan.isPresent();
        }
    }

    public record ListPlansOutcome(boolean success, List<EncounterPlanSummary> plans, String message) {
        public ListPlansOutcome {
            plans = plans == null ? List.of() : List.copyOf(plans);
            message = defaultString(message);
        }
    }

    public record AwardXpOutcome(boolean success) {
    }

    public record GeneratedEncounterData(
            String title,
            String difficultyLabel,
            int adjustedXp,
            List<EncounterCreatureData> roster,
            List<String> advisoryMessages
    ) {
        public GeneratedEncounterData {
            title = defaultString(title);
            difficultyLabel = defaultString(difficultyLabel);
            roster = copyOfOrEmpty(roster);
            advisoryMessages = copyOfOrEmpty(advisoryMessages);
        }
    }

    public record GenerationDiagnosticsData(String difficultyLabel, String tuningLabel) {
        public GenerationDiagnosticsData {
            difficultyLabel = defaultString(difficultyLabel);
            tuningLabel = defaultString(tuningLabel);
        }
    }

    public record GenerationResultData(
            boolean success,
            List<GeneratedEncounterData> alternatives,
            String message,
            Optional<GenerationDiagnosticsData> diagnostics,
            boolean fallbackUsed
    ) {
        public GenerationResultData {
            alternatives = copyOfOrEmpty(alternatives);
            message = defaultString(message);
            diagnostics = diagnostics == null ? Optional.empty() : diagnostics;
        }
    }

    private static String defaultString(String value) {
        return value == null ? "" : value;
    }

    private static <T> List<T> copyOfOrEmpty(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
