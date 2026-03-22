package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.LinkedHashMap;
import java.util.Map;

public final class DungeonRoomInspectorPresenter {

    private DungeonRoomInspectorPresenter() {
        throw new AssertionError("No instances");
    }

    public static Node buildRoomNode(Room room) {
        VBox box = new VBox(8);
        box.setPadding(new Insets(12));
        if (room == null) {
            box.getChildren().add(text("Keine Raumbeschreibung verfügbar"));
            return box;
        }
        box.getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                text(valueOrDash(room.narration().visualDescription())),
                sectionTitle("Ausgaenge"));
        Map<String, String> descriptionsByKey = descriptionsByExitKey(room);
        java.util.List<RoomExitDescriptor> exits = RoomExitCatalog.describe(room);
        for (RoomExitDescriptor exit : exits) {
            box.getChildren().addAll(
                    subTitle(exit.label()),
                    text(valueOrDash(descriptionsByKey.get(exitKey(exit.roomCell(), exit.direction())))));
        }
        if (exits.isEmpty()) {
            box.getChildren().add(text("—"));
        }
        return box;
    }

    private static Map<String, String> descriptionsByExitKey(Room room) {
        Map<String, String> result = new LinkedHashMap<>();
        for (RoomExitNarration exitNarration : room.narration().exitNarrations()) {
            result.put(exitKey(exitNarration.roomCell(), exitNarration.direction()), exitNarration.description());
        }
        return result;
    }

    private static String exitKey(features.world.dungeonmap.model.geometry.Point2i roomCell,
                                  features.world.dungeonmap.model.geometry.Point2i direction) {
        return roomCell.x() + ":" + roomCell.y() + ":" + direction.x() + ":" + direction.y();
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
