package features.encounter.domain.session;

import java.util.List;
import java.util.Optional;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterGenerationRequest;

final class EncounterSessionBuilder {

    private final EncounterSessionRosterMutation roster = new EncounterSessionRosterMutation();
    private final EncounterSessionGeneration generation = new EncounterSessionGeneration();
    private final EncounterSessionSavedPlans savedPlans = new EncounterSessionSavedPlans();
    private boolean dirty;

    void updateBuilderInputs(EncounterGenerationInputs nextInputs) {
        generation.updateBuilderInputs(nextInputs);
    }

    void generate(
            EncounterSession.SessionRepository access,
            Optional<EncounterGenerationRequest> request,
            EncounterSessionContext context
    ) {
        roster.clearPendingUndo();
        savedPlans.clearActivePlan();
        if (generation.generate(access, request, context, roster)) {
            dirty = true;
        }
    }

    boolean applySavedPlanCommand(
            EncounterSessionCommand command,
            EncounterSession.SessionRepository access,
            EncounterSessionContext context
    ) {
        if (command.opensSavedPlan()) {
            boolean opened = savedPlans.openSavedPlan(access, command.planId(), context, roster, generation);
            if (opened) {
                dirty = false;
            }
            return opened;
        }
        if (savedPlans.saveCurrentPlan(
                access,
                context,
                roster.snapshot().creatures(),
                generation.state().generatedTitle())) {
            dirty = false;
        }
        return false;
    }

    void applyGenerationCommand(EncounterSessionCommand command, EncounterSessionContext context) {
        if (command.shiftsGeneratedAlternative()) {
            if (generation.shiftGeneratedAlternative(command.delta(), roster)) {
                dirty = true;
            }
            return;
        }
        generation.clearGenerationHistory(context);
    }

    void addCreature(CreatureDetailData creature, long worldNpcId, EncounterSessionContext context) {
        if (roster.addCreature(creature, worldNpcId, context)) {
            savedPlans.clearActivePlan();
            generation.clearGeneratedSelection();
            dirty = true;
        }
    }

    void mutateCreature(EncounterSessionCommand command, EncounterSessionContext context) {
        if (roster.mutateCreature(command, context)) {
            savedPlans.clearActivePlan();
            generation.clearGeneratedSelection();
            dirty = true;
        }
    }

    EncounterGenerationInputs builderInputs() {
        return generation.builderInputs();
    }

    List<EncounterCreatureData> roster() {
        return roster.snapshot().creatures();
    }

    BuilderStateData builderState(EncounterSessionContext context) {
        return EncounterSessionGenerationProjection.builderState(context, roster.snapshot(), generation.state());
    }

    EncounterSessionMemento memento(
            EncounterSessionContext context,
            List<InitiativeEntryData> initiativeEntries,
            List<Combatant> combatants,
            int currentTurnIndex,
            int round,
            ResultStateData resultState
    ) {
        var rosterState = roster.snapshot();
        var generationState = generation.state();
        return new EncounterSessionMemento(
                context.mode(),
                context.status(),
                generationState.builderInputs(),
                generationState.generatedAlternatives(),
                generationState.generatedAdvisories(),
                generationState.selectedAlternativeIndex(),
                generationState.generatedAdjustedXp(),
                generationState.generatedDifficulty(),
                generationState.generatedTitle(),
                generationState.generationHistoryPresent(),
                dirty,
                rosterState.creatures(),
                rosterState.pendingUndo(),
                roster.nextUndoToken(),
                savedPlans.activeSavedPlanId(),
                initiativeEntries,
                combatants,
                currentTurnIndex,
                round,
                resultState);
    }

    void restore(EncounterSessionMemento memento) {
        roster.restore(memento.roster(), memento.pendingUndo(), memento.nextUndoToken());
        generation.restore(memento);
        savedPlans.restore(memento.activeSavedPlanId());
        dirty = memento.dirty();
    }

    void retainSceneEnemies(List<Long> worldNpcIds) {
        if (roster.removeWorldNpcsExcept(worldNpcIds)) {
            dirty = true;
        }
    }

    boolean containsWorldNpc(long worldNpcId) {
        return roster.containsWorldNpc(worldNpcId);
    }

    void addSceneWorldNpc(EncounterCreatureData creature, EncounterSessionContext context) {
        roster.addSceneWorldNpc(creature, context);
        dirty = true;
    }
}
