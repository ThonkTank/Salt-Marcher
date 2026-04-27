package src.view.statetabs.travel;

import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class TravelStatePresentationModel {

    private final ReadOnlyStringWrapper iconText = new ReadOnlyStringWrapper("W");
    private final ReadOnlyStringWrapper locationText = new ReadOnlyStringWrapper("\u2014 Kein Ort gew\u00e4hlt \u2014");
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("Reisend");
    private final ReadOnlyStringWrapper contextText = new ReadOnlyStringWrapper("\u2014");
    private final ReadOnlyStringWrapper detailKeyOneText = new ReadOnlyStringWrapper("Wetter");
    private final ReadOnlyStringWrapper detailValueOneText = new ReadOnlyStringWrapper("Bew\u00f6lkt");
    private final ReadOnlyStringWrapper detailKeyTwoText = new ReadOnlyStringWrapper("Tageszeit");
    private final ReadOnlyStringWrapper detailValueTwoText = new ReadOnlyStringWrapper("Morgen");
    private final ReadOnlyStringWrapper detailKeyThreeText = new ReadOnlyStringWrapper("Tempo");
    private final ReadOnlyStringWrapper detailValueThreeText = new ReadOnlyStringWrapper("Normal");
    private final ReadOnlyStringWrapper sectionHeaderText = new ReadOnlyStringWrapper("Interaktion");
    private final ReadOnlyStringWrapper sectionValueText =
            new ReadOnlyStringWrapper("Gruppenmarker auf der Karte ziehen");

    ReadOnlyStringProperty iconTextProperty() {
        return iconText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty locationTextProperty() {
        return locationText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusTextProperty() {
        return statusText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty contextTextProperty() {
        return contextText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailKeyOneTextProperty() {
        return detailKeyOneText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailValueOneTextProperty() {
        return detailValueOneText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailKeyTwoTextProperty() {
        return detailKeyTwoText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailValueTwoTextProperty() {
        return detailValueTwoText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailKeyThreeTextProperty() {
        return detailKeyThreeText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailValueThreeTextProperty() {
        return detailValueThreeText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty sectionHeaderTextProperty() {
        return sectionHeaderText.getReadOnlyProperty();
    }

    ReadOnlyStringProperty sectionValueTextProperty() {
        return sectionValueText.getReadOnlyProperty();
    }
}
