package src.domain.encounter.session.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.OptionalLong;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterSession {

    public interface RuntimeAccess {

        List<PartyMemberData> loadActiveParty();

        Optional<BudgetData> loadBudget();

        GenerationResultData generate(EncounterGenerationRequest request);

        SavePlanOutcome savePlan(SavedPlanData plan);

        LoadPlanOutcome loadPlan(long planId);

        ListPlansOutcome listPlans();

        Optional<CreatureDetailData> loadCreature(long creatureId);

        AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter);
    }

    private static final String DEFAULT_STATUS = "Encounter bereit.";
    private static final String NO_LOOT = "Kein Loot";
    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";
    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";
    private static final int DEFAULT_GENERATION_ALTERNATIVE_COUNT = 5;
    private static final int FIRST_COMBAT_ROUND = 1;
    private static final int MAX_CREATURES_PER_SLOT = 20;

    private final ContextState context = new ContextState();
    private final BuilderState builder = new BuilderState();
    private final CombatState combat = new CombatState();

    public void refreshContext(RuntimeAccess access) {
        context.activeParty.clear();
        context.activeParty.addAll(access.loadActiveParty());
        context.budget = access.loadBudget();
        refreshSavedPlans(access);
    }

    public void updateBuilderInputs(EncounterGenerationInputs nextInputs) {
        builder.builderInputs = nextInputs == null ? EncounterGenerationInputs.empty() : nextInputs;
    }

    public void generate(RuntimeAccess access, Optional<EncounterGenerationRequest> request) {
        builder.pendingUndo = Optional.empty();
        builder.activeSavedPlanId = OptionalLong.empty();
        refreshContext(access);
        if (context.activeParty.isEmpty()) {
            context.status = "Die aktive Party hat keine Mitglieder.";
            return;
        }
        GenerationResultData result = access.generate(request.orElseGet(this::generationRequest));
        if (result.status() != GenerationStatus.SUCCESS || result.encounters().isEmpty()) {
            builder.generatedAlternatives.clear();
            builder.selectedAlternativeIndex = 0;
            builder.generationHistoryPresent = false;
            builder.generatedAdjustedXp = 0;
            builder.generatedDifficulty = "";
            builder.generatedTitle = "";
            context.status = result.message().isBlank() ? generationStatusText(result.status()) : result.message();
            return;
        }
        builder.generatedAlternatives.clear();
        builder.generatedAlternatives.addAll(result.encounters());
        builder.generationHistoryPresent = true;
        builder.selectedAlternativeIndex = 0;
        applyGeneratedEncounter(builder.generatedAlternatives.getFirst());
        context.status = generationSuccessText(result);
    }

    public void saveCurrentPlan(RuntimeAccess access) {
        if (builder.roster.isEmpty()) {
            context.status = "Speichern braucht mindestens eine Kreatur im Encounter.";
            return;
        }
        SavePlanOutcome result = access.savePlan(new SavedPlanData(
                builder.activeSavedPlanId.orElse(0L),
                saveName(),
                builder.generatedTitle,
                builder.roster.stream()
                        .map(creature -> new PlanCreatureData(creature.creatureId(), creature.count()))
                        .toList()));
        if (result.status() != SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            context.status = result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message();
            refreshSavedPlans(access);
            return;
        }
        SavedPlanData plan = result.plan().orElseThrow();
        builder.activeSavedPlanId = OptionalLong.of(plan.id());
        context.status = plan.name() + " gespeichert.";
        refreshSavedPlans(access);
    }

    public void openSavedPlan(RuntimeAccess access, long planId) {
        LoadPlanOutcome result = access.loadPlan(planId);
        if (result.status() != SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            context.status = result.message().isBlank() ? "Encounter konnte nicht geöffnet werden." : result.message();
            refreshSavedPlans(access);
            return;
        }
        SavedPlanData plan = result.plan().orElseThrow();
        builder.roster.clear();
        for (PlanCreatureData creature : plan.creatures()) {
            access.loadCreature(creature.creatureId())
                    .ifPresent(detail -> builder.roster.add(fromDetail(detail, creature.quantity(), SAVED_PLAN_CREATURE_ROLE, List.of())));
        }
        builder.generatedAlternatives.clear();
        builder.generationHistoryPresent = false;
        combat.pendingInitiativeRows.clear();
        combat.combatRuntime.clear();
        combat.resultState = ResultStateData.empty();
        builder.selectedAlternativeIndex = 0;
        builder.generatedAdjustedXp = 0;
        builder.generatedDifficulty = "";
        builder.generatedTitle = plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel();
        builder.pendingUndo = Optional.empty();
        builder.activeSavedPlanId = OptionalLong.of(plan.id());
        combat.currentTurnIndex = OptionalInt.empty();
        combat.round = FIRST_COMBAT_ROUND;
        context.mode = Mode.BUILDER;
        context.status = plan.name() + " geöffnet.";
        refreshSavedPlans(access);
    }

    public void clearGenerationHistory() {
        if (!builder.generationHistoryPresent && builder.generatedAlternatives.isEmpty()) {
            return;
        }
        builder.generatedAlternatives.clear();
        builder.selectedAlternativeIndex = 0;
        builder.generatedAdjustedXp = 0;
        builder.generatedDifficulty = "";
        builder.generatedTitle = "";
        builder.generationHistoryPresent = false;
        context.status = "Generator-Historie geleert.";
    }

    public void shiftGeneratedAlternative(int delta) {
        if (builder.generatedAlternatives.isEmpty()) {
            return;
        }
        builder.selectedAlternativeIndex = Math.floorMod(
                builder.selectedAlternativeIndex + delta,
                builder.generatedAlternatives.size());
        applyGeneratedEncounter(builder.generatedAlternatives.get(builder.selectedAlternativeIndex));
    }

    public void addCreature(RuntimeAccess access, long creatureId) {
        Optional<CreatureDetailData> detail = access.loadCreature(creatureId);
        if (detail.isEmpty()) {
            context.status = "Kreatur konnte nicht geladen werden.";
            return;
        }
        CreatureDetailData creature = detail.orElseThrow();
        if (context.mode == Mode.COMBAT) {
            addReinforcement(creature, REINFORCEMENT_CREATURE_ROLE);
            return;
        }
        clearGeneratedSelection();
        for (int index = 0; index < builder.roster.size(); index++) {
            EncounterCreatureData existing = builder.roster.get(index);
            if (existing.creatureId() == creature.id()) {
                builder.roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                context.status = creature.name() + " wurde zum Encounter hinzugefügt.";
                return;
            }
        }
        builder.roster.add(fromDetail(creature, 1, MANUAL_CREATURE_ROLE, List.of()));
        context.status = creature.name() + " wurde zum Encounter hinzugefügt.";
    }

    public void incrementCreature(long creatureId) {
        for (int index = 0; index < builder.roster.size(); index++) {
            EncounterCreatureData creature = builder.roster.get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection();
                builder.roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                context.status = creature.name() + " Anzahl angepasst.";
                return;
            }
        }
    }

    public void decrementCreature(long creatureId) {
        for (int index = 0; index < builder.roster.size(); index++) {
            EncounterCreatureData creature = builder.roster.get(index);
            if (creature.creatureId() == creatureId) {
                if (creature.count() == 1) {
                    context.status = creature.name() + " bleibt mindestens einmal im Roster.";
                    return;
                }
                clearGeneratedSelection();
                builder.roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
                context.status = creature.name() + " Anzahl angepasst.";
                return;
            }
        }
    }

    public void removeCreature(long creatureId) {
        for (int index = 0; index < builder.roster.size(); index++) {
            EncounterCreatureData creature = builder.roster.get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection();
                builder.roster.remove(index);
                builder.pendingUndo = Optional.of(new RemovedRosterEntryData(nextUndoToken(), index, creature));
                context.status = creature.name() + " wurde entfernt.";
                return;
            }
        }
    }

    public void undoRemove(long token) {
        if (builder.pendingUndo.isEmpty() || builder.pendingUndo.orElseThrow().token() != token) {
            return;
        }
        clearGeneratedSelection();
        RemovedRosterEntryData removed = builder.pendingUndo.orElseThrow();
        int index = Math.max(0, Math.min(removed.index(), builder.roster.size()));
        builder.roster.add(index, removed.creature());
        builder.pendingUndo = Optional.empty();
        context.status = removed.creature().name() + " wurde wiederhergestellt.";
    }

    public void openInitiative() {
        if (builder.roster.isEmpty()) {
            context.status = "Kampfstart braucht mindestens eine Kreatur.";
            return;
        }
        if (context.activeParty.isEmpty()) {
            context.status = "Kampfstart braucht aktive Party-Mitglieder.";
            return;
        }
        combat.pendingInitiativeRows.clear();
        for (int index = 0; index < context.activeParty.size(); index++) {
            PartyMemberData member = context.activeParty.get(index);
            combat.pendingInitiativeRows.add(new InitiativeEntryData(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    CombatantKind.PLAYER_CHARACTER,
                    CombatRuntime.defaultPlayerInitiative(index)));
        }
        for (EncounterCreatureData creature : builder.roster) {
            int rolled = CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > 1 ? creature.name() + " x" + creature.count() : creature.name();
            combat.pendingInitiativeRows.add(new InitiativeEntryData(
                    creature.id(),
                    label + " (" + signed(creature.initiativeBonus()) + ")",
                    CombatantKind.MONSTER,
                    rolled));
        }
        context.mode = Mode.INITIATIVE;
        context.status = "Initiativewerte prüfen und Kampf starten.";
    }

    public void backToBuilder() {
        context.mode = Mode.BUILDER;
        context.status = "Zurück zur Encounter-Erstellung.";
    }

    public void confirmInitiative(List<InitiativeInput> initiatives) {
        combat.combatRuntime.clear();
        int fallbackIndex = 0;
        for (InitiativeInput input : safeInitiatives(initiatives)) {
            Optional<InitiativeEntryData> entry = initiativeEntry(input.id());
            if (entry.isEmpty()) {
                continue;
            }
            InitiativeEntryData current = entry.orElseThrow();
            if (current.kind() == CombatantKind.PLAYER_CHARACTER) {
                fallbackIndex = combat.combatRuntime.addPlayer(
                        current.id(),
                        nameOnly(current.label()),
                        input.initiative(),
                        fallbackIndex);
                continue;
            }
            Optional<EncounterCreatureData> creature = rosterCreature(current.id());
            if (creature.isPresent()) {
                EncounterCreatureData currentCreature = creature.orElseThrow();
                fallbackIndex = combat.combatRuntime.addMonsters(
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
        combat.combatRuntime.sort();
        combat.currentTurnIndex = combat.combatRuntime.hasTurnEntries()
                ? OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX)
                : OptionalInt.empty();
        combat.round = FIRST_COMBAT_ROUND;
        context.mode = Mode.COMBAT;
        context.status = "Kampf laeuft. HP und Initiative sind lokal editierbar.";
    }

    public void advanceTurn() {
        CombatRuntime.TurnAdvance turn = combat.combatRuntime.nextTurn(
                combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                combat.round);
        combat.currentTurnIndex = toOptionalTurnIndex(turn.currentTurnIndex());
        combat.round = turn.round();
    }

    public void setInitiative(String combatantId, int initiative) {
        combat.combatRuntime.setInitiative(combatantId, initiative);
    }

    public void addPartyMemberToCombat(long partyMemberId, int initiative) {
        if (context.mode != Mode.COMBAT) {
            return;
        }
        Optional<PartyMemberData> member = partyMember(partyMemberId);
        if (member.isEmpty()) {
            context.status = "SC konnte nicht geladen werden.";
            return;
        }
        PartyMemberData currentMember = member.orElseThrow();
        String activeTurnId = combat.combatRuntime.activeTurnId(combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
        boolean added = combat.combatRuntime.addPlayerToRunningCombat(currentMember.id(), currentMember.name(), initiative);
        combat.currentTurnIndex = toOptionalTurnIndex(combat.combatRuntime.turnIndexOf(
                activeTurnId,
                combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)));
        context.status = added
                ? currentMember.name() + " betritt den laufenden Kampf."
                : currentMember.name() + " ist bereits im Kampf.";
    }

    public void endCombat() {
        List<ResultEnemyData> enemies = combat.combatRuntime.resultEnemies();
        int eligibleXp = enemies.stream()
                .filter(ResultEnemyData::defeatedByDefault)
                .mapToInt(ResultEnemyData::xp)
                .sum();
        int partySize = Math.max(1, context.activeParty.size());
        combat.resultState = new ResultStateData(
                enemies,
                enemies.stream().filter(ResultEnemyData::defeatedByDefault).count(),
                eligibleXp,
                eligibleXp / partySize,
                NO_LOOT,
                "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                "",
                false,
                !context.activeParty.isEmpty(),
                partySize);
        context.mode = Mode.RESULTS;
        context.status = "Kampfergebnis bereit.";
    }

    public void awardXp(RuntimeAccess access) {
        if (combat.resultState.xpAwarded() || combat.resultState.perPlayerXp() <= 0 || context.activeParty.isEmpty()) {
            return;
        }
        AwardXpOutcome outcome = access.awardXp(
                context.activeParty.stream().map(PartyMemberData::numericId).toList(),
                combat.resultState.perPlayerXp());
        combat.resultState = combat.resultState.withAwardStatus(
                outcome.success() ? "XP an die aktive Party verteilt." : "XP konnte nicht verteilt werden.",
                outcome.success());
        if (outcome.success()) {
            context.activeParty.clear();
            context.activeParty.addAll(access.loadActiveParty());
            context.budget = access.loadBudget();
        }
    }

    public void returnToBuilderAfterResults() {
        combat.combatRuntime.clear();
        combat.pendingInitiativeRows.clear();
        combat.resultState = ResultStateData.empty();
        combat.currentTurnIndex = OptionalInt.empty();
        combat.round = FIRST_COMBAT_ROUND;
        context.mode = Mode.BUILDER;
        context.status = "Kampfergebnis geschlossen. Combat Planner bereit.";
    }

    public void mutateHp(String combatantId, int amount, boolean healing) {
        if (combat.combatRuntime.mutateHp(combatantId, Math.max(0, amount), healing)) {
            combat.currentTurnIndex = toOptionalTurnIndex(combat.combatRuntime.turnIndexOf(
                    combat.combatRuntime.activeTurnId(combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)),
                    combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)));
        }
    }

    public Snapshot snapshot() {
        return new Snapshot(
                context.mode,
                builderState(),
                new InitiativeStateData(combat.pendingInitiativeRows),
                combatProjection(),
                combat.resultState,
                context.status,
                missingCombatPartyMembers());
    }

    private BuilderStateData builderState() {
        int adjustedXp = builder.generatedAdjustedXp > 0
                ? builder.generatedAdjustedXp
                : builder.roster.stream().mapToInt(EncounterCreatureData::totalXp).sum();
        BudgetData currentBudget = context.budget.orElse(null);
        DifficultySummaryData difficulty = currentBudget == null
                ? new DifficultySummaryData(
                        0,
                        0,
                        0,
                        0,
                        adjustedXp,
                        builder.roster.isEmpty() ? "" : "Keine Party")
                : new DifficultySummaryData(
                        currentBudget.easyXp(),
                        currentBudget.mediumXp(),
                        currentBudget.hardXp(),
                        currentBudget.deadlyXp(),
                        adjustedXp,
                        builder.generatedDifficulty.isBlank()
                                ? evaluateDifficulty(adjustedXp, currentBudget)
                                : builder.generatedDifficulty);
        return new BuilderStateData(
                context.activeParty,
                builder.roster,
                titleLabel(),
                difficulty,
                builder.builderInputs,
                context.savedPlans,
                !builder.roster.isEmpty() && !context.activeParty.isEmpty(),
                builder.generatedAlternatives.size() > 1,
                builder.generatedAlternatives.size() > 1,
                !builder.roster.isEmpty(),
                builder.generationHistoryPresent || !builder.generatedAlternatives.isEmpty(),
                builder.pendingUndo);
    }

    private CombatProjectionData combatProjection() {
        if (!combat.combatRuntime.hasTurnEntries()) {
            return CombatProjectionData.empty();
        }
        CombatProjectionData projection = combat.combatRuntime.combatProjection(
                combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                combat.round);
        combat.currentTurnIndex = toOptionalTurnIndex(projection.currentTurnIndex());
        return projection;
    }

    private List<PartyMemberData> missingCombatPartyMembers() {
        List<String> activePcIds = combatProjection().cards().stream()
                .filter(CombatCardData::playerCharacter)
                .map(CombatCardData::id)
                .toList();
        return context.activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    private void refreshSavedPlans(RuntimeAccess access) {
        ListPlansOutcome result = access.listPlans();
        context.savedPlans.clear();
        if (result.status() == SavedPlanStatus.SUCCESS) {
            context.savedPlans.addAll(result.plans());
        } else if (!result.message().isBlank()) {
            context.status = result.message();
        }
    }

    private void applyGeneratedEncounter(GeneratedEncounterData generated) {
        builder.roster.clear();
        for (GeneratedCreatureData creature : generated.creatures()) {
            builder.roster.add(fromGeneratedFallback(creature));
        }
        builder.generatedAdjustedXp = generated.adjustedXp();
        builder.generatedDifficulty = difficultyLabel(generated.achievedDifficulty());
        builder.generatedTitle = generated.title();
    }

    private void clearGeneratedSelection() {
        builder.pendingUndo = Optional.empty();
        builder.activeSavedPlanId = OptionalLong.empty();
        builder.generatedAlternatives.clear();
        builder.generationHistoryPresent = false;
        builder.selectedAlternativeIndex = 0;
        builder.generatedAdjustedXp = 0;
        builder.generatedDifficulty = "";
        builder.generatedTitle = "";
    }

    private EncounterGenerationRequest generationRequest() {
        return new EncounterGenerationRequest(
                builder.builderInputs,
                DEFAULT_GENERATION_ALTERNATIVE_COUNT,
                Math.max(0L, System.nanoTime()),
                List.of(),
                List.of());
    }

    private String saveName() {
        if (!builder.generatedTitle.isBlank()) {
            return builder.generatedTitle;
        }
        return builder.roster.isEmpty() ? "Encounter" : "Manuelles Encounter";
    }

    private String titleLabel() {
        if (builder.generatedTitle.isBlank()) {
            return builder.roster.isEmpty() ? "" : "Manuelles Encounter";
        }
        if (builder.generatedAlternatives.size() <= 1) {
            return builder.generatedTitle;
        }
        return builder.generatedTitle + " (" + (builder.selectedAlternativeIndex + 1) + "/" + builder.generatedAlternatives.size() + ")";
    }

    private void addReinforcement(CreatureDetailData creature, String reinforcementRole) {
        String activeTurnId = combat.combatRuntime.activeTurnId(combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
        String displayName = combat.combatRuntime.addMonsterReinforcement(
                creature.name(),
                creature.id(),
                minimumHitPoints(creature.hitPoints()),
                creature.armorClass(),
                creature.xp(),
                creature.challengeRating(),
                creature.creatureType(),
                reinforcementRole,
                CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus()));
        combat.currentTurnIndex = toOptionalTurnIndex(combat.combatRuntime.turnIndexOf(
                activeTurnId,
                combat.currentTurnIndex.orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX)));
        context.status = displayName + " betritt den laufenden Kampf.";
    }

    private Optional<InitiativeEntryData> initiativeEntry(String id) {
        return combat.pendingInitiativeRows.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private Optional<EncounterCreatureData> rosterCreature(String id) {
        return builder.roster.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private Optional<PartyMemberData> partyMember(long id) {
        return context.activeParty.stream()
                .filter(entry -> entry.numericId() == id)
                .findFirst();
    }

    private long nextUndoToken() {
        builder.nextUndoToken++;
        return builder.nextUndoToken;
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }

    private static List<InitiativeInput> safeInitiatives(List<InitiativeInput> initiatives) {
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

    private static String difficultyLabel(EncounterDifficultyIntent band) {
        return switch (band == null ? EncounterDifficultyIntent.MEDIUM : band) {
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

    private static String tuningLabel(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }

    private static String generationStatusText(GenerationStatus status) {
        GenerationStatus effectiveStatus = status == null ? GenerationStatus.defaultFailure() : status;
        return switch (effectiveStatus) {
            case NO_ACTIVE_PARTY -> "Die aktive Party hat keine Mitglieder.";
            case NO_CREATURES -> "Keine Kreaturen passen zu diesen Filtern.";
            case NO_SOLUTION -> "Keine passende Encounter-Komposition gefunden.";
            case INVALID_REQUEST -> "Encounter-Filter sind ungültig.";
            case STORAGE_ERROR -> "Encounter konnte nicht generiert werden.";
            case SUCCESS -> "Encounter generiert.";
        };
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
                role,
                quantity,
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
            role = role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
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

    public record InitiativeInput(String id, int initiative) {
        public InitiativeInput {
            id = id == null ? "" : id;
        }
    }

    public record InitiativeStateData(List<InitiativeEntryData> entries) {
        public InitiativeStateData {
            entries = entries == null ? List.of() : List.copyOf(entries);
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
                    false,
                    false,
                    false,
                    false,
                    false,
                    Optional.empty())
                    : builderState;
            initiativeState = initiativeState == null ? new InitiativeStateData(List.of()) : initiativeState;
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

    private static final class ContextState {
        private final List<PartyMemberData> activeParty = new ArrayList<>();
        private final List<SavedPlanSummaryData> savedPlans = new ArrayList<>();
        private Mode mode = Mode.BUILDER;
        private Optional<BudgetData> budget = Optional.empty();
        private String status = DEFAULT_STATUS;
    }

    private static final class BuilderState {
        private final List<EncounterCreatureData> roster = new ArrayList<>();
        private final List<GeneratedEncounterData> generatedAlternatives = new ArrayList<>();
        private EncounterGenerationInputs builderInputs = EncounterGenerationInputs.empty();
        private int selectedAlternativeIndex;
        private int generatedAdjustedXp;
        private String generatedDifficulty = "";
        private String generatedTitle = "";
        private Optional<RemovedRosterEntryData> pendingUndo = Optional.empty();
        private boolean generationHistoryPresent;
        private OptionalLong activeSavedPlanId = OptionalLong.empty();
        private long nextUndoToken;
    }

    private static final class CombatState {
        private final List<InitiativeEntryData> pendingInitiativeRows = new ArrayList<>();
        private final CombatRuntime combatRuntime = new CombatRuntime();
        private ResultStateData resultState = ResultStateData.empty();
        private OptionalInt currentTurnIndex = OptionalInt.empty();
        private int round = FIRST_COMBAT_ROUND;
    }
}
