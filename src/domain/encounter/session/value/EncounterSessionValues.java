package src.domain.encounter.session.value;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanSummary;

public final class EncounterSessionValues {

    private EncounterSessionValues() {
    }

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
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
    }

    public record PartyMemberData(String id, long numericId, String name, int level) {
        public PartyMemberData {
            id = id == null ? "" : id;
            name = name == null ? "" : name;
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
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            creatureType = creatureType == null ? "" : creatureType;
            encounterRole = encounterRole == null || encounterRole.isBlank() ? DEFAULT_ROLE : encounterRole;
            count = Math.max(1, count);
            tags = tags == null ? List.of() : List.copyOf(tags);
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
            difficulty = difficulty == null ? "" : difficulty;
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
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
            templateLabel = templateLabel == null ? "" : templateLabel;
            difficulty = difficulty == null ? new DifficultySummaryData(0, 0, 0, 0, 0, "") : difficulty;
            builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
            generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
        }
    }

    public record InitiativeEntryData(String id, String label, CombatantKind kind, int initiative) {
        public InitiativeEntryData {
            id = id == null ? "" : id;
            label = label == null ? "" : label;
            kind = kind == null ? CombatantKind.MONSTER : kind;
        }
    }

    public record InitiativeInput(String id, int initiative) {
        public InitiativeInput {
            id = id == null ? "" : id;
        }
    }

    public record InitiativeStateData(List<InitiativeEntryData> entries) {
        public InitiativeStateData {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        public static InitiativeStateData empty() {
            return new InitiativeStateData(List.of());
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
            status = status == null ? "" : status;
            cards = cards == null ? List.of() : List.copyOf(cards);
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
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
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
            name = name == null ? "" : name;
            status = status == null ? "" : status;
            loot = loot == null ? "" : loot;
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
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            goldSummary = goldSummary == null ? DEFAULT_GOLD_SUMMARY : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
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

    public record Snapshot(
            Mode mode,
            BuilderStateData builderState,
            InitiativeStateData initiativeState,
            CombatProjectionData combatState,
            ResultStateData resultState,
            String status,
            List<PartyMemberData> missingCombatPartyMembers
    ) {
        public Snapshot {
            mode = mode == null ? Mode.BUILDER : mode;
            builderState = builderState == null
                    ? new BuilderStateData(
                    List.of(),
                    List.of(),
                    "",
                    new DifficultySummaryData(0, 0, 0, 0, 0, ""),
                    EncounterGenerationInputs.empty(),
                    List.of(),
                    List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    Optional.empty())
                    : builderState;
            initiativeState = initiativeState == null ? InitiativeStateData.empty() : initiativeState;
            combatState = combatState == null ? CombatProjectionData.empty() : combatState;
            resultState = resultState == null ? ResultStateData.empty() : resultState;
            status = status == null ? "" : status;
            missingCombatPartyMembers = missingCombatPartyMembers == null
                    ? List.of()
                    : List.copyOf(missingCombatPartyMembers);
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

    public record SavePlanOutcome(Optional<EncounterPlan> plan, String message) {
        public SavePlanOutcome {
            plan = plan == null ? Optional.empty() : plan;
            message = message == null ? "" : message;
        }

        public boolean success() {
            return plan.isPresent();
        }
    }

    public record LoadPlanOutcome(Optional<EncounterPlan> plan, String message) {
        public LoadPlanOutcome {
            plan = plan == null ? Optional.empty() : plan;
            message = message == null ? "" : message;
        }

        public boolean success() {
            return plan.isPresent();
        }
    }

    public record ListPlansOutcome(boolean success, List<EncounterPlanSummary> plans, String message) {
        public ListPlansOutcome {
            plans = plans == null ? List.of() : List.copyOf(plans);
            message = message == null ? "" : message;
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
            title = title == null ? "" : title;
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
            roster = roster == null ? List.of() : List.copyOf(roster);
            advisoryMessages = advisoryMessages == null ? List.of() : List.copyOf(advisoryMessages);
        }
    }

    public record GenerationDiagnosticsData(String difficultyLabel, String tuningLabel) {
        public GenerationDiagnosticsData {
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
            tuningLabel = tuningLabel == null ? "" : tuningLabel;
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
            alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
            message = message == null ? "" : message;
            diagnostics = diagnostics == null ? Optional.empty() : diagnostics;
        }
    }
}
