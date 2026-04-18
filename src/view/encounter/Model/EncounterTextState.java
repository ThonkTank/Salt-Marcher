package src.view.encounter.Model;

import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class EncounterTextState {

    private final StringProperty partySummary = new SimpleStringProperty("No active party.");
    private final StringProperty thresholdsSummary = new SimpleStringProperty("");
    private final StringProperty dailyBudgetSummary = new SimpleStringProperty("");
    private final StringProperty lockSummary = new SimpleStringProperty("Locked: none");
    private final StringProperty excludeSummary = new SimpleStringProperty("Excluded: none");
    private final StringProperty statusText = new SimpleStringProperty("");
    private final StringProperty resultSummary = new SimpleStringProperty("No encounters generated yet.");
    private final StringProperty detailText = new SimpleStringProperty("Generate an encounter to inspect the composition.");

    public StringProperty partySummaryProperty() {
        return partySummary;
    }

    public StringProperty thresholdsSummaryProperty() {
        return thresholdsSummary;
    }

    public StringProperty dailyBudgetSummaryProperty() {
        return dailyBudgetSummary;
    }

    public StringProperty lockSummaryProperty() {
        return lockSummary;
    }

    public StringProperty excludeSummaryProperty() {
        return excludeSummary;
    }

    public StringProperty statusTextProperty() {
        return statusText;
    }

    public StringProperty resultSummaryProperty() {
        return resultSummary;
    }

    public StringProperty detailTextProperty() {
        return detailText;
    }
}
