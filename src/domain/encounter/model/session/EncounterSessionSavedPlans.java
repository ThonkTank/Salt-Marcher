package src.domain.encounter.model.session;


import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.plan.EncounterPlanCreature;

final class EncounterSessionSavedPlans {

    private static final String DEFAULT_PLAN_NAME = "Encounter";
    private static final String DEFAULT_MANUAL_TITLE = "Manuelles Encounter";
    private static final String SAVE_NEEDS_CREATURE_STATUS = "Speichern braucht mindestens eine Kreatur im Encounter.";
    private static final String SAVE_FAILURE_STATUS = "Encounter konnte nicht gespeichert werden.";
    private static final String OPEN_FAILURE_STATUS = "Encounter konnte nicht geöffnet werden.";

    private OptionalLong activeSavedPlanId = OptionalLong.empty();

    void clearActivePlan() {
        activeSavedPlanId = OptionalLong.empty();
    }

    void saveCurrentPlan(
            EncounterSession.SessionRepository access,
            EncounterSessionContext context,
            List<EncounterCreatureData> roster,
            String generatedTitle,
            String requestedName,
            EncounterSessionGeneration generation
    ) {
        if (roster.isEmpty()) {
            context.setStatus(SAVE_NEEDS_CREATURE_STATUS);
            return;
        }
        PlanOutcome result = access.savePlan(new EncounterPlan(
                activeSavedPlanId.orElse(0L),
                saveName(requestedName, generatedTitle, roster.isEmpty()),
                generatedTitle,
                planCreatures(roster)));
        if (!result.success()) {
            context.setStatus(result.message().isBlank() ? SAVE_FAILURE_STATUS : result.message());
            context.refreshSavedPlans(access);
            return;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        activeSavedPlanId = OptionalLong.of(plan.id());
        generation.openSavedPlan(plan.name());
        context.setStatus(plan.name() + " gespeichert.");
        context.refreshSavedPlans(access);
    }

    boolean openSavedPlan(
            EncounterSession.SessionRepository access,
            long planId,
            EncounterSessionContext context,
            EncounterSessionRosterMutation roster,
            EncounterSessionGeneration generation
    ) {
        PlanOutcome result = access.loadPlan(planId);
        if (!result.success()) {
            context.setStatus(result.message().isBlank() ? OPEN_FAILURE_STATUS : result.message());
            context.refreshSavedPlans(access);
            return false;
        }
        EncounterPlan plan = result.plan().orElseThrow();
        roster.replaceWithGenerated(savedPlanRoster(access, plan));
        generation.openSavedPlan(plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel());
        activeSavedPlanId = OptionalLong.of(plan.id());
        context.enterMode(Mode.BUILDER, plan.name() + " geoeffnet.");
        context.refreshSavedPlans(access);
        return true;
    }

    private static List<EncounterCreatureData> savedPlanRoster(EncounterSession.SessionRepository access, EncounterPlan plan) {
        List<EncounterCreatureData> loadedRoster = new ArrayList<>();
        for (EncounterPlanCreature creature : plan.creatures()) {
            CreatureDetailData detail = access.loadCreature(creature.creatureId()).orElse(null);
            if (detail != null) {
                loadedRoster.add(EncounterSessionCreatureRows.savedPlan(detail, creature.quantity()));
            }
        }
        return loadedRoster;
    }

    private static List<EncounterPlanCreature> planCreatures(List<EncounterCreatureData> roster) {
        List<EncounterPlanCreature> creatures = new ArrayList<>();
        for (EncounterCreatureData creature : roster) {
            creatures.add(new EncounterPlanCreature(creature.creatureId(), creature.count()));
        }
        return creatures;
    }

    private static String saveName(String requestedName, String generatedTitle, boolean emptyRoster) {
        String safeRequestedName = requestedName == null ? "" : requestedName.trim();
        if (!safeRequestedName.isBlank()) {
            return safeRequestedName;
        }
        if (!generatedTitle.isBlank()) {
            return generatedTitle;
        }
        return emptyRoster ? DEFAULT_PLAN_NAME : DEFAULT_MANUAL_TITLE;
    }
}
