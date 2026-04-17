package src.view.party.Model;

import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class PartyToolbarDisplaySection {

    private final StringProperty triggerText = new SimpleStringProperty("Party");
    private final StringProperty summaryText = new SimpleStringProperty("No active party");
    private final StringProperty daySummaryText = new SimpleStringProperty("Adventuring day: no active party");

    public StringProperty triggerTextProperty() {
        return triggerText;
    }

    public StringProperty summaryTextProperty() {
        return summaryText;
    }

    public StringProperty daySummaryTextProperty() {
        return daySummaryText;
    }

    void applyCounts(int activeCount, int reserveCount, int averageLevel, int remainingToShortRest, int remainingToLongRest) {
        if (activeCount == 0) {
            triggerText.set("Party");
            summaryText.set("No active party. Reserve: " + reserveCount);
            daySummaryText.set("Adventuring day: no active party");
            return;
        }
        triggerText.set("Party (" + activeCount + ", avg Lv " + averageLevel + ")");
        summaryText.set("Active: " + activeCount + " | Reserve: " + reserveCount + " | Avg Lv " + averageLevel);
        daySummaryText.set("SR " + remainingToShortRest + " XP | LR " + remainingToLongRest + " XP");
    }
}
