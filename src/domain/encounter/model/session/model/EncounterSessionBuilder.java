package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.session.model.EncounterSessionValues.BuilderStateData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterSessionValues.EncounterCreatureData;

final class EncounterSessionBuilder {

    private final EncounterSessionRosterMutation roster = new EncounterSessionRosterMutation();
    private final EncounterSessionGeneration generation = new EncounterSessionGeneration();
    private final EncounterSessionSavedPlans savedPlans = new EncounterSessionSavedPlans();

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
        generation.generate(access, request, context, roster);
    }

    void saveCurrentPlan(EncounterSession.SessionRepository access, EncounterSessionContext context) {
        savedPlans.saveCurrentPlan(access, context, roster.creatures(), generation.generatedTitle());
    }

    void openSavedPlan(
            EncounterSession.SessionRepository access,
            long planId,
            EncounterSessionContext context,
            Runnable resetCombatState
    ) {
        savedPlans.openSavedPlan(access, planId, context, resetCombatState, roster, generation);
    }

    void clearGenerationHistory(EncounterSessionContext context) {
        generation.clearGenerationHistory(context);
    }

    void shiftGeneratedAlternative(int delta) {
        generation.shiftGeneratedAlternative(delta, roster);
    }

    void addCreature(CreatureDetailData creature, EncounterSessionContext context) {
        if (roster.addCreature(creature, context)) {
            clearGeneratedSelection();
        }
    }

    void incrementCreature(long creatureId, EncounterSessionContext context) {
        if (roster.incrementCreature(creatureId, context)) {
            clearGeneratedSelection();
        }
    }

    void decrementCreature(long creatureId, EncounterSessionContext context) {
        if (roster.decrementCreature(creatureId, context)) {
            clearGeneratedSelection();
        }
    }

    void removeCreature(long creatureId, EncounterSessionContext context) {
        if (roster.removeCreature(creatureId, context)) {
            clearGeneratedSelection();
        }
    }

    void undoRemove(long token, EncounterSessionContext context) {
        if (roster.undoRemove(token, context)) {
            clearGeneratedSelection();
        }
    }

    EncounterGenerationInputs builderInputs() {
        return generation.builderInputs();
    }

    List<EncounterCreatureData> roster() {
        return roster.creatures();
    }

    BuilderStateData builderState(EncounterSessionContext context) {
        return generation.builderState(context, roster);
    }

    private void clearGeneratedSelection() {
        savedPlans.clearActivePlan();
        generation.clearGeneratedSelection();
    }
}
