package src.view.party.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class PartyToolbarBudgetSection {

    private final StringProperty budgetPercentText = new SimpleStringProperty("0%");
    private final DoubleProperty budgetProgress = new SimpleDoubleProperty(0.0);
    private final BooleanProperty budgetVisible = new SimpleBooleanProperty(false);

    public StringProperty budgetPercentTextProperty() {
        return budgetPercentText;
    }

    public DoubleProperty budgetProgressProperty() {
        return budgetProgress;
    }

    public BooleanProperty budgetVisibleProperty() {
        return budgetVisible;
    }

    void apply(boolean noActiveParty, double progress, int consumedPercent) {
        budgetProgress.set(Math.max(0.0, Math.min(1.0, progress)));
        budgetPercentText.set(Math.max(0, consumedPercent) + "%");
        budgetVisible.set(!noActiveParty);
    }
}
