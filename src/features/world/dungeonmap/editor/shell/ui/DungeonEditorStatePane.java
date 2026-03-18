package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label wallPathLabel = new Label("Kein Startpunkt");
    private final Button cancelWallPathButton = new Button("Pfad verwerfen");
    private final Label corridorEditSelectionLabel = new Label("Kein Korridor gewaehlt");
    private final Button resetCorridorDoorButton = new Button("Auf Auto zuruecksetzen");
    private final Button deleteCorridorWaypointButton = new Button("Zwischenpunkt loeschen");

    public DungeonEditorStatePane(
            Runnable onCancelWallPath,
            Runnable onResetCorridorDoor,
            Runnable onDeleteCorridorWaypoint
    ) {
        content.getStyleClass().add("dungeon-editor-sidebar");
        activeToolLabel.getStyleClass().add("editor-panel-title");
        cancelWallPathButton.setOnAction(event -> onCancelWallPath.run());
        resetCorridorDoorButton.setOnAction(event -> onResetCorridorDoor.run());
        deleteCorridorWaypointButton.setOnAction(event -> onDeleteCorridorWaypoint.run());
        content.getChildren().addAll(
                card("Werkzeug", activeToolLabel),
                card("Wand", wallPathLabel, cancelWallPathButton),
                card("Korridor", corridorEditSelectionLabel, resetCorridorDoorButton, deleteCorridorWaypointButton));
    }

    public Node content() {
        return content;
    }

    public void refresh(
            DungeonEditorTool activeTool,
            DungeonClusterVertexRef shownWallAnchor,
            DungeonCorridor selectedCorridor,
            CorridorDoorHandle selectedCorridorDoorHandle,
            CorridorWaypointHandle selectedCorridorWaypointHandle
    ) {
        activeToolLabel.setText(activeTool.label());
        updateWallPathCard(activeTool, shownWallAnchor);
        updateCorridorCard(selectedCorridor, selectedCorridorDoorHandle, selectedCorridorWaypointHandle);
    }

    private void updateWallPathCard(DungeonEditorTool activeTool, DungeonClusterVertexRef shownWallAnchor) {
        if (activeTool.isWallTool() && shownWallAnchor != null) {
            wallPathLabel.setText(
                    "Cluster " + shownWallAnchor.clusterId()
                            + " @ Ecke " + shownWallAnchor.point().x() + "/" + shownWallAnchor.point().y());
            setVisible(cancelWallPathButton, true);
            return;
        }
        wallPathLabel.setText("Kein Startpunkt");
        setVisible(cancelWallPathButton, false);
    }

    private void updateCorridorCard(
            DungeonCorridor selectedCorridor,
            CorridorDoorHandle selectedCorridorDoorHandle,
            CorridorWaypointHandle selectedCorridorWaypointHandle
    ) {
        if (selectedCorridor == null || selectedCorridor.corridorId() == null) {
            corridorEditSelectionLabel.setText("Kein Korridor gewaehlt");
            setVisible(resetCorridorDoorButton, false);
            setVisible(deleteCorridorWaypointButton, false);
            return;
        }
        if (selectedCorridorDoorHandle != null && selectedCorridorDoorHandle.corridorId() == selectedCorridor.corridorId()) {
            corridorEditSelectionLabel.setText("Tuer an Raum " + selectedCorridorDoorHandle.roomId());
            setVisible(resetCorridorDoorButton, true);
            setVisible(deleteCorridorWaypointButton, false);
            return;
        }
        if (selectedCorridorWaypointHandle != null && selectedCorridorWaypointHandle.corridorId() == selectedCorridor.corridorId()) {
            corridorEditSelectionLabel.setText("Zwischenpunkt " + (selectedCorridorWaypointHandle.waypointIndex() + 1));
            setVisible(resetCorridorDoorButton, false);
            setVisible(deleteCorridorWaypointButton, true);
            return;
        }
        corridorEditSelectionLabel.setText("Korridor " + selectedCorridor.corridorId() + " ausgewaehlt");
        setVisible(resetCorridorDoorButton, false);
        setVisible(deleteCorridorWaypointButton, false);
    }

    private static void setVisible(Node node, boolean visible) {
        node.setManaged(visible);
        node.setVisible(visible);
    }

    private static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
}
