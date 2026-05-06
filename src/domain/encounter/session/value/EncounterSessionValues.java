package src.domain.encounter.session.value;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanSummary;

public final class EncounterSessionValues {

    private EncounterSessionValues() {
    }

    public static final class Mode {

        public static final int BUILDER = 0;
        public static final int INITIATIVE = 1;
        public static final int COMBAT = 2;
        public static final int RESULTS = 3;

        private Mode() {
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
    }

    public static final class PartyMemberData {

        private final String id;
        private final long numericId;
        private final String name;
        private final int level;

        public PartyMemberData(String id, long numericId, String name, int level) {
            this.id = id == null ? "" : id;
            this.numericId = numericId;
            this.name = name == null ? "" : name;
            this.level = level;
        }

        public String id() {
            return id;
        }

        public long numericId() {
            return numericId;
        }

        public String name() {
            return name;
        }

        public int level() {
            return level;
        }
    }

    public static final class EncounterCreatureData {

        private static final String DEFAULT_ROLE = "Creature";

        private final String id;
        private final long creatureId;
        private final String name;
        private final String challengeRating;
        private final int xp;
        private final int hp;
        private final int armorClass;
        private final int initiativeBonus;
        private final String creatureType;
        private final String encounterRole;
        private final int count;
        private final List<String> tags;

        public EncounterCreatureData(
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
            this.id = id == null ? "" : id;
            this.creatureId = creatureId;
            this.name = name == null ? "" : name;
            this.challengeRating = challengeRating == null ? "" : challengeRating;
            this.xp = xp;
            this.hp = hp;
            this.armorClass = armorClass;
            this.initiativeBonus = initiativeBonus;
            this.creatureType = creatureType == null ? "" : creatureType;
            this.encounterRole = encounterRole == null || encounterRole.isBlank() ? DEFAULT_ROLE : encounterRole;
            this.count = Math.max(1, count);
            this.tags = tags == null ? List.of() : List.copyOf(tags);
        }

        public String id() {
            return id;
        }

        public long creatureId() {
            return creatureId;
        }

        public String name() {
            return name;
        }

        public String challengeRating() {
            return challengeRating;
        }

        public int xp() {
            return xp;
        }

        public int hp() {
            return hp;
        }

        public int armorClass() {
            return armorClass;
        }

        public int initiativeBonus() {
            return initiativeBonus;
        }

        public String creatureType() {
            return creatureType;
        }

        public String encounterRole() {
            return encounterRole;
        }

        public int count() {
            return count;
        }

        public List<String> tags() {
            return tags;
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

    public static final class RemovedRosterEntryData {

        private final long token;
        private final int index;
        private final EncounterCreatureData creature;

        public RemovedRosterEntryData(long token, int index, EncounterCreatureData creature) {
            this.token = token;
            this.index = index;
            this.creature = creature;
        }

        public long token() {
            return token;
        }

        public int index() {
            return index;
        }

        public EncounterCreatureData creature() {
            return creature;
        }
    }

    public static final class DifficultySummaryData {

        private final int easy;
        private final int medium;
        private final int hard;
        private final int deadly;
        private final int adjustedXp;
        private final String difficulty;

        public DifficultySummaryData(
                int easy,
                int medium,
                int hard,
                int deadly,
                int adjustedXp,
                String difficulty
        ) {
            this.easy = easy;
            this.medium = medium;
            this.hard = hard;
            this.deadly = deadly;
            this.adjustedXp = adjustedXp;
            this.difficulty = difficulty == null ? "" : difficulty;
        }

        public int easy() {
            return easy;
        }

        public int medium() {
            return medium;
        }

        public int hard() {
            return hard;
        }

        public int deadly() {
            return deadly;
        }

        public int adjustedXp() {
            return adjustedXp;
        }

        public String difficulty() {
            return difficulty;
        }
    }

    public static final class BuilderStateData {

        private final List<PartyMemberData> party;
        private final List<EncounterCreatureData> roster;
        private final String templateLabel;
        private final DifficultySummaryData difficulty;
        private final EncounterGenerationInputs builderInputs;
        private final List<String> generationAdvisoryMessages;
        private final List<EncounterPlanSummary> savedPlans;
        private final boolean canStartCombat;
        private final boolean canPreviousAlternative;
        private final boolean canNextAlternative;
        private final boolean canSavePlan;
        private final boolean canClearGenerationHistory;
        private final Optional<RemovedRosterEntryData> pendingUndo;

        public BuilderStateData(
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
            this.party = party == null ? List.of() : List.copyOf(party);
            this.roster = roster == null ? List.of() : List.copyOf(roster);
            this.templateLabel = templateLabel == null ? "" : templateLabel;
            this.difficulty = difficulty == null ? new DifficultySummaryData(0, 0, 0, 0, 0, "") : difficulty;
            this.builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
            this.generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
            this.savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            this.canStartCombat = canStartCombat;
            this.canPreviousAlternative = canPreviousAlternative;
            this.canNextAlternative = canNextAlternative;
            this.canSavePlan = canSavePlan;
            this.canClearGenerationHistory = canClearGenerationHistory;
            this.pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
        }

        public List<PartyMemberData> party() {
            return party;
        }

        public List<EncounterCreatureData> roster() {
            return roster;
        }

        public String templateLabel() {
            return templateLabel;
        }

        public DifficultySummaryData difficulty() {
            return difficulty;
        }

        public EncounterGenerationInputs builderInputs() {
            return builderInputs;
        }

        public List<String> generationAdvisoryMessages() {
            return generationAdvisoryMessages;
        }

        public List<EncounterPlanSummary> savedPlans() {
            return savedPlans;
        }

        public boolean canStartCombat() {
            return canStartCombat;
        }

        public boolean canPreviousAlternative() {
            return canPreviousAlternative;
        }

        public boolean canNextAlternative() {
            return canNextAlternative;
        }

        public boolean canSavePlan() {
            return canSavePlan;
        }

        public boolean canClearGenerationHistory() {
            return canClearGenerationHistory;
        }

        public Optional<RemovedRosterEntryData> pendingUndo() {
            return pendingUndo;
        }
    }

    public static final class InitiativeEntryData {

        private final String id;
        private final String label;
        private final CombatantKind kind;
        private final int initiative;

        public InitiativeEntryData(String id, String label, CombatantKind kind, int initiative) {
            this.id = id == null ? "" : id;
            this.label = label == null ? "" : label;
            this.kind = kind == null ? CombatantKind.MONSTER : kind;
            this.initiative = initiative;
        }

        public String id() {
            return id;
        }

        public String label() {
            return label;
        }

        public CombatantKind kind() {
            return kind;
        }

        public int initiative() {
            return initiative;
        }
    }

    public static final class InitiativeInput {

        private final String id;
        private final int initiative;

        public InitiativeInput(String id, int initiative) {
            this.id = id == null ? "" : id;
            this.initiative = initiative;
        }

        public String id() {
            return id;
        }

        public int initiative() {
            return initiative;
        }
    }

    public static final class CombatProjectionData {

        private final int currentTurnIndex;
        private final int round;
        private final String status;
        private final List<CombatCardData> cards;
        private final boolean allEnemiesDefeated;

        public CombatProjectionData(
                int currentTurnIndex,
                int round,
                String status,
                List<CombatCardData> cards,
                boolean allEnemiesDefeated
        ) {
            this.currentTurnIndex = currentTurnIndex;
            this.round = round;
            this.status = status == null ? "" : status;
            this.cards = cards == null ? List.of() : List.copyOf(cards);
            this.allEnemiesDefeated = allEnemiesDefeated;
        }

        public static CombatProjectionData empty() {
            return new CombatProjectionData(-1, 1, "", List.of(), false);
        }

        public int currentTurnIndex() {
            return currentTurnIndex;
        }

        public int round() {
            return round;
        }

        public String status() {
            return status;
        }

        public List<CombatCardData> cards() {
            return cards;
        }

        public boolean allEnemiesDefeated() {
            return allEnemiesDefeated;
        }
    }

    public static final class CombatCardData {

        private final String id;
        private final String name;
        private final boolean playerCharacter;
        private final boolean active;
        private final boolean alive;
        private final int currentHp;
        private final int maxHp;
        private final int armorClass;
        private final int initiative;
        private final int count;
        private final String detail;

        public CombatCardData(
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
            this.id = id == null ? "" : id;
            this.name = name == null ? "" : name;
            this.playerCharacter = playerCharacter;
            this.active = active;
            this.alive = alive;
            this.currentHp = currentHp;
            this.maxHp = maxHp;
            this.armorClass = armorClass;
            this.initiative = initiative;
            this.count = count;
            this.detail = detail == null ? "" : detail;
        }

        public String id() {
            return id;
        }

        public String name() {
            return name;
        }

        public boolean playerCharacter() {
            return playerCharacter;
        }

        public boolean active() {
            return active;
        }

        public boolean alive() {
            return alive;
        }

        public int currentHp() {
            return currentHp;
        }

        public int maxHp() {
            return maxHp;
        }

        public int armorClass() {
            return armorClass;
        }

        public int initiative() {
            return initiative;
        }

        public int count() {
            return count;
        }

        public String detail() {
            return detail;
        }
    }

    public static final class ResultEnemyData {

        private final String name;
        private final String status;
        private final int hpLoss;
        private final int xp;
        private final boolean defeatedByDefault;
        private final String loot;

        public ResultEnemyData(
                String name,
                String status,
                int hpLoss,
                int xp,
                boolean defeatedByDefault,
                String loot
        ) {
            this.name = name == null ? "" : name;
            this.status = status == null ? "" : status;
            this.hpLoss = hpLoss;
            this.xp = xp;
            this.defeatedByDefault = defeatedByDefault;
            this.loot = loot == null ? "" : loot;
        }

        public String name() {
            return name;
        }

        public String status() {
            return status;
        }

        public int hpLoss() {
            return hpLoss;
        }

        public int xp() {
            return xp;
        }

        public boolean defeatedByDefault() {
            return defeatedByDefault;
        }

        public String loot() {
            return loot;
        }
    }

    public static final class ResultStateData {

        private static final String DEFAULT_GOLD_SUMMARY = "Kein Loot";

        private final List<ResultEnemyData> enemies;
        private final long defeatedCount;
        private final int eligibleXp;
        private final int perPlayerXp;
        private final String goldSummary;
        private final String lootDetail;
        private final String awardStatus;
        private final boolean xpAwarded;
        private final boolean canAwardXp;
        private final int partySize;

        public ResultStateData(
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
            this.enemies = enemies == null ? List.of() : List.copyOf(enemies);
            this.defeatedCount = defeatedCount;
            this.eligibleXp = eligibleXp;
            this.perPlayerXp = perPlayerXp;
            this.goldSummary = goldSummary == null ? DEFAULT_GOLD_SUMMARY : goldSummary;
            this.lootDetail = lootDetail == null ? "" : lootDetail;
            this.awardStatus = awardStatus == null ? "" : awardStatus;
            this.xpAwarded = xpAwarded;
            this.canAwardXp = canAwardXp;
            this.partySize = Math.max(1, partySize);
        }

        public static ResultStateData empty() {
            return new ResultStateData(List.of(), 0, 0, 0, DEFAULT_GOLD_SUMMARY, "", "", false, false, 1);
        }

        public List<ResultEnemyData> enemies() {
            return enemies;
        }

        public long defeatedCount() {
            return defeatedCount;
        }

        public int eligibleXp() {
            return eligibleXp;
        }

        public int perPlayerXp() {
            return perPlayerXp;
        }

        public String goldSummary() {
            return goldSummary;
        }

        public String lootDetail() {
            return lootDetail;
        }

        public String awardStatus() {
            return awardStatus;
        }

        public boolean xpAwarded() {
            return xpAwarded;
        }

        public boolean canAwardXp() {
            return canAwardXp;
        }

        public int partySize() {
            return partySize;
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
