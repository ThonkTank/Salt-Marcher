package features.world.dungeonmap.application.runtime;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonRuntimeSurfacePresenter {

    private DungeonRuntimeSurfacePresenter() {
        throw new AssertionError("No instances");
    }

    public static Node buildNode(DungeonRuntimeSurface surface) {
        VBox box = new VBox(8);
        box.setPadding(new Insets(12));
        if (surface == null) {
            box.getChildren().add(text("Keine Beschreibung verfügbar"));
            return box;
        }
        box.getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                text(valueOrDash(surface.visualDescription())),
                sectionTitle("Türen"));
        for (DungeonRuntimeDoorDescriptor door : surface.doors()) {
            box.getChildren().addAll(
                    subTitle(door.label()),
                    text(valueOrDash(door.description())));
        }
        if (surface.doors().isEmpty()) {
            box.getChildren().add(text("—"));
        }
        return box;
    }

    private static Label sectionTitle(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static Label subTitle(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("editor-panel-title");
        return label;
    }

    private static Label text(String text) {
        Label label = new Label(text);
        label.setWrapText(true);
        return label;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
