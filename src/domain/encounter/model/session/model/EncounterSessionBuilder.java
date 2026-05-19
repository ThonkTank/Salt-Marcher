package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.session.model.BuilderStateData;
import src.domain.encounter.model.session.model.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterCreatureData;

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

    boolean applySavedPlanCommand(
            EncounterSessionCommand command,
            EncounterSession.SessionRepository access,
            EncounterSessionContext context
    ) {
        if (command.opensSavedPlan()) {
            return savedPlans.openSavedPlan(access, command.planId(), context, roster, generation);
        }
        savedPlans.saveCurrentPlan(access, context, roster.snapshot().creatures(), generation.state().generatedTitle());
        return false;
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
