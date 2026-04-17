package src.view.creatures.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import src.view.creatures.interactor.CreaturesInteractor;

public final class CreaturesCatalogSection {

    private final ObservableList<CreaturesInteractor.CreatureCatalogRowViewData> rows = FXCollections.observableArrayList();
    private final StringProperty pageSummaryText = new SimpleStringProperty("No creatures loaded.");
    private final BooleanProperty previousPageAvailable = new SimpleBooleanProperty(false);
    private final BooleanProperty nextPageAvailable = new SimpleBooleanProperty(false);

    public ObservableList<CreaturesInteractor.CreatureCatalogRowViewData> rows() {
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

    public void applyPage(CreaturesInteractor.CreatureCatalogPageViewData page) {
        rows.setAll(page.rows());
        pageSummaryText.set(page.pageSummaryText());
        previousPageAvailable.set(page.previousPageAvailable());
        nextPageAvailable.set(page.nextPageAvailable());
    }
}
