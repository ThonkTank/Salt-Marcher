package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.room.Room;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;

public final class DungeonRoomInspectorPresenter {

    private DungeonRoomInspectorPresenter() {
        throw new AssertionError("No instances");
    }

    public static Node buildRoomNode(DungeonLayout layout, Room room, DungeonHeading heading) {
        VBox box = new VBox(8);
        box.setPadding(new Insets(12));
        if (room == null) {
            box.getChildren().add(text("Keine Raumbeschreibung verfügbar"));
            return box;
        }
        box.getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                text(valueOrDash(room.narration().visualDescription())),
                sectionTitle("Türen"));
        List<DungeonRuntimeDoorDescriptor> exits = DungeonRuntimeDoorCatalog.describe(layout, room, heading);
        for (DungeonRuntimeDoorDescriptor exit : exits) {
            box.getChildren().addAll(
                    subTitle(exit.displayLabel()),
                    text(valueOrDash(exit.description())));
        }
        if (exits.isEmpty()) {
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
