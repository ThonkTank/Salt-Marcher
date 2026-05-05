package src.domain.encounter.session.service;

import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.OptionalLong;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.session.entity.CombatRuntime;
import src.domain.encounter.session.entity.EncounterSessionRuntimeData;
import src.domain.encounter.session.entity.EncounterSessionState;
import src.domain.encounter.session.entity.EncounterSessionViewState;

public final class EncounterSessionBuilderService {

    private static final int DEFAULT_GENERATION_ALTERNATIVE_COUNT = 5;
    private static final int MAX_CREATURES_PER_SLOT = 20;
    private static final int FIRST_COMBAT_ROUND = 1;
    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";
    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";

    private EncounterSessionBuilderService() {
    }

    public static void refreshPartyContext(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        loadActiveParty(state, access);
        loadBudgetIntoSession(state, access);
        refreshSavedPlans(state, access);
    }

    public static void updateBuilderInputs(EncounterSessionState state, EncounterGenerationInputs nextInputs) {
        state.builder().setBuilderInputs(nextInputs == null ? EncounterGenerationInputs.empty() : nextInputs);
    }

    public static void generate(
            EncounterSessionState state,
            EncounterSessionRuntimeAccess access,
            Optional<EncounterGenerationRequest> request
    ) {
        state.builder().setPendingUndo(Optional.empty());
        state.builder().setActiveSavedPlanId(OptionalLong.empty());
        loadActiveParty(state, access);
        loadBudgetIntoSession(state, access);
        if (state.context().activeParty().isEmpty()) {
            state.context().setStatus("Die aktive Party hat keine Mitglieder.");
            return;
        }
        EncounterSessionRuntimeData.GenerationResultData result = access.generate(
                request.orElseGet(() -> generationCommand(state.builder().builderInputs())));
        if (result.status() != EncounterSessionRuntimeData.GenerationStatus.SUCCESS || result.encounters().isEmpty()) {
            state.builder().generatedAlternatives().clear();
            state.builder().setSelectedAlternativeIndex(0);
            state.builder().setGenerationHistoryPresent(false);
            state.context().setStatus(result.message().isBlank() ? generationStatusText(result.status()) : result.message());
            return;
        }
        state.builder().generatedAlternatives().clear();
        state.builder().generatedAlternatives().addAll(result.encounters());
        state.builder().setGenerationHistoryPresent(true);
        state.builder().setSelectedAlternativeIndex(0);
        applyGeneratedEncounter(state.builder(), state.builder().generatedAlternatives().getFirst());
        state.context().setStatus(generationSuccessText(result));
    }

    public static void saveCurrentPlan(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        if (state.builder().roster().isEmpty()) {
            state.context().setStatus("Speichern braucht mindestens eine Kreatur im Encounter.");
            return;
        }
        EncounterSessionRuntimeData.SavePlanOutcome result = access.savePlan(new EncounterSessionRuntimeData.SavedPlanData(
                state.builder().activeSavedPlanId().orElse(0L),
                saveName(state.builder()),
                state.builder().generatedTitle(),
                state.builder().roster().stream()
                        .map(creature -> new EncounterSessionRuntimeData.PlanCreatureData(
                                creature.creatureId(),
                                creature.count()))
                        .toList()));
        if (result.status() != EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            state.context().setStatus(result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message());
            refreshSavedPlans(state, access);
            return;
        }
        EncounterSessionRuntimeData.SavedPlanData plan = result.plan().orElseThrow();
        state.builder().setActiveSavedPlanId(OptionalLong.of(plan.id()));
        state.context().setStatus(plan.name() + " gespeichert.");
        refreshSavedPlans(state, access);
    }

    public static void openSavedPlan(EncounterSessionState state, EncounterSessionRuntimeAccess access, long planId) {
        EncounterSessionRuntimeData.LoadPlanOutcome result = access.loadPlan(planId);
        if (result.status() != EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS || result.plan().isEmpty()) {
            state.context().setStatus(result.message().isBlank() ? "Encounter konnte nicht geöffnet werden." : result.message());
            refreshSavedPlans(state, access);
            return;
        }
        EncounterSessionRuntimeData.SavedPlanData plan = result.plan().orElseThrow();
        state.builder().roster().clear();
        for (EncounterSessionRuntimeData.PlanCreatureData creature : plan.creatures()) {
            access.loadCreature(creature.creatureId()).ifPresent(detail ->
                    state.builder().roster().add(fromDetail(detail, creature.quantity(), SAVED_PLAN_CREATURE_ROLE, List.of())));
        }
        state.builder().generatedAlternatives().clear();
        state.builder().setGenerationHistoryPresent(false);
        state.combat().pendingInitiativeRows().clear();
        state.combat().combatRuntime().clear();
        state.combat().setResultState(EncounterSessionViewState.ResultStateData.empty());
        state.combat().setCombatState(EncounterSessionViewState.CombatProjectionData.empty());
        state.combat().setInitiativeState(EncounterSessionViewState.InitiativeStateData.empty());
        state.builder().setSelectedAlternativeIndex(0);
        state.builder().setGeneratedAdjustedXp(0);
        state.builder().setGeneratedDifficulty("");
        state.builder().setGeneratedTitle(plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel());
        state.builder().setPendingUndo(Optional.empty());
        state.builder().setActiveSavedPlanId(OptionalLong.of(plan.id()));
        state.combat().setRound(FIRST_COMBAT_ROUND);
        state.combat().setCurrentTurnIndex(OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX));
        state.context().setMode(EncounterSessionViewState.Mode.BUILDER);
        state.context().setStatus(plan.name() + " geöffnet.");
        refreshSavedPlans(state, access);
    }

    public static void clearGenerationHistory(EncounterSessionState state) {
        if (!state.builder().generationHistoryPresent() && state.builder().generatedAlternatives().isEmpty()) {
            return;
        }
        state.builder().generatedAlternatives().clear();
        state.builder().setSelectedAlternativeIndex(0);
        state.builder().setGeneratedAdjustedXp(0);
        state.builder().setGeneratedDifficulty("");
        state.builder().setGeneratedTitle("");
        state.builder().setGenerationHistoryPresent(false);
        state.context().setStatus("Generator-Historie geleert.");
    }

    public static void shiftGeneratedAlternative(EncounterSessionState state, int delta) {
        if (state.builder().generatedAlternatives().isEmpty()) {
            return;
        }
        state.builder().setSelectedAlternativeIndex(Math.floorMod(
                state.builder().selectedAlternativeIndex() + delta,
                state.builder().generatedAlternatives().size()));
        applyGeneratedEncounter(
                state.builder(),
                state.builder().generatedAlternatives().get(state.builder().selectedAlternativeIndex()));
    }

    public static void addCreature(EncounterSessionState state, EncounterSessionRuntimeAccess access, long creatureId) {
        Optional<EncounterSessionRuntimeData.CreatureDetailData> detail = access.loadCreature(creatureId);
        if (detail.isEmpty()) {
            state.context().setStatus("Kreatur konnte nicht geladen werden.");
            return;
        }
        EncounterSessionRuntimeData.CreatureDetailData creature = detail.orElseThrow();
        if (state.context().mode() == EncounterSessionViewState.Mode.COMBAT) {
            EncounterSessionCombatService.addReinforcement(state, creature, REINFORCEMENT_CREATURE_ROLE);
            return;
        }
        clearGeneratedSelection(state.builder());
        for (int index = 0; index < state.builder().roster().size(); index++) {
            EncounterSessionViewState.EncounterCreatureData existing = state.builder().roster().get(index);
            if (existing.creatureId() == creature.id()) {
                state.builder().roster().set(
                        index,
                        existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                state.context().setStatus(creature.name() + " wurde zum Encounter hinzugefügt.");
                return;
            }
        }
        state.builder().roster().add(fromDetail(creature, 1, MANUAL_CREATURE_ROLE, List.of()));
        state.context().setStatus(creature.name() + " wurde zum Encounter hinzugefügt.");
    }

    public static void incrementCreature(EncounterSessionState state, long creatureId) {
        for (int index = 0; index < state.builder().roster().size(); index++) {
            EncounterSessionViewState.EncounterCreatureData creature = state.builder().roster().get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection(state.builder());
                state.builder().roster().set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                state.context().setStatus(creature.name() + " Anzahl angepasst.");
                return;
            }
        }
    }

    public static void decrementCreature(EncounterSessionState state, long creatureId) {
        for (int index = 0; index < state.builder().roster().size(); index++) {
            EncounterSessionViewState.EncounterCreatureData creature = state.builder().roster().get(index);
            if (creature.creatureId() == creatureId) {
                if (creature.count() == 1) {
                    state.context().setStatus(creature.name() + " bleibt mindestens einmal im Roster.");
                    return;
                }
                clearGeneratedSelection(state.builder());
                state.builder().roster().set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
                state.context().setStatus(creature.name() + " Anzahl angepasst.");
                return;
            }
        }
    }

    public static void removeCreature(EncounterSessionState state, long creatureId) {
        for (int index = 0; index < state.builder().roster().size(); index++) {
            EncounterSessionViewState.EncounterCreatureData creature = state.builder().roster().get(index);
            if (creature.creatureId() == creatureId) {
                clearGeneratedSelection(state.builder());
                state.builder().roster().remove(index);
                long nextToken = state.builder().nextUndoToken();
                state.builder().setPendingUndo(Optional.of(
                        new EncounterSessionViewState.RemovedRosterEntryData(nextToken, index, creature)));
                state.context().setStatus(creature.name() + " wurde entfernt.");
                return;
            }
        }
    }

    public static void undoRemove(EncounterSessionState state, long token) {
        if (state.builder().pendingUndo().isEmpty() || state.builder().pendingUndo().orElseThrow().token() != token) {
            return;
        }
        clearGeneratedSelection(state.builder());
        EncounterSessionViewState.RemovedRosterEntryData removed = state.builder().pendingUndo().orElseThrow();
        int index = Math.max(0, Math.min(removed.index(), state.builder().roster().size()));
        state.builder().roster().add(index, removed.creature());
        state.builder().setPendingUndo(Optional.empty());
        state.context().setStatus(removed.creature().name() + " wurde wiederhergestellt.");
    }

    private static void applyGeneratedEncounter(
            EncounterSessionState.BuilderState state,
            EncounterSessionRuntimeData.GeneratedEncounterData generated
    ) {
        state.roster().clear();
        for (EncounterSessionRuntimeData.GeneratedCreatureData creature : generated.creatures()) {
            state.roster().add(fromGeneratedFallback(creature));
        }
        state.setGeneratedAdjustedXp(generated.adjustedXp());
        state.setGeneratedDifficulty(difficultyLabel(generated.achievedDifficulty()));
        state.setGeneratedTitle(generated.title());
    }

    private static void clearGeneratedSelection(EncounterSessionState.BuilderState state) {
        state.setPendingUndo(Optional.empty());
        state.setActiveSavedPlanId(OptionalLong.empty());
        state.generatedAlternatives().clear();
        state.setGenerationHistoryPresent(false);
        state.setSelectedAlternativeIndex(0);
        state.setGeneratedAdjustedXp(0);
        state.setGeneratedDifficulty("");
        state.setGeneratedTitle("");
    }

    private static void loadActiveParty(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        state.context().replaceActiveParty(access.loadActiveParty());
    }

    private static void loadBudgetIntoSession(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        state.context().setBudget(access.loadBudget());
    }

    private static void refreshSavedPlans(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        EncounterSessionRuntimeData.ListPlansOutcome result = access.listPlans();
        state.context().clearSavedPlans();
        if (result.status() == EncounterSessionRuntimeData.SavedPlanStatus.SUCCESS) {
            state.context().savedPlans().addAll(result.plans());
        } else if (!result.message().isBlank()) {
            state.context().setStatus(result.message());
        }
    }

    private static EncounterGenerationRequest generationCommand(EncounterGenerationInputs builderInputs) {
        return new EncounterGenerationRequest(
                builderInputs,
                DEFAULT_GENERATION_ALTERNATIVE_COUNT,
                Math.max(0L, System.nanoTime()),
                List.of(),
                List.of());
    }

    private static String saveName(EncounterSessionState.BuilderState state) {
        if (!state.generatedTitle().isBlank()) {
            return state.generatedTitle();
        }
        return state.roster().isEmpty() ? "Encounter" : "Manuelles Encounter";
    }

    private static String difficultyLabel(EncounterDifficultyIntent band) {
        return switch (band == null ? EncounterDifficultyIntent.MEDIUM : band) {
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    private static String generationSuccessText(EncounterSessionRuntimeData.GenerationResultData result) {
        StringBuilder text = new StringBuilder(result.encounters().size() + " Encounter-Optionen generiert.");
        if (result.diagnostics().isPresent()) {
            EncounterSessionRuntimeData.GenerationDiagnosticsData diagnostics = result.diagnostics().orElseThrow();
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

    private static String generationStatusText(EncounterSessionRuntimeData.GenerationStatus status) {
        EncounterSessionRuntimeData.GenerationStatus effectiveStatus = status == null
                ? EncounterSessionRuntimeData.GenerationStatus.defaultFailure()
                : status;
        return switch (effectiveStatus) {
            case NO_ACTIVE_PARTY -> "Die aktive Party hat keine Mitglieder.";
            case NO_CREATURES -> "Keine Kreaturen passen zu diesen Filtern.";
            case NO_SOLUTION -> "Keine passende Encounter-Komposition gefunden.";
            case INVALID_REQUEST -> "Encounter-Filter sind ungültig.";
            case STORAGE_ERROR -> "Encounter konnte nicht generiert werden.";
            case SUCCESS -> "Encounter generiert.";
        };
    }

    private static EncounterSessionViewState.EncounterCreatureData fromDetail(
            EncounterSessionRuntimeData.CreatureDetailData detail,
            int quantity,
            String role,
            List<String> tags
    ) {
        return new EncounterSessionViewState.EncounterCreatureData(
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

    private static EncounterSessionViewState.EncounterCreatureData fromGeneratedFallback(
            EncounterSessionRuntimeData.GeneratedCreatureData creature
    ) {
        return new EncounterSessionViewState.EncounterCreatureData(
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

    private static int minimumHitPoints(int hitPoints) {
        return Math.max(1, hitPoints);
    }
}
