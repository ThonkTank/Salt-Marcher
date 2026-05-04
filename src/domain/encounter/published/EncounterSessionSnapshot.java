package src.domain.encounter.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterSessionSnapshot(
        Mode mode,
        BuilderState builderState,
        InitiativeState initiativeState,
        CombatProjection combatState,
        ResultState resultState,
        String status,
        List<PartyMember> missingCombatPartyMembers
) {
    public EncounterSessionSnapshot {
        mode = mode == null ? Mode.BUILDER : mode;
        builderState = builderState == null ? BuilderState.empty() : builderState;
        initiativeState = initiativeState == null ? InitiativeState.empty() : initiativeState;
        combatState = combatState == null ? CombatProjection.empty() : combatState;
        resultState = resultState == null ? ResultState.empty() : resultState;
        status = status == null ? "" : status;
        missingCombatPartyMembers = missingCombatPartyMembers == null
                ? List.of()
                : List.copyOf(missingCombatPartyMembers);
    }

    public static EncounterSessionSnapshot empty(String status) {
        return new EncounterSessionSnapshot(
                Mode.BUILDER,
                BuilderState.empty(),
                InitiativeState.empty(),
                CombatProjection.empty(),
                ResultState.empty(),
                status,
                List.of());
    }

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    public record PartyMember(String id, long numericId, String name, int level) {
    }

    public record EncounterCreature(
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
        public EncounterCreature {
            count = Math.max(1, count);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }

        public int totalXp() {
            return xp * count;
        }

        public EncounterCreature withCount(int nextCount, int maxCount) {
            return new EncounterCreature(
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

    public record RemovedRosterEntry(long token, int index, EncounterCreature creature) {
    }

    public record DifficultySummary(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
    }

    public record BuilderInputs(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            EncounterDifficultyBand targetDifficulty,
            EncounterGenerationTuning tuning,
            List<Long> encounterTableIds
    ) {
        public BuilderInputs {
            creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
            creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            targetDifficulty = targetDifficulty == null ? EncounterDifficultyBand.autoBand() : targetDifficulty;
            tuning = tuning == null ? EncounterGenerationTuning.autoTuning() : tuning;
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        }

        public static BuilderInputs empty() {
            return new BuilderInputs(
                    List.of(),
                    List.of(),
                    List.of(),
                    EncounterDifficultyBand.autoBand(),
                    EncounterGenerationTuning.autoTuning(),
                    List.of());
        }
    }

    public record BuilderState(
            List<PartyMember> party,
            List<EncounterCreature> roster,
            String templateLabel,
            DifficultySummary difficulty,
            BuilderInputs builderInputs,
            String statusMessage,
            List<EncounterGenerationAdvisory> generationAdvisories,
            List<SavedEncounterPlanSummary> savedPlans,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable RemovedRosterEntry pendingUndo
    ) {
        public BuilderState {
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
            templateLabel = templateLabel == null ? "" : templateLabel;
            difficulty = difficulty == null ? new DifficultySummary(0, 0, 0, 0, 0, "") : difficulty;
            builderInputs = builderInputs == null ? BuilderInputs.empty() : builderInputs;
            statusMessage = statusMessage == null ? "" : statusMessage;
            generationAdvisories = generationAdvisories == null ? List.of() : List.copyOf(generationAdvisories);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
        }

        public static BuilderState empty() {
            return new BuilderState(
                    List.of(),
                    List.of(),
                    "",
                    new DifficultySummary(0, 0, 0, 0, 0, ""),
                    BuilderInputs.empty(),
                    "",
                    List.of(),
                    List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }
    }

    public record InitiativeEntry(String id, String label, String kind, int initiative) {
    }

    public record InitiativeInput(String id, int initiative) {
    }

    public record InitiativeState(List<InitiativeEntry> entries) {
        public InitiativeState {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        public static InitiativeState empty() {
            return new InitiativeState(List.of());
        }
    }

    public record CombatProjection(
            int currentTurnIndex,
            int round,
            String status,
            List<CombatCardSnapshot> cards,
            boolean allEnemiesDefeated
    ) {
        public CombatProjection {
            status = status == null ? "" : status;
            cards = cards == null ? List.of() : List.copyOf(cards);
        }

        public static CombatProjection empty() {
            return new CombatProjection(-1, 1, "", List.of(), false);
        }
    }

    public record CombatCardSnapshot(
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
    }

    public record ResultEnemySnapshot(
            String name,
            String status,
            int hpLoss,
            int xp,
            boolean defeatedByDefault,
            String loot
    ) {
    }

    public record ResultState(
            List<ResultEnemySnapshot> enemies,
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
        public ResultState {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            goldSummary = goldSummary == null ? "Kein Loot" : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
            partySize = Math.max(1, partySize);
        }

        public static ResultState empty() {
            return new ResultState(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }

        public ResultState withAwardStatus(String nextAwardStatus, boolean awarded) {
            return new ResultState(
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
}
