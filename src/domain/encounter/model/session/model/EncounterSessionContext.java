package src.domain.encounter.model.session.model;


import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;

final class EncounterSessionContext {

    private static final String DEFAULT_STATUS = "Encounter bereit.";

    private final List<PartyMemberData> activeParty = new ArrayList<>();
    private final List<EncounterPlanSummary> savedPlans = new ArrayList<>();
    private int mode = Mode.BUILDER;
    private Optional<BudgetData> budget = Optional.empty();
    private String status = DEFAULT_STATUS;

    void refresh(EncounterSession.SessionRepository access, boolean includeSavedPlans) {
        activeParty.clear();
        activeParty.addAll(access.loadActiveParty());
        budget = access.loadBudget();
        if (includeSavedPlans) {
            refreshSavedPlans(access);
        }
    }

    List<PartyMemberData> activeParty() {
        return List.copyOf(activeParty);
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

    List<PartyMemberData> missingCombatPartyMembers(CombatProjectionData projection) {
        List<String> activePcIds = projection.cards().stream()
                .filter(CombatCardData::playerCharacter)
                .map(CombatCardData::id)
                .toList();
        return activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    int mode() {
        return mode;
    }

    String status() {
        return status;
    }

    void enterMode(int nextMode, String nextStatus) {
        mode = nextMode;
        status = nextStatus;
    }

    void setStatus(String nextStatus) {
        status = nextStatus;
    }

    void refreshSavedPlans(EncounterSession.SessionRepository access) {
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
