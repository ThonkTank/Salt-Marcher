package src.domain.encounter.session.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.OptionalLong;

public final class EncounterSession {

    private static final int DEFAULT_GENERATION_ALTERNATIVE_COUNT = 5;
    private static final int MAX_CREATURES_PER_SLOT = 20;
    private static final int FIRST_COMBAT_ROUND = 1;
    private static final String DEFAULT_STATUS = "Encounter bereit.";
    private static final String NO_LOOT = "Kein Loot";
    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";
    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";

    private final State state = new State();

    public interface RuntimeAccess {

        List<PartyMemberData> loadActiveParty();

        Optional<BudgetData> loadBudget();

        GenerationResultData generate(GenerateRequestData request);

        SavePlanOutcome savePlan(SavedPlanData plan);

        LoadPlanOutcome loadPlan(long planId);

        ListPlansOutcome listPlans();

        Optional<CreatureDetailData> loadCreature(long creatureId);

        AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter);
    }

    public SnapshotData snapshot() {
        return new SnapshotData(
                state.mode,
                builderState(),
                state.initiativeState,
                state.combatState,
                state.resultState,
                state.status,
                missingCombatPartyMembers());
    }

    public SnapshotData refreshPartyContext(RuntimeAccess access) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        loadActiveParty(safeAccess);
        loadBudgetIntoSession(safeAccess);
        refreshSavedPlans(safeAccess);
        return snapshot();
    }

    public SnapshotData updateBuilderInputs(BuilderInputsData nextInputs) {
        state.builderInputs = nextInputs == null ? BuilderInputsData.empty() : nextInputs;
        return snapshot();
    }

    public SnapshotData generate(RuntimeAccess access, Optional<GenerateRequestData> request) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        state.pendingUndo = Optional.empty();
        state.activeSavedPlanId = OptionalLong.empty();
        loadActiveParty(safeAccess);
        loadBudgetIntoSession(safeAccess);
        if (state.activeParty.isEmpty()) {
            state.status = "Die aktive Party hat keine Mitglieder.";
            return snapshot();
        }
        GenerationResultData result = safeAccess.generate(request.orElseGet(this::generationCommand));
        if (result.status() != GenerationStatus.SUCCESS || result.encounters().isEmpty()) {
            state.generatedAlternatives.clear();
            state.selectedAlternativeIndex = 0;
            state.generationHistoryPresent = false;
            state.status = result.message().isBlank() ? generationStatusText(result.status()) : result.message();
            return snapshot();
        }
        state.generatedAlternatives.clear();
        state.generatedAlternatives.addAll(result.encounters());
        state.generationHistoryPresent = true;
        state.selectedAlternativeIndex = 0;
        applyGeneratedEncounter(state.generatedAlternatives.getFirst());
        state.status = generationSuccessText(result);
        return snapshot();
    }

    public SnapshotData saveCurrentPlan(RuntimeAccess access) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        if (state.roster.isEmpty()) {
            state.status = "Speichern braucht mindestens eine Kreatur im Encounter.";
            return snapshot();
        }
        SavePlanOutcome result = safeAccess.savePlan(new SavedPlanData(
                state.activeSavedPlanId.orElse(0L),
                saveName(),
                state.generatedTitle,
                state.roster.stream()
                        .map(creature -> new PlanCreatureData(creature.creatureId(), creature.count()))
                        .toList()));
        if (result.status() != SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            state.status = result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message();
            refreshSavedPlans(safeAccess);
            return snapshot();
        }
        SavedPlanData plan = result.plan().orElseThrow();
        state.activeSavedPlanId = OptionalLong.of(plan.id());
        state.status = plan.name() + " gespeichert.";
        refreshSavedPlans(safeAccess);
        return snapshot();
    }

    public SnapshotData openSavedPlan(RuntimeAccess access, long planId) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        LoadPlanOutcome result = safeAccess.loadPlan(planId);
        if (result.status() != SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            state.status = result.message().isBlank() ? "Encounter konnte nicht geöffnet werden." : result.message();
            refreshSavedPlans(safeAccess);
            return snapshot();
        }
        SavedPlanData plan = result.plan().orElseThrow();
        state.roster.clear();
        for (PlanCreatureData creature : plan.creatures()) {
            safeAccess.loadCreature(creature.creatureId()).ifPresent(detail ->
                    state.roster.add(fromDetail(detail, creature.quantity(), SAVED_PLAN_CREATURE_ROLE, List.of())));
        }
        state.generatedAlternatives.clear();
        state.generationHistoryPresent = false;
        state.pendingInitiativeRows.clear();
        state.combatRuntime.clear();
        state.resultState = ResultStateData.empty();
        state.combatState = CombatProjectionData.empty();
        state.initiativeState = InitiativeStateData.empty();
        state.selectedAlternativeIndex = 0;
        state.generatedAdjustedXp = 0;
        state.generatedDifficulty = "";
        state.generatedTitle = plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel();
        state.pendingUndo = Optional.empty();
        state.activeSavedPlanId = OptionalLong.of(plan.id());
        state.round = FIRST_COMBAT_ROUND;
        state.currentTurnIndex = OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX);
        state.mode = Mode.BUILDER;
        state.status = plan.name() + " geöffnet.";
        refreshSavedPlans(safeAccess);
        return snapshot();
    }

    public SnapshotData clearGenerationHistory() {
        if (!state.generationHistoryPresent && state.generatedAlternatives.isEmpty()) {
            return snapshot();
        }
        state.generatedAlternatives.clear();
        state.selectedAlternativeIndex = 0;
        state.generatedAdjustedXp = 0;
        state.generatedDifficulty = "";
        state.generatedTitle = "";
        state.generationHistoryPresent = false;
        state.status = "Generator-Historie geleert.";
        return snapshot();
    }

    public SnapshotData shiftGeneratedAlternative(int delta) {
        if (state.generatedAlternatives.isEmpty()) {
            return snapshot();
        }
        state.selectedAlternativeIndex = Math.floorMod(
                state.selectedAlternativeIndex + delta,
                state.generatedAlternatives.size());
        applyGeneratedEncounter(state.generatedAlternatives.get(state.selectedAlternativeIndex));
        return snapshot();
    }

    public SnapshotData addCreature(RuntimeAccess access, long creatureId) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        Optional<CreatureDetailData> detail = safeAccess.loadCreature(creatureId);
        if (detail.isEmpty()) {
            state.status = "Kreatur konnte nicht geladen werden.";
            return snapshot();
        }
        CreatureDetailData creature = detail.orElseThrow();
        if (state.mode == Mode.COMBAT) {
            String activeTurnId = state.combatRuntime.activeTurnId(
                    state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
            String displayName = state.combatRuntime.addMonsterReinforcement(
                    creature.name(),
                    creature.id(),
                    minimumHitPoints(creature.hitPoints()),
                    creature.armorClass(),
                    creature.xp(),
                    creature.challengeRating(),
                    creature.creatureType(),
                    REINFORCEMENT_CREATURE_ROLE,
                    CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus()));
            state.currentTurnIndex = toOptionalTurnIndex(state.combatRuntime.turnIndexOf(
                    activeTurnId,
                    state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)));
            refreshCombatState();
            state.status = displayName + " betritt den laufenden Kampf.";
            return snapshot();
        }
        clearGeneratedSelection();
        for (int index = 0; index < state.roster.size(); index++) {
            EncounterCreatureData existing = state.roster.get(index);
            if (existing.creatureId() == creature.id()) {
                state.roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                state.status = creature.name() + " wurde zum Encounter hinzugefügt.";
                return snapshot();
            }
        }
        state.roster.add(fromDetail(creature, 1, MANUAL_CREATURE_ROLE, List.of()));
        state.status = creature.name() + " wurde zum Encounter hinzugefügt.";
        return snapshot();
    }

    public SnapshotData incrementCreature(long creatureId) {
        for (int index = 0; index < state.roster.size(); index++) {
            EncounterCreatureData creature = state.roster.get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection();
                state.roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                state.status = creature.name() + " Anzahl angepasst.";
                return snapshot();
            }
        }
        return snapshot();
    }

    public SnapshotData decrementCreature(long creatureId) {
        for (int index = 0; index < state.roster.size(); index++) {
            EncounterCreatureData creature = state.roster.get(index);
            if (creature.creatureId() != creatureId) {
                continue;
            }
            if (creature.count() <= 1) {
                state.status = creature.name() + " bleibt mindestens einmal im Roster.";
                return snapshot();
            }
            clearGeneratedSelection();
            state.roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
            state.status = creature.name() + " Anzahl angepasst.";
            return snapshot();
        }
        return snapshot();
    }

    public SnapshotData removeCreature(long creatureId) {
        for (int index = 0; index < state.roster.size(); index++) {
            EncounterCreatureData creature = state.roster.get(index);
            if (creature.creatureId() != creatureId) {
                continue;
            }
            clearGeneratedSelection();
            state.roster.remove(index);
            state.pendingUndo = Optional.of(new RemovedRosterEntryData(++state.nextUndoToken, index, creature));
            state.status = creature.name() + " wurde entfernt.";
            return snapshot();
        }
        return snapshot();
    }

    public SnapshotData undoRemove(long token) {
        if (state.pendingUndo.isEmpty() || state.pendingUndo.orElseThrow().token() != token) {
            return snapshot();
        }
        clearGeneratedSelection();
        RemovedRosterEntryData removed = state.pendingUndo.orElseThrow();
        int index = Math.max(0, Math.min(removed.index(), state.roster.size()));
        state.roster.add(index, removed.creature());
        state.pendingUndo = Optional.empty();
        state.status = removed.creature().name() + " wurde wiederhergestellt.";
        return snapshot();
    }

    public SnapshotData openInitiative() {
        if (state.roster.isEmpty()) {
            state.status = "Kampfstart braucht mindestens eine Kreatur.";
            return snapshot();
        }
        if (state.activeParty.isEmpty()) {
            state.status = "Kampfstart braucht aktive Party-Mitglieder.";
            return snapshot();
        }
        state.pendingInitiativeRows.clear();
        for (int index = 0; index < state.activeParty.size(); index++) {
            PartyMemberData member = state.activeParty.get(index);
            state.pendingInitiativeRows.add(new InitiativeEntryData(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    CombatantKind.PLAYER_CHARACTER,
                    CombatRuntime.defaultPlayerInitiative(index)));
        }
        for (EncounterCreatureData creature : state.roster) {
            int rolled = CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > 1 ? creature.name() + " x" + creature.count() : creature.name();
            state.pendingInitiativeRows.add(new InitiativeEntryData(
                    creature.id(),
                    label + " (" + signed(creature.initiativeBonus()) + ")",
                    CombatantKind.MONSTER,
                    rolled));
        }
        state.initiativeState = new InitiativeStateData(List.copyOf(state.pendingInitiativeRows));
        state.mode = Mode.INITIATIVE;
        state.status = "Initiativewerte prüfen und Kampf starten.";
        return snapshot();
    }

    public SnapshotData backToBuilder() {
        state.mode = Mode.BUILDER;
        state.status = "Zurück zur Encounter-Erstellung.";
        return snapshot();
    }

    public SnapshotData confirmInitiative(List<InitiativeInputData> initiatives) {
        state.combatRuntime.clear();
        int fallbackIndex = 0;
        for (InitiativeInputData input : safeInputs(initiatives)) {
            Optional<InitiativeEntryData> entry = initiativeEntry(input.id());
            if (entry.isEmpty()) {
                continue;
            }
            InitiativeEntryData current = entry.orElseThrow();
            if (current.kind() == CombatantKind.PLAYER_CHARACTER) {
                fallbackIndex = state.combatRuntime.addPlayer(
                        current.id(),
                        nameOnly(current.label()),
                        input.initiative(),
                        fallbackIndex);
                continue;
            }
            Optional<EncounterCreatureData> creature = creature(current.id());
            if (creature.isPresent()) {
                EncounterCreatureData currentCreature = creature.orElseThrow();
                fallbackIndex = state.combatRuntime.addMonsters(
                        currentCreature.id(),
                        currentCreature.name(),
                        currentCreature.creatureId(),
                        currentCreature.count(),
                        currentCreature.hp(),
                        currentCreature.ac(),
                        currentCreature.xp(),
                        currentCreature.cr(),
                        currentCreature.type(),
                        currentCreature.role(),
                        input.initiative(),
                        fallbackIndex);
            }
        }
        state.combatRuntime.sort();
        state.currentTurnIndex = state.combatRuntime.hasTurnEntries()
                ? OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX)
                : OptionalInt.empty();
        state.round = FIRST_COMBAT_ROUND;
        state.mode = Mode.COMBAT;
        refreshCombatState();
        state.status = "Kampf laeuft. HP und Initiative sind lokal editierbar.";
        return snapshot();
    }

    public SnapshotData nextTurn() {
        CombatRuntime.TurnAdvance turn = state.combatRuntime.nextTurn(
                state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                state.round);
        state.currentTurnIndex = toOptionalTurnIndex(turn.currentTurnIndex());
        state.round = turn.round();
        refreshCombatState();
        return snapshot();
    }

    public SnapshotData setInitiative(String combatantId, int initiative) {
        state.combatRuntime.setInitiative(combatantId, initiative);
        refreshCombatState();
        return snapshot();
    }

    public SnapshotData addPartyMemberToCombat(long partyMemberId, int initiative) {
        if (state.mode != Mode.COMBAT) {
            return snapshot();
        }
        Optional<PartyMemberData> member = partyMember(partyMemberId);
        if (member.isEmpty()) {
            state.status = "SC konnte nicht geladen werden.";
            return snapshot();
        }
        PartyMemberData currentMember = member.orElseThrow();
        String activeTurnId = state.combatRuntime.activeTurnId(
                state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
        boolean added = state.combatRuntime.addPlayerToRunningCombat(
                currentMember.id(),
                currentMember.name(),
                initiative);
        state.currentTurnIndex = toOptionalTurnIndex(state.combatRuntime.turnIndexOf(
                activeTurnId,
                state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)));
        refreshCombatState();
        state.status = added
                ? currentMember.name() + " betritt den laufenden Kampf."
                : currentMember.name() + " ist bereits im Kampf.";
        return snapshot();
    }

    public SnapshotData endCombat() {
        List<ResultEnemyData> enemies = state.combatRuntime.resultEnemies();
        int eligibleXp = enemies.stream()
                .filter(ResultEnemyData::defeatedByDefault)
                .mapToInt(ResultEnemyData::xp)
                .sum();
        int partySize = Math.max(1, state.activeParty.size());
        state.resultState = new ResultStateData(
                enemies,
                enemies.stream().filter(ResultEnemyData::defeatedByDefault).count(),
                eligibleXp,
                eligibleXp / partySize,
                NO_LOOT,
                "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                "",
                false,
                !state.activeParty.isEmpty(),
                partySize);
        state.mode = Mode.RESULTS;
        state.status = "Kampfergebnis bereit.";
        return snapshot();
    }

    public SnapshotData awardXp(RuntimeAccess access) {
        RuntimeAccess safeAccess = Objects.requireNonNull(access, "access");
        if (state.resultState.xpAwarded() || state.resultState.perPlayerXp() <= 0 || state.activeParty.isEmpty()) {
            return snapshot();
        }
        AwardXpOutcome result = safeAccess.awardXp(
                state.activeParty.stream().map(PartyMemberData::numericId).toList(),
                state.resultState.perPlayerXp());
        state.resultState = state.resultState.withAwardStatus(
                result.success() ? "XP an die aktive Party verteilt." : "XP konnte nicht verteilt werden.",
                result.success());
        if (result.success()) {
            loadActiveParty(safeAccess);
            loadBudgetIntoSession(safeAccess);
        }
        return snapshot();
    }

    public SnapshotData returnToBuilderAfterResults() {
        state.combatRuntime.clear();
        state.pendingInitiativeRows.clear();
        state.round = FIRST_COMBAT_ROUND;
        state.currentTurnIndex = OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX);
        state.initiativeState = InitiativeStateData.empty();
        state.combatState = CombatProjectionData.empty();
        state.resultState = ResultStateData.empty();
        state.mode = Mode.BUILDER;
        state.status = "Kampfergebnis geschlossen. Combat Planner bereit.";
        return snapshot();
    }

    public SnapshotData mutateHp(String combatantId, int amount, boolean healing) {
        if (state.combatRuntime.mutateHp(combatantId, Math.max(0, amount), healing)) {
            refreshCombatState();
        }
        return snapshot();
    }

    private void applyGeneratedEncounter(GeneratedEncounterData generated) {
        state.roster.clear();
        for (GeneratedCreatureData creature : generated.creatures()) {
            state.roster.add(fromGeneratedFallback(creature));
        }
        state.generatedAdjustedXp = generated.adjustedXp();
        state.generatedDifficulty = difficultyLabel(generated.achievedDifficulty());
        state.generatedTitle = generated.title();
    }

    private void clearGeneratedSelection() {
        state.pendingUndo = Optional.empty();
        state.activeSavedPlanId = OptionalLong.empty();
        state.generatedAlternatives.clear();
        state.generationHistoryPresent = false;
        state.selectedAlternativeIndex = 0;
        state.generatedAdjustedXp = 0;
        state.generatedDifficulty = "";
        state.generatedTitle = "";
    }

    private void loadActiveParty(RuntimeAccess access) {
        state.activeParty.clear();
        state.activeParty.addAll(access.loadActiveParty());
    }

    private void loadBudgetIntoSession(RuntimeAccess access) {
        state.budget = access.loadBudget();
    }

    private void refreshSavedPlans(RuntimeAccess access) {
        ListPlansOutcome result = access.listPlans();
        state.savedPlans.clear();
        if (result.status() == SavedPlanStatus.SUCCESS) {
            state.savedPlans.addAll(result.plans());
        } else if (!result.message().isBlank()) {
            state.status = result.message();
        }
    }

    private BuilderStateData builderState() {
        int adjustedXp = state.generatedAdjustedXp > 0
                ? state.generatedAdjustedXp
                : state.roster.stream().mapToInt(EncounterCreatureData::totalXp).sum();
        DifficultySummaryData difficulty = state.budget.isEmpty()
                ? new DifficultySummaryData(0, 0, 0, 0, adjustedXp, state.roster.isEmpty() ? "" : "Keine Party")
                : new DifficultySummaryData(
                        state.budget.orElseThrow().easyXp(),
                        state.budget.orElseThrow().mediumXp(),
                        state.budget.orElseThrow().hardXp(),
                        state.budget.orElseThrow().deadlyXp(),
                        adjustedXp,
                        state.generatedDifficulty.isBlank()
                                ? evaluateDifficulty(adjustedXp, state.budget.orElseThrow())
                                : state.generatedDifficulty);
        return new BuilderStateData(
                List.copyOf(state.activeParty),
                List.copyOf(state.roster),
                titleLabel(),
                difficulty,
                state.builderInputs,
                List.copyOf(state.savedPlans),
                !state.roster.isEmpty() && !state.activeParty.isEmpty(),
                state.generatedAlternatives.size() > 1,
                state.generatedAlternatives.size() > 1,
                !state.roster.isEmpty(),
                state.generationHistoryPresent || !state.generatedAlternatives.isEmpty(),
                state.pendingUndo);
    }

    private List<PartyMemberData> missingCombatPartyMembers() {
        List<String> activePcIds = state.combatState.cards().stream()
                .filter(CombatCardData::playerCharacter)
                .map(CombatCardData::id)
                .toList();
        return state.activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    private String saveName() {
        if (!state.generatedTitle.isBlank()) {
            return state.generatedTitle;
        }
        return state.roster.isEmpty() ? "Encounter" : "Manuelles Encounter";
    }

    private String titleLabel() {
        if (state.generatedTitle.isBlank()) {
            return state.roster.isEmpty() ? "" : "Manuelles Encounter";
        }
        if (state.generatedAlternatives.size() <= 1) {
            return state.generatedTitle;
        }
        return state.generatedTitle + " (" + (state.selectedAlternativeIndex + 1) + "/" + state.generatedAlternatives.size() + ")";
    }

    private void refreshCombatState() {
        CombatProjectionData projection = state.combatRuntime.combatProjection(
                state.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                state.round);
        state.currentTurnIndex = toOptionalTurnIndex(projection.currentTurnIndex());
        state.combatState = projection;
    }

    private GenerateRequestData generationCommand() {
        return new GenerateRequestData(
                state.builderInputs.creatureTypes(),
                state.builderInputs.creatureSubtypes(),
                state.builderInputs.biomes(),
                state.builderInputs.targetDifficulty(),
                DEFAULT_GENERATION_ALTERNATIVE_COUNT,
                state.builderInputs.tuning(),
                nextGenerationSeed(),
                state.builderInputs.encounterTableIds());
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }

    private static long nextGenerationSeed() {
        return Math.max(0L, System.nanoTime());
    }

    private static EncounterCreatureData fromDetail(
            CreatureDetailData detail,
            int quantity,
            String role,
            List<String> tags
    ) {
        return new EncounterCreatureData(
                "monster-" + detail.id(),
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                minimumHitPoints(detail.hitPoints()),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType(),
                role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role,
                Math.max(1, quantity),
                tags);
    }

    private static EncounterCreatureData fromGeneratedFallback(GeneratedCreatureData creature) {
        return new EncounterCreatureData(
                "monster-" + creature.creatureId(),
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                1,
                10,
                0,
                "",
                creature.role(),
                creature.quantity(),
                creature.tags());
    }

    private static String evaluateDifficulty(int adjustedXp, BudgetData budget) {
        if (adjustedXp >= budget.deadlyXp()) {
            return "Deadly";
        }
        if (adjustedXp >= budget.hardXp()) {
            return "Hard";
        }
        if (adjustedXp >= budget.mediumXp()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }

    private static String difficultyLabel(DifficultyBand band) {
        return switch (band == null ? DifficultyBand.MEDIUM : band) {
            case AUTO -> "Auto";
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    private static String generationSuccessText(GenerationResultData result) {
        StringBuilder text = new StringBuilder(result.encounters().size() + " Encounter-Optionen generiert.");
        if (result.diagnostics().isPresent()) {
            GenerationDiagnosticsData diagnostics = result.diagnostics().orElseThrow();
            text.append(" Ziel: ")
                    .append(difficultyLabel(diagnostics.resolvedDifficulty()))
                    .append(", Tuning: ")
                    .append(tuningLabel(diagnostics.resolvedTuning()))
                    .append('.');
        }
        if (result.fallbackUsed()) {
            text.append(" Fallback verwendet.");
        }
        return text.toString();
    }

    private static String tuningLabel(TuningData tuning) {
        TuningData effective = tuning == null ? TuningData.defaultTuning() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }

    private static String generationStatusText(GenerationStatus status) {
        return switch (status == null ? GenerationStatus.defaultFailure() : status) {
            case NO_ACTIVE_PARTY -> "Die aktive Party hat keine Mitglieder.";
            case NO_CREATURES -> "Keine Kreaturen passen zu diesen Filtern.";
            case NO_SOLUTION -> "Keine passende Encounter-Komposition gefunden.";
            case INVALID_REQUEST -> "Encounter-Filter sind ungültig.";
            case STORAGE_ERROR -> "Encounter konnte nicht generiert werden.";
            case SUCCESS -> "Encounter generiert.";
        };
    }

    private static List<InitiativeInputData> safeInputs(List<InitiativeInputData> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    private static int minimumHitPoints(int hitPoints) {
        return Math.max(1, hitPoints);
    }

    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }

    private Optional<InitiativeEntryData> initiativeEntry(String id) {
        return state.pendingInitiativeRows.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private Optional<EncounterCreatureData> creature(String id) {
        return state.roster.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private Optional<PartyMemberData> partyMember(long id) {
        return state.activeParty.stream()
                .filter(entry -> entry.numericId() == id)
                .findFirst();
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

    public enum DifficultyBand {
        AUTO,
        EASY,
        MEDIUM,
        HARD,
        DEADLY;

        public static DifficultyBand defaultBand() {
            return MEDIUM;
        }

        public static DifficultyBand autoBand() {
            return AUTO;
        }

        public boolean isAuto() {
            return this == AUTO;
        }
    }

    public enum GenerationStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        NO_SOLUTION,
        INVALID_REQUEST,
        STORAGE_ERROR;

        static GenerationStatus defaultFailure() {
            return STORAGE_ERROR;
        }
    }

    public enum SavedPlanStatus {
        SUCCESS,
        NOT_FOUND,
        INVALID_REQUEST,
        STORAGE_ERROR
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

    public record TuningData(
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        public static final int AUTO_BALANCE_LEVEL = -1;
        public static final double AUTO_AMOUNT_VALUE = -1.0;
        public static final int AUTO_DIVERSITY_LEVEL = -1;

        private static final int DEFAULT_BALANCE_LEVEL = 3;
        private static final double DEFAULT_AMOUNT_VALUE = 3.0;
        private static final int DEFAULT_DIVERSITY_LEVEL = 2;

        public TuningData {
            balanceLevel = normalizeBalance(balanceLevel);
            amountValue = normalizeAmount(amountValue);
            diversityLevel = normalizeDiversity(diversityLevel);
        }

        public static TuningData defaultTuning() {
            return new TuningData(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
        }

        public static TuningData autoTuning() {
            return new TuningData(AUTO_BALANCE_LEVEL, AUTO_AMOUNT_VALUE, AUTO_DIVERSITY_LEVEL);
        }

        private static int normalizeBalance(int value) {
            if (value == AUTO_BALANCE_LEVEL) {
                return AUTO_BALANCE_LEVEL;
            }
            return value < 1 || value > 5 ? DEFAULT_BALANCE_LEVEL : value;
        }

        private static double normalizeAmount(double value) {
            if (value == AUTO_AMOUNT_VALUE) {
                return AUTO_AMOUNT_VALUE;
            }
            return Double.isFinite(value) && value >= 1.0 && value <= 5.0 ? value : DEFAULT_AMOUNT_VALUE;
        }

        private static int normalizeDiversity(int value) {
            if (value == AUTO_DIVERSITY_LEVEL) {
                return AUTO_DIVERSITY_LEVEL;
            }
            return value < 1 || value > 4 ? DEFAULT_DIVERSITY_LEVEL : value;
        }
    }

    public record BuilderInputsData(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            DifficultyBand targetDifficulty,
            TuningData tuning,
            List<Long> encounterTableIds
    ) {
        public BuilderInputsData {
            creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
            creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            targetDifficulty = targetDifficulty == null ? DifficultyBand.autoBand() : targetDifficulty;
            tuning = tuning == null ? TuningData.autoTuning() : tuning;
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        }

        public static BuilderInputsData empty() {
            return new BuilderInputsData(
                    List.of(),
                    List.of(),
                    List.of(),
                    DifficultyBand.autoBand(),
                    TuningData.autoTuning(),
                    List.of());
        }
    }

    public record BuilderStateData(
            List<PartyMemberData> party,
            List<EncounterCreatureData> roster,
            String templateLabel,
            DifficultySummaryData difficulty,
            BuilderInputsData builderInputs,
            List<SavedPlanSummaryData> savedPlans,
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
            builderInputs = builderInputs == null ? BuilderInputsData.empty() : builderInputs;
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
                    BuilderInputsData.empty(),
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

    public record GenerateRequestData(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            DifficultyBand targetDifficulty,
            int alternativeCount,
            TuningData tuning,
            long generationSeed,
            List<Long> encounterTableIds
    ) {
        public GenerateRequestData {
            creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
            creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            targetDifficulty = targetDifficulty == null ? DifficultyBand.autoBand() : targetDifficulty;
            alternativeCount = Math.max(1, Math.min(10, alternativeCount <= 0 ? DEFAULT_GENERATION_ALTERNATIVE_COUNT : alternativeCount));
            tuning = tuning == null ? TuningData.defaultTuning() : tuning;
            generationSeed = Math.max(0L, generationSeed);
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        }
    }

    public record GeneratedEncounterData(
            String title,
            DifficultyBand achievedDifficulty,
            int adjustedXp,
            List<GeneratedCreatureData> creatures
    ) {
        public GeneratedEncounterData {
            title = title == null ? "" : title;
            achievedDifficulty = achievedDifficulty == null ? DifficultyBand.MEDIUM : achievedDifficulty;
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
            DifficultyBand resolvedDifficulty,
            TuningData resolvedTuning
    ) {
        public GenerationDiagnosticsData {
            resolvedDifficulty = resolvedDifficulty == null ? DifficultyBand.MEDIUM : resolvedDifficulty;
            resolvedTuning = resolvedTuning == null ? TuningData.defaultTuning() : resolvedTuning;
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

    private static final class State {
        private final List<PartyMemberData> activeParty = new ArrayList<>();
        private final List<EncounterCreatureData> roster = new ArrayList<>();
        private final List<GeneratedEncounterData> generatedAlternatives = new ArrayList<>();
        private final List<SavedPlanSummaryData> savedPlans = new ArrayList<>();
        private final List<InitiativeEntryData> pendingInitiativeRows = new ArrayList<>();
        private final CombatRuntime combatRuntime = new CombatRuntime();

        private Mode mode = Mode.BUILDER;
        private InitiativeStateData initiativeState = InitiativeStateData.empty();
        private CombatProjectionData combatState = CombatProjectionData.empty();
        private ResultStateData resultState = ResultStateData.empty();
        private BuilderInputsData builderInputs = BuilderInputsData.empty();
        private Optional<BudgetData> budget = Optional.empty();
        private int selectedAlternativeIndex;
        private int generatedAdjustedXp;
        private String generatedDifficulty = "";
        private String generatedTitle = "";
        private Optional<RemovedRosterEntryData> pendingUndo = Optional.empty();
        private boolean generationHistoryPresent;
        private OptionalLong activeSavedPlanId = OptionalLong.empty();
        private long nextUndoToken;
        private OptionalInt currentTurnIndex = OptionalInt.empty();
        private int round = FIRST_COMBAT_ROUND;
        private String status = DEFAULT_STATUS;
    }
}
