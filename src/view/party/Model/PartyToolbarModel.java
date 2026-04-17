package src.view.party.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import src.view.party.interactor.PartyInteractor;

public final class PartyToolbarModel {

    private final ObservableList<PartyInteractor.PartyMemberViewData> activeMembers = FXCollections.observableArrayList();
    private final ObservableList<PartyInteractor.PartyMemberViewData> reserveMembers = FXCollections.observableArrayList();
    private final StringProperty triggerText = new SimpleStringProperty("Party");
    private final StringProperty summaryText = new SimpleStringProperty("No active party");
    private final StringProperty daySummaryText = new SimpleStringProperty("Adventuring day: no active party");
    private final StringProperty statusText = new SimpleStringProperty("");
    private final BooleanProperty statusVisible = new SimpleBooleanProperty(false);
    private final BooleanProperty statusError = new SimpleBooleanProperty(false);
    private final BooleanProperty shortRestDisabled = new SimpleBooleanProperty(true);
    private final BooleanProperty longRestDisabled = new SimpleBooleanProperty(true);

    public ObservableList<PartyInteractor.PartyMemberViewData> activeMembers() {
        return activeMembers;
    }

    public ObservableList<PartyInteractor.PartyMemberViewData> reserveMembers() {
        return reserveMembers;
    }

    public StringProperty triggerTextProperty() {
        return triggerText;
    }

    public StringProperty summaryTextProperty() {
        return summaryText;
    }

    public StringProperty daySummaryTextProperty() {
        return daySummaryText;
    }

    public StringProperty statusTextProperty() {
        return statusText;
    }

    public BooleanProperty statusVisibleProperty() {
        return statusVisible;
    }

    public BooleanProperty statusErrorProperty() {
        return statusError;
    }

    public BooleanProperty shortRestDisabledProperty() {
        return shortRestDisabled;
    }

    public BooleanProperty longRestDisabledProperty() {
        return longRestDisabled;
    }

    public void setPartyState(
            java.util.List<PartyInteractor.PartyMemberViewData> activeMembers,
            java.util.List<PartyInteractor.PartyMemberViewData> reserveMembers,
            int averageLevel,
            int remainingToShortRest,
            int remainingToLongRest
    ) {
        this.activeMembers.setAll(activeMembers == null ? java.util.List.of() : activeMembers);
        this.reserveMembers.setAll(reserveMembers == null ? java.util.List.of() : reserveMembers);

        int activeCount = this.activeMembers.size();
        int reserveCount = this.reserveMembers.size();
        if (activeCount == 0) {
            triggerText.set("Party");
            summaryText.set("No active party. Reserve: " + reserveCount);
        } else {
            triggerText.set("Party (" + activeCount + ", avg Lv " + averageLevel + ")");
            summaryText.set("Active: " + activeCount + " | Reserve: " + reserveCount
                    + " | Avg Lv " + averageLevel);
        }

        if (activeCount == 0) {
            daySummaryText.set("Adventuring day: no active party");
        } else {
            daySummaryText.set("Adventuring day: short rest in about "
                    + remainingToShortRest
                    + " XP, long rest in about "
                    + remainingToLongRest
                    + " XP");
        }

        boolean noActiveParty = this.activeMembers.isEmpty();
        shortRestDisabled.set(noActiveParty);
        longRestDisabled.set(noActiveParty);
    }

    public void showStatus(String text, boolean error) {
        statusText.set(text == null ? "" : text);
        statusError.set(error);
        statusVisible.set(text != null && !text.isBlank());
    }

    public void clearStatus() {
        statusText.set("");
        statusVisible.set(false);
        statusError.set(false);
    }
}
