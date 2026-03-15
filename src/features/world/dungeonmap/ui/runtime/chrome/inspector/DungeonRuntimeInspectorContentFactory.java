package features.world.dungeonmap.ui.runtime.chrome.inspector;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.ui.shared.format.DungeonRoomDetailRenderer;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonRuntimeInspectorContentFactory {

    public Node buildRoomCard(DungeonMapState mapState, DungeonSquare square, DungeonRoom room) {
        VBox box = new VBox(10);
        box.setPadding(new javafx.geometry.Insets(12));

        String areaName = resolveAreaName(mapState, square, room);
        if (room != null && mapState != null && mapState.index() != null) {
            DungeonRoomDetailRenderer.appendStructuredDetails(box, mapState.index(), room, areaName);
        } else {
            box.getChildren().add(section("Beschreibung", "— Keine Beschreibung —"));
        }
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

    private static Node section(String title, String content) {
        Label header = new Label(title);
        header.getStyleClass().addAll("section-header", "text-muted");
        Label body = new Label(content);
        body.setWrapText(true);
        return new VBox(6, header, body);
    }
}
