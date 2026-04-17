package src.view.party.Model;

import src.view.party.interactor.PartyInteractor;

import java.util.List;

public record PartyToolbarState(
        List<PartyInteractor.PartyMemberViewData> activeMembers,
        List<PartyInteractor.PartyMemberViewData> reserveMembers,
        int averageLevel,
        int remainingToShortRest,
        int remainingToLongRest,
        double budgetProgress,
        int consumedPercent
) {
    public PartyToolbarState {
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
    }
}
