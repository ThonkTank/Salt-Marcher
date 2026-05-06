package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.encounter.plan.value.EncounterPlanSummary;

final class EncounterSessionContext {

    private static final int COMBAT_MODE = 2;
    private static final String DEFAULT_STATUS = "Encounter bereit.";

    private final List<PartyMemberData> activeParty = new ArrayList<>();
    private final List<EncounterPlanSummary> savedPlans = new ArrayList<>();
    private int mode = Mode.BUILDER;
    private Optional<BudgetData> budget = Optional.empty();
    private String status = DEFAULT_STATUS;

    void refresh(EncounterSession.RuntimeAccess access) {
        activeParty.clear();
        activeParty.addAll(access.loadActiveParty());
        budget = access.loadBudget();
        refreshSavedPlans(access);
    }

    void refreshPartyAndBudget(EncounterSession.RuntimeAccess access) {
        activeParty.clear();
        activeParty.addAll(access.loadActiveParty());
        budget = access.loadBudget();
    }

    List<PartyMemberData> activeParty() {
        return List.copyOf(activeParty);
    }

    List<Long> activePartyIds() {
        return activeParty.stream().map(PartyMemberData::numericId).toList();
    }

    boolean hasActiveParty() {
        return !activeParty.isEmpty();
    }

    List<EncounterPlanSummary> savedPlans() {
        return List.copyOf(savedPlans);
    }

    Optional<BudgetData> budget() {
        return budget;
    }

    int mode() {
        return mode;
    }

    String status() {
        return status;
    }

    boolean isCombatMode() {
        return mode == COMBAT_MODE;
    }

    void enterBuilder(String nextStatus) {
        mode = Mode.BUILDER;
        status = nextStatus;
    }

    void enterInitiative(String nextStatus) {
        mode = Mode.INITIATIVE;
        status = nextStatus;
    }

    void enterCombat(String nextStatus) {
        mode = Mode.COMBAT;
        status = nextStatus;
    }

    void enterResults(String nextStatus) {
        mode = Mode.RESULTS;
        status = nextStatus;
    }

    void setStatus(String nextStatus) {
        status = nextStatus;
    }

    void refreshSavedPlans(EncounterSession.RuntimeAccess access) {
        ListPlansOutcome result = access.listPlans();
        savedPlans.clear();
        if (result.success()) {
            savedPlans.addAll(result.plans());
            return;
        }
        if (!result.message().isBlank()) {
            status = result.message();
        }
    }
}
