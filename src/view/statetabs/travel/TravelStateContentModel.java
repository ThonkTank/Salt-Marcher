package src.view.statetabs.travel;

import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class TravelStateContentModel {

    private static final String[] TEXT_DEFAULTS = {
        "W",
        "\u2014 Kein Ort gew\u00e4hlt \u2014",
        "Reisend",
        "\u2014",
        "Interaktion",
        "Gruppenmarker auf der Karte ziehen"
    };
    private static final String[] DETAIL_KEY_DEFAULTS = {"Wetter", "Tageszeit", "Tempo"};
    private static final String[] DETAIL_VALUE_DEFAULTS = {"Bew\u00f6lkt", "Morgen", "Normal"};

    private final ReadOnlyStringWrapper[] textProperties = new ReadOnlyStringWrapper[TEXT_DEFAULTS.length];
    private final ReadOnlyStringWrapper[] detailKeyProperties = new ReadOnlyStringWrapper[DETAIL_KEY_DEFAULTS.length];
    private final ReadOnlyStringWrapper[] detailValueProperties =
            new ReadOnlyStringWrapper[DETAIL_VALUE_DEFAULTS.length];

    TravelStateContentModel() {
        for (int index = 0; index < TEXT_DEFAULTS.length; index++) {
            textProperties[index] = new ReadOnlyStringWrapper(TEXT_DEFAULTS[index]);
        }
        for (int index = 0; index < DETAIL_KEY_DEFAULTS.length; index++) {
            detailKeyProperties[index] = new ReadOnlyStringWrapper(DETAIL_KEY_DEFAULTS[index]);
            detailValueProperties[index] = new ReadOnlyStringWrapper(DETAIL_VALUE_DEFAULTS[index]);
        }
    }

    ReadOnlyStringProperty textProperty(int index) {
        return textProperties[index].getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailKeyProperty(int index) {
        return detailKeyProperties[index].getReadOnlyProperty();
    }

    ReadOnlyStringProperty detailValueProperty(int index) {
        return detailValueProperties[index].getReadOnlyProperty();
    }
}
