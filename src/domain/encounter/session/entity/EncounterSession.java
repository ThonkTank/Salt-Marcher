package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

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
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;

public final class EncounterSession {

    public interface RuntimeAccess {

        List<PartyMemberData> loadActiveParty();

        Optional<BudgetData> loadBudget();

        GenerationResultData generate(EncounterGenerationRequest request);

        SavePlanOutcome savePlan(EncounterPlan plan);

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
        if (!result.success() || result.alternatives().isEmpty()) {
            builder.generatedAlternatives.clear();
            builder.selectedAlternativeIndex = 0;
            builder.generationHistoryPresent = false;
            builder.generatedAdjustedXp = 0;
            builder.generatedDifficulty = "";
            builder.generatedTitle = "";
            builder.generatedAdvisories = List.of();
            context.status = result.message().isBlank() ? "Encounter konnte nicht generiert werden." : result.message();
            return;
        }
        builder.generatedAlternatives.clear();
        builder.generatedAlternatives.addAll(result.alternatives());
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
        SavePlanOutcome result = access.savePlan(new EncounterPlan(
                builder.activeSavedPlanId.orElse(0L),
                saveName(),
                builder.generatedTitle,
                builder.roster.stream()
                        .map(creature -> new EncounterPlanCreature(creature.creatureId(), creature.count()))
                        .toList()));
        if (!result.success()) {
            context.status = result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message();
            refreshSavedPlans(access);
            return;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        builder.activeSavedPlanId = OptionalLong.of(plan.id());
        context.status = plan.name() + " gespeichert.";
        refreshSavedPlans(access);
    }

    public void openSavedPlan(RuntimeAccess access, long planId) {
        LoadPlanOutcome result = access.loadPlan(planId);
        if (!result.success()) {
            context.status = result.message().isBlank() ? "Encounter konnte nicht geöffnet werden." : result.message();
            refreshSavedPlans(access);
            return;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        builder.roster.clear();
        for (EncounterPlanCreature creature : plan.creatures()) {
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
        builder.generatedAdvisories = List.of();
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
                        currentCreature.armorClass(),
                        currentCreature.xp(),
                        currentCreature.challengeRating(),
                        currentCreature.creatureType(),
                        currentCreature.encounterRole(),
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

    public void adjustInitiative(String combatantId, int initiative) {
        combat.combatRuntime.adjustInitiative(combatantId, initiative);
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
                builder.generatedAdvisories,
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
        if (result.success()) {
            context.savedPlans.addAll(result.plans());
        } else if (!result.message().isBlank()) {
            context.status = result.message();
        }
    }

    private void applyGeneratedEncounter(GeneratedEncounterData generated) {
        builder.roster.clear();
        builder.roster.addAll(generated.roster());
        builder.generatedAdjustedXp = generated.adjustedXp();
        builder.generatedDifficulty = generated.difficultyLabel();
        builder.generatedTitle = generated.title();
        builder.generatedAdvisories = generated.advisoryMessages();
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
        builder.generatedAdvisories = List.of();
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
        StringBuilder text = new StringBuilder(result.alternatives().size() + " Encounter-Optionen generiert.");
        if (result.diagnostics().isPresent()) {
            GenerationDiagnosticsData diagnostics = result.diagnostics().orElseThrow();
            text.append(" Ziel: ")
                    .append(diagnostics.difficultyLabel())
                    .append(", Tuning: ")
                    .append(diagnostics.tuningLabel())
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

    private static final class ContextState {
        private final List<PartyMemberData> activeParty = new ArrayList<>();
        private final List<EncounterPlanSummary> savedPlans = new ArrayList<>();
        private Mode mode = Mode.BUILDER;
        private Optional<BudgetData> budget = Optional.empty();
        private String status = DEFAULT_STATUS;
    }

    private static final class BuilderState {
        private final List<EncounterCreatureData> roster = new ArrayList<>();
        private final List<GeneratedEncounterData> generatedAlternatives = new ArrayList<>();
        private EncounterGenerationInputs builderInputs = EncounterGenerationInputs.empty();
        private List<String> generatedAdvisories = List.of();
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
