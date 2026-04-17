package src.view.creatures.Model;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public final class CreaturesFilterOptionsModel {

    private final ObservableList<String> challengeRatingOptions = FXCollections.observableArrayList();
    private final ObservableList<String> sizeOptions = FXCollections.observableArrayList();
    private final ObservableList<String> typeOptions = FXCollections.observableArrayList();
    private final ObservableList<String> subtypeOptions = FXCollections.observableArrayList();
    private final ObservableList<String> biomeOptions = FXCollections.observableArrayList();
    private final ObservableList<String> alignmentOptions = FXCollections.observableArrayList();

    public ObservableList<String> challengeRatingOptions() {
        return challengeRatingOptions;
    }

    public ObservableList<String> sizeOptions() {
        return sizeOptions;
    }

    public ObservableList<String> typeOptions() {
        return typeOptions;
    }

    public ObservableList<String> subtypeOptions() {
        return subtypeOptions;
    }

    public ObservableList<String> biomeOptions() {
        return biomeOptions;
    }

    public ObservableList<String> alignmentOptions() {
        return alignmentOptions;
    }

    void apply(CreatureFilterOptionsViewData filterOptions) {
        challengeRatingOptions.setAll(filterOptions.challengeRatings());
        sizeOptions.setAll(filterOptions.sizes());
        typeOptions.setAll(filterOptions.types());
        subtypeOptions.setAll(filterOptions.subtypes());
        biomeOptions.setAll(filterOptions.biomes());
        alignmentOptions.setAll(filterOptions.alignments());
    }
}
