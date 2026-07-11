package src.view.statetabs.travel;

import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.hex.published.HexTravelSnapshot;

final class TravelStateViewModel {

    private final ReadOnlyStringWrapper icon = new ReadOnlyStringWrapper("W");
    private final ReadOnlyStringWrapper location = new ReadOnlyStringWrapper("\u2014 Kein Ort gew\u00e4hlt \u2014");
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("Reisend");
    private final ReadOnlyStringWrapper context = new ReadOnlyStringWrapper("\u2014");
    private final ReadOnlyStringWrapper sectionHeader = new ReadOnlyStringWrapper("Interaktion");
    private final ReadOnlyStringWrapper sectionValue = new ReadOnlyStringWrapper("Gruppenmarker auf der Karte ziehen");
    private final Detail weather = new Detail("Wetter", "Bew\u00f6lkt");
    private final Detail timeOfDay = new Detail("Tageszeit", "Morgen");
    private final Detail pace = new Detail("Tempo", "Normal");

    ReadOnlyStringProperty iconProperty() {
        return icon.getReadOnlyProperty();
    }

    ReadOnlyStringProperty locationProperty() {
        return location.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    ReadOnlyStringProperty contextProperty() {
        return context.getReadOnlyProperty();
    }

    ReadOnlyStringProperty sectionHeaderProperty() {
        return sectionHeader.getReadOnlyProperty();
    }

    ReadOnlyStringProperty sectionValueProperty() {
        return sectionValue.getReadOnlyProperty();
    }

    Detail weather() {
        return weather;
    }

    Detail timeOfDay() {
        return timeOfDay;
    }

    Detail pace() {
        return pace;
    }

    void applyHexTravelSnapshot(HexTravelSnapshot snapshot) {
        HexTravelSnapshot safeSnapshot = snapshot == null
                ? HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.")
                : snapshot;
        icon.set(safeSnapshot.active() ? "H" : "W");
        location.set(safeSnapshot.locationText());
        status.set(safeSnapshot.statusText());
        context.set(safeSnapshot.active() ? "Hex-Reise" : "\u2014");
        sectionHeader.set("Interaktion");
        sectionValue.set(safeSnapshot.hintText());
        weather.setValue(safeSnapshot.weatherText());
        timeOfDay.setValue(safeSnapshot.timeOfDayText());
        pace.setValue(safeSnapshot.paceText());
    }

    static final class Detail {

        private final ReadOnlyStringWrapper key;
        private final ReadOnlyStringWrapper value;

        private Detail(String key, String value) {
            this.key = new ReadOnlyStringWrapper(key);
            this.value = new ReadOnlyStringWrapper(value);
        }

        ReadOnlyStringProperty keyProperty() {
            return key.getReadOnlyProperty();
        }

        ReadOnlyStringProperty valueProperty() {
            return value.getReadOnlyProperty();
        }

        void setValue(String nextValue) {
            value.set(nextValue == null ? "" : nextValue.trim());
        }
    }
}
