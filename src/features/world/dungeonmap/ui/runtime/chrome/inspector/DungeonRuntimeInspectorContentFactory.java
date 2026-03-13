package features.world.dungeonmap.ui.runtime.chrome.inspector;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapState;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonRuntimeInspectorContentFactory {

    public Node buildRoomCard(DungeonMapState mapState, DungeonSquare square, DungeonRoom room) {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));

        String areaName = resolveAreaName(mapState, square, room);
        box.getChildren().add(secondary("Bereich: " + valueOrDash(areaName)));

        if (room != null && mapState != null && mapState.index() != null) {
            int fieldCount = mapState.index().squaresForRoom(room.roomId()).size();
            box.getChildren().add(secondary("Felder: " + fieldCount));
        }

        box.getChildren().add(section("Beschreibung", resolveDescription(room)));
        return box;
    }

    private static String resolveAreaName(DungeonMapState mapState, DungeonSquare square, DungeonRoom room) {
        Long areaId = room != null ? room.areaId() : square == null ? null : square.areaId();
        if (areaId == null) {
            return square == null ? null : square.areaName();
        }
        if (mapState == null) {
            return square == null ? null : square.areaName();
        }
        DungeonArea area = mapState.index().findArea(areaId);
        if (area != null && area.name() != null && !area.name().isBlank()) {
            return area.name();
        }
        return square == null ? null : square.areaName();
    }

    private static String resolveDescription(DungeonRoom room) {
        if (room == null) {
            return "— Keine Beschreibung —";
        }
        return valueOrFallback(room.description(), "— Keine Beschreibung —");
    }

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private static Node section(String title, String content) {
        Label header = new Label(title);
        header.getStyleClass().addAll("section-header", "text-muted");
        Label body = new Label(content);
        body.setWrapText(true);
        return new VBox(6, header, body);
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private static String valueOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
