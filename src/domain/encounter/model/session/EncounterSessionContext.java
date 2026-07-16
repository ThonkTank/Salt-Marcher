package src.domain.encounter.model.session;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

final class EncounterSessionContext {

    private static final String DEFAULT_STATUS = "Encounter bereit.";

    private final List<PartyMemberData> activeParty = new ArrayList<>();
    private int mode = Mode.BUILDER;
    private Optional<BudgetData> budget = Optional.empty();
    private String status = DEFAULT_STATUS;

    void refresh(EncounterSession.SessionRepository access) {
        activeParty.clear();
        activeParty.addAll(access.loadActiveParty());
        budget = access.loadBudget();
    }

    List<PartyMemberData> activeParty() {
        return List.copyOf(activeParty);
    }

    boolean hasActiveParty() {
        return !activeParty.isEmpty();
    }

    Optional<BudgetData> budget() {
        return budget;
    }

    List<PartyMemberData> missingCombatPartyMembers(CombatProjectionData projection) {
        List<String> activePcIds = new ArrayList<>();
        for (CombatCardData card : projection.cards()) {
            if (card.playerCharacter()) {
                activePcIds.add(card.id());
            }
        }
        List<PartyMemberData> missingMembers = new ArrayList<>();
        for (PartyMemberData member : activeParty) {
            if (!activePcIds.contains(member.id())) {
                missingMembers.add(member);
            }
        }
        return List.copyOf(missingMembers);
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

}
