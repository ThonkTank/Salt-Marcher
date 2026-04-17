package src.view.creatures.Model;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class CreaturesFilterSelectionModel {

    private final StringProperty searchText = new SimpleStringProperty("");
    private final ObjectProperty<String> selectedChallengeRatingMin = new SimpleObjectProperty<>();
    private final ObjectProperty<String> selectedChallengeRatingMax = new SimpleObjectProperty<>();
    private final ObservableList<String> selectedSizes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedTypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedSubtypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedBiomes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedAlignments = FXCollections.observableArrayList();

    public StringProperty searchTextProperty() {
        return searchText;
    }

    public ObjectProperty<String> selectedChallengeRatingMinProperty() {
        return selectedChallengeRatingMin;
    }

    public ObjectProperty<String> selectedChallengeRatingMaxProperty() {
        return selectedChallengeRatingMax;
    }

    public ObservableList<String> selectedSizes() {
        return selectedSizes;
    }

    public ObservableList<String> selectedTypes() {
        return selectedTypes;
    }

    public ObservableList<String> selectedSubtypes() {
        return selectedSubtypes;
    }

    public ObservableList<String> selectedBiomes() {
        return selectedBiomes;
    }

    public ObservableList<String> selectedAlignments() {
        return selectedAlignments;
    }

    void reset() {
        searchText.set("");
        selectedChallengeRatingMin.set(null);
        selectedChallengeRatingMax.set(null);
        selectedSizes.clear();
        selectedTypes.clear();
        selectedSubtypes.clear();
        selectedBiomes.clear();
        selectedAlignments.clear();
    }
}
