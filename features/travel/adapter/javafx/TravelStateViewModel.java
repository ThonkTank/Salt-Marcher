package features.travel.adapter.javafx;

import features.travel.api.TravelContextKind;
import features.travel.api.TravelContextSnapshot;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class TravelStateViewModel {

    private final ReadOnlyStringWrapper icon = new ReadOnlyStringWrapper();
    private final ReadOnlyStringWrapper location = new ReadOnlyStringWrapper();
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper();
    private final ReadOnlyStringWrapper context = new ReadOnlyStringWrapper();
    private final ReadOnlyStringWrapper sectionHeader = new ReadOnlyStringWrapper("Hinweis");
    private final ReadOnlyStringWrapper sectionValue = new ReadOnlyStringWrapper();
    private final Detail firstDetail = new Detail();
    private final Detail secondDetail = new Detail();
    private final Detail thirdDetail = new Detail();

    TravelStateViewModel() {
        apply(TravelContextSnapshot.none(0L));
    }

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

    Detail firstDetail() {
        return firstDetail;
    }

    Detail secondDetail() {
        return secondDetail;
    }

    Detail thirdDetail() {
        return thirdDetail;
    }

    void apply(TravelContextSnapshot snapshot) {
        TravelContextSnapshot safeSnapshot = snapshot == null ? TravelContextSnapshot.none(0L) : snapshot;
        icon.set(icon(safeSnapshot.kind()));
        location.set(safeSnapshot.mapName());
        status.set(safeSnapshot.statusText());
        context.set(contextLabel(safeSnapshot.kind()));
        sectionValue.set(safeSnapshot.hintText());
        if (safeSnapshot.kind() == TravelContextKind.DUNGEON) {
            applyDungeonDetails(safeSnapshot);
        } else {
            applyOverworldDetails(safeSnapshot);
        }
    }

    private void applyDungeonDetails(TravelContextSnapshot snapshot) {
        firstDetail.set("Bereich", snapshot.areaLabel());
        secondDetail.set("Feld", snapshot.tileLabel());
        thirdDetail.set("Blick", snapshot.headingLabel());
    }

    private void applyOverworldDetails(TravelContextSnapshot snapshot) {
        firstDetail.set("Wetter", snapshot.weatherText());
        secondDetail.set("Tageszeit", snapshot.timeOfDayText());
        thirdDetail.set("Tempo", snapshot.paceText());
    }

    private static String icon(TravelContextKind kind) {
        return switch (kind) {
            case DUNGEON -> "D";
            case HEX -> "H";
            case NONE -> "W";
        };
    }

    private static String contextLabel(TravelContextKind kind) {
        return switch (kind) {
            case DUNGEON -> "Dungeon-Reise";
            case HEX -> "Hex-Reise";
            case NONE -> "\u2014";
        };
    }

    static final class Detail {

        private final ReadOnlyStringWrapper key = new ReadOnlyStringWrapper();
        private final ReadOnlyStringWrapper value = new ReadOnlyStringWrapper();

        ReadOnlyStringProperty keyProperty() {
            return key.getReadOnlyProperty();
        }

        ReadOnlyStringProperty valueProperty() {
            return value.getReadOnlyProperty();
        }

        void set(String nextKey, String nextValue) {
            key.set(clean(nextKey));
            value.set(clean(nextValue));
        }

        private static String clean(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
