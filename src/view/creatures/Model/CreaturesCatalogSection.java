package src.view.creatures.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public final class CreaturesCatalogSection {

    private final ObservableList<CreaturesCatalogViewData.Row> rows = FXCollections.observableArrayList();
    private final StringProperty pageSummaryText = new SimpleStringProperty("No creatures loaded.");
    private final BooleanProperty previousPageAvailable = new SimpleBooleanProperty(false);
    private final BooleanProperty nextPageAvailable = new SimpleBooleanProperty(false);

    public ObservableList<CreaturesCatalogViewData.Row> rows() {
        return rows;
    }

    public StringProperty pageSummaryTextProperty() {
        return pageSummaryText;
    }

    public BooleanProperty previousPageAvailableProperty() {
        return previousPageAvailable;
    }

    public BooleanProperty nextPageAvailableProperty() {
        return nextPageAvailable;
    }

    public void applyPage(CreaturesCatalogViewData.Page page) {
        rows.setAll(page.rows());
        pageSummaryText.set(page.pageSummaryText());
        previousPageAvailable.set(page.previousPageAvailable());
        nextPageAvailable.set(page.nextPageAvailable());
    }
}
