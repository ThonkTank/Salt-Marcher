package src.domain.encounter.session.entity;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterGenerationInputs;

public final class EncounterSessionViewState {

    private static final String NO_LOOT = "Kein Loot";
    private static final int FIRST_COMBAT_ROUND = 1;

    private EncounterSessionViewState() {
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

        private final String publishedLabel;

        CombatantKind(String publishedLabel) {
            this.publishedLabel = publishedLabel;
        }

        public String publishedLabel() {
            return publishedLabel;
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
            String cr,
            int xp,
            int hp,
            int ac,
            int initiativeBonus,
            String type,
            String role,
            int count,
            List<String> tags
    ) {
        public EncounterCreatureData {
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            cr = cr == null ? "" : cr;
            type = type == null ? "" : type;
            role = role == null ? "" : role;
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
                    cr,
                    xp,
                    hp,
                    ac,
                    initiativeBonus,
                    type,
                    role,
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
            List<EncounterSessionRuntimeData.SavedPlanSummaryData> savedPlans,
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

    public record InitiativeInputData(String id, int initiative) {
        public InitiativeInputData {
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
            return new CombatProjectionData(CombatRuntime.NO_ACTIVE_TURN_INDEX, FIRST_COMBAT_ROUND, "", List.of(), false);
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
        public ResultStateData {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            goldSummary = goldSummary == null ? NO_LOOT : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
            partySize = Math.max(1, partySize);
        }

        public static ResultStateData empty() {
            return new ResultStateData(List.of(), 0, 0, 0, NO_LOOT, "", "", false, false, 1);
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
                    canAwardXp,
                    partySize);
        }
    }

    public record SnapshotData(
            Mode mode,
            BuilderStateData builderState,
            InitiativeStateData initiativeState,
            CombatProjectionData combatState,
            ResultStateData resultState,
            String status,
            List<PartyMemberData> missingCombatPartyMembers
    ) {
        public SnapshotData {
            mode = mode == null ? Mode.BUILDER : mode;
            builderState = builderState == null
                    ? new BuilderStateData(
                    List.of(),
                    List.of(),
                    "",
                    new DifficultySummaryData(0, 0, 0, 0, 0, ""),
                    EncounterGenerationInputs.empty(),
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
}
