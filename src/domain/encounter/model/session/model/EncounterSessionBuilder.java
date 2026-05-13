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

    void applySavedPlanCommand(
            EncounterSessionCommand command,
            EncounterSession.SessionRepository access,
            EncounterSessionContext context,
            EncounterSessionCombatReset resetCombatState
    ) {
        if (command.opensSavedPlan()) {
            savedPlans.openSavedPlan(access, command.planId(), context, resetCombatState, roster, generation);
            return;
        }
        savedPlans.saveCurrentPlan(access, context, roster.snapshot().creatures(), generation.state().generatedTitle());
    }

    void applyGenerationCommand(EncounterSessionCommand command, EncounterSessionContext context) {
        if (command.shiftsGeneratedAlternative()) {
            generation.shiftGeneratedAlternative(command.delta(), roster);
            return;
        }
        generation.clearGenerationHistory(context);
    }

    void addCreature(CreatureDetailData creature, EncounterSessionContext context) {
        if (roster.addCreature(creature, context)) {
            savedPlans.clearActivePlan();
            generation.clearGeneratedSelection();
        }
    }

    void mutateCreature(EncounterSessionCommand command, EncounterSessionContext context) {
        if (roster.mutateCreature(command, context)) {
            savedPlans.clearActivePlan();
            generation.clearGeneratedSelection();
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
}
