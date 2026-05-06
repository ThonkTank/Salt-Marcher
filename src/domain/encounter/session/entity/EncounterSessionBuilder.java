package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalLong;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;

final class EncounterSessionBuilder {

    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";
    private static final String DEFAULT_PLAN_NAME = "Encounter";
    private static final String DEFAULT_MANUAL_TITLE = "Manuelles Encounter";
    private static final String NO_PARTY_STATUS = "Die aktive Party hat keine Mitglieder.";
    private static final String GENERATION_FAILURE_STATUS = "Encounter konnte nicht generiert werden.";
    private static final String SAVE_NEEDS_CREATURE_STATUS = "Speichern braucht mindestens eine Kreatur im Encounter.";
    private static final String SAVE_FAILURE_STATUS = "Encounter konnte nicht gespeichert werden.";
    private static final String OPEN_FAILURE_STATUS = "Encounter konnte nicht geöffnet werden.";
    private static final String HISTORY_CLEARED_STATUS = "Generator-Historie geleert.";
    private static final String NO_PARTY_DIFFICULTY = "Keine Party";
    private static final int DEFAULT_GENERATION_ALTERNATIVE_COUNT = 5;
    private static final int MAX_CREATURES_PER_SLOT = 20;
    private static final int MINIMUM_CREATURE_COUNT = 1;
    private static final int SINGLE_ALTERNATIVE_COUNT = 1;

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

    void updateBuilderInputs(EncounterGenerationInputs nextInputs) {
        builderInputs = nextInputs == null ? EncounterGenerationInputs.empty() : nextInputs;
    }

    void generate(
            EncounterSession.RuntimeAccess access,
            Optional<EncounterGenerationRequest> request,
            EncounterSessionContext context
    ) {
        pendingUndo = Optional.empty();
        activeSavedPlanId = OptionalLong.empty();
        context.refresh(access);
        if (!context.hasActiveParty()) {
            context.setStatus(NO_PARTY_STATUS);
            return;
        }
        GenerationResultData result = access.generate(request.orElseGet(this::generationRequest));
        if (!result.success() || result.alternatives().isEmpty()) {
            clearGeneratedEncounterState();
            generatedAdvisories = List.of();
            context.setStatus(result.message().isBlank() ? GENERATION_FAILURE_STATUS : result.message());
            return;
        }
        generatedAlternatives.clear();
        generatedAlternatives.addAll(result.alternatives());
        generationHistoryPresent = true;
        selectedAlternativeIndex = 0;
        applyGeneratedEncounter(generatedAlternatives.getFirst());
        context.setStatus(generationSuccessText(result));
    }

    void saveCurrentPlan(EncounterSession.RuntimeAccess access, EncounterSessionContext context) {
        if (roster.isEmpty()) {
            context.setStatus(SAVE_NEEDS_CREATURE_STATUS);
            return;
        }
        SavePlanOutcome result = access.savePlan(new EncounterPlan(
                activeSavedPlanId.orElse(0L),
                saveName(),
                generatedTitle,
                roster.stream()
                        .map(creature -> new EncounterPlanCreature(creature.creatureId(), creature.count()))
                        .toList()));
        if (!result.success()) {
            context.setStatus(result.message().isBlank() ? SAVE_FAILURE_STATUS : result.message());
            context.refreshSavedPlans(access);
            return;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        activeSavedPlanId = OptionalLong.of(plan.id());
        context.setStatus(plan.name() + " gespeichert.");
        context.refreshSavedPlans(access);
    }

    void openSavedPlan(
            EncounterSession.RuntimeAccess access,
            long planId,
            EncounterSessionContext context,
            EncounterSessionCombat combat
    ) {
        LoadPlanOutcome result = access.loadPlan(planId);
        if (!result.success()) {
            context.setStatus(result.message().isBlank() ? OPEN_FAILURE_STATUS : result.message());
            context.refreshSavedPlans(access);
            return;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        roster.clear();
        for (EncounterPlanCreature creature : plan.creatures()) {
            access.loadCreature(creature.creatureId())
                    .ifPresent(detail -> roster.add(fromDetail(detail, creature.quantity(), SAVED_PLAN_CREATURE_ROLE, List.of())));
        }
        generatedAlternatives.clear();
        generationHistoryPresent = false;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel();
        generatedAdvisories = List.of();
        pendingUndo = Optional.empty();
        activeSavedPlanId = OptionalLong.of(plan.id());
        selectedAlternativeIndex = 0;
        combat.resetForLoadedPlan();
        context.enterBuilder(plan.name() + " geoeffnet.");
        context.refreshSavedPlans(access);
    }

    void clearGenerationHistory(EncounterSessionContext context) {
        if (!generationHistoryPresent && generatedAlternatives.isEmpty()) {
            return;
        }
        generatedAlternatives.clear();
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
        generationHistoryPresent = false;
        context.setStatus(HISTORY_CLEARED_STATUS);
    }

    void shiftGeneratedAlternative(int delta) {
        if (generatedAlternatives.isEmpty()) {
            return;
        }
        selectedAlternativeIndex = Math.floorMod(selectedAlternativeIndex + delta, generatedAlternatives.size());
        applyGeneratedEncounter(generatedAlternatives.get(selectedAlternativeIndex));
    }

    void addCreature(CreatureDetailData creature, EncounterSessionContext context) {
        clearGeneratedSelection();
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData existing = roster.get(index);
            if (existing.creatureId() == creature.id()) {
                roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
                return;
            }
        }
        roster.add(fromDetail(creature, MINIMUM_CREATURE_COUNT, MANUAL_CREATURE_ROLE, List.of()));
        context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
    }

    void incrementCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection();
                roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                context.setStatus(creature.name() + " Anzahl angepasst.");
                return;
            }
        }
    }

    void decrementCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (creature.creatureId() != creatureId) {
                continue;
            }
            if (creature.count() == MINIMUM_CREATURE_COUNT) {
                context.setStatus(creature.name() + " bleibt mindestens einmal im Roster.");
                return;
            }
            clearGeneratedSelection();
            roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
            context.setStatus(creature.name() + " Anzahl angepasst.");
            return;
        }
    }

    void removeCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (creature.creatureId() != creatureId) {
                continue;
            }
            clearGeneratedSelection();
            roster.remove(index);
            pendingUndo = Optional.of(new RemovedRosterEntryData(nextUndoToken(), index, creature));
            context.setStatus(creature.name() + " wurde entfernt.");
            return;
        }
    }

    void undoRemove(long token, EncounterSessionContext context) {
        if (pendingUndo.isEmpty()) {
            return;
        }
        RemovedRosterEntryData removed = pendingUndo.orElseThrow();
        if (removed.token() != token) {
            return;
        }
        clearGeneratedSelection();
        int index = Math.max(0, Math.min(removed.index(), roster.size()));
        roster.add(index, removed.creature());
        pendingUndo = Optional.empty();
        context.setStatus(removed.creature().name() + " wurde wiederhergestellt.");
    }

    EncounterGenerationInputs builderInputs() {
        return builderInputs;
    }

    List<EncounterCreatureData> roster() {
        return List.copyOf(roster);
    }

    BuilderStateData builderState(EncounterSessionContext context) {
        int adjustedXp = generatedAdjustedXp > 0 ? generatedAdjustedXp : roster.stream().mapToInt(EncounterCreatureData::totalXp).sum();
        BudgetData currentBudget = context.budget().orElse(null);
        DifficultySummaryData difficulty = currentBudget == null
                ? new DifficultySummaryData(
                        0,
                        0,
                        0,
                        0,
                        adjustedXp,
                        roster.isEmpty() ? "" : NO_PARTY_DIFFICULTY)
                : new DifficultySummaryData(
                        currentBudget.easyXp(),
                        currentBudget.mediumXp(),
                        currentBudget.hardXp(),
                        currentBudget.deadlyXp(),
                        adjustedXp,
                        generatedDifficulty.isBlank() ? evaluateDifficulty(adjustedXp, currentBudget) : generatedDifficulty);
        return new BuilderStateData(
                context.activeParty(),
                roster,
                titleLabel(),
                difficulty,
                builderInputs,
                generatedAdvisories,
                context.savedPlans(),
                !roster.isEmpty() && context.hasActiveParty(),
                hasMultipleAlternatives(),
                hasMultipleAlternatives(),
                !roster.isEmpty(),
                generationHistoryPresent || !generatedAlternatives.isEmpty(),
                pendingUndo);
    }

    private boolean hasMultipleAlternatives() {
        return generatedAlternatives.size() > SINGLE_ALTERNATIVE_COUNT;
    }

    private void clearGeneratedEncounterState() {
        generatedAlternatives.clear();
        selectedAlternativeIndex = 0;
        generationHistoryPresent = false;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
    }

    private void applyGeneratedEncounter(GeneratedEncounterData generated) {
        roster.clear();
        roster.addAll(generated.roster());
        generatedAdjustedXp = generated.adjustedXp();
        generatedDifficulty = generated.difficultyLabel();
        generatedTitle = generated.title();
        generatedAdvisories = generated.advisoryMessages();
    }

    private void clearGeneratedSelection() {
        pendingUndo = Optional.empty();
        activeSavedPlanId = OptionalLong.empty();
        generatedAlternatives.clear();
        generationHistoryPresent = false;
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
        generatedAdvisories = List.of();
    }

    private EncounterGenerationRequest generationRequest() {
        return new EncounterGenerationRequest(
                builderInputs,
                DEFAULT_GENERATION_ALTERNATIVE_COUNT,
                Math.max(0L, System.nanoTime()),
                List.of(),
                List.of());
    }

    private String saveName() {
        if (!generatedTitle.isBlank()) {
            return generatedTitle;
        }
        return roster.isEmpty() ? DEFAULT_PLAN_NAME : DEFAULT_MANUAL_TITLE;
    }

    private String titleLabel() {
        if (generatedTitle.isBlank()) {
            return roster.isEmpty() ? "" : DEFAULT_MANUAL_TITLE;
        }
        if (generatedAlternatives.size() <= SINGLE_ALTERNATIVE_COUNT) {
            return generatedTitle;
        }
        return generatedTitle + " (" + (selectedAlternativeIndex + 1) + "/" + generatedAlternatives.size() + ")";
    }

    private long nextUndoToken() {
        nextUndoToken++;
        return nextUndoToken;
    }

    private static int minimumHitPoints(int hitPoints) {
        return Math.max(1, hitPoints);
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
}
