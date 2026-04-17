package src.view.party.Model;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import src.view.party.interactor.PartyInteractor;

public final class PartyToolbarModel {

    private final ObservableList<PartyInteractor.PartyMemberViewData> activeMembers = FXCollections.observableArrayList();
    private final ObservableList<PartyInteractor.PartyMemberViewData> reserveMembers = FXCollections.observableArrayList();
    private final PartyToolbarDisplaySection display = new PartyToolbarDisplaySection();
    private final PartyToolbarBudgetSection budget = new PartyToolbarBudgetSection();
    private final PartyToolbarStatusSection status = new PartyToolbarStatusSection();
    private final PartyToolbarRestControls restControls = new PartyToolbarRestControls();

    public ObservableList<PartyInteractor.PartyMemberViewData> activeMembers() {
        return activeMembers;
    }

    public ObservableList<PartyInteractor.PartyMemberViewData> reserveMembers() {
        return reserveMembers;
    }

    public PartyToolbarDisplaySection display() {
        return display;
    }

    public PartyToolbarBudgetSection budget() {
        return budget;
    }

    public PartyToolbarStatusSection status() {
        return status;
    }

    public PartyToolbarRestControls restControls() {
        return restControls;
    }

    public void applyState(PartyToolbarState state) {
        activeMembers.setAll(state.activeMembers());
        reserveMembers.setAll(state.reserveMembers());
        int activeCount = activeMembers.size();
        int reserveCount = reserveMembers.size();
        boolean noActiveParty = activeCount == 0;
        display.applyCounts(
                activeCount,
                reserveCount,
                state.averageLevel(),
                state.remainingToShortRest(),
                state.remainingToLongRest());
        budget.apply(noActiveParty, state.budgetProgress(), state.consumedPercent());
        restControls.apply(noActiveParty);
    }

    public void showStatus(String text, boolean error) {
        status.show(text, error);
    }

    public void clearStatus() {
        status.clear();
    }
}
