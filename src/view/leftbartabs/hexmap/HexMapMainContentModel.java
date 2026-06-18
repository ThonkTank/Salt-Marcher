package src.view.leftbartabs.hexmap;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class HexMapMainContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    record Projection(
            String title,
            String subtitle,
            String status
    ) {

        Projection {
            title = safeText(title);
            subtitle = safeText(subtitle);
            status = safeText(status);
        }

        static Projection initial() {
            return new Projection(
                    "Hex-Karte",
                    "Ueberlandkarte",
                    "Keine Hex-Karte geladen.");
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
