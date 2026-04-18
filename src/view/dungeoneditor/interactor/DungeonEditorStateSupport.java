package src.view.dungeoneditor.interactor;

import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.List;
import java.util.function.Supplier;

final class DungeonEditorStateSupport {

    private DungeonEditorStateSupport() {
    }

    static VBox toolDockCard(
            DungeonEditorTool activeTool,
            DungeonMapSurfaceController controller,
            @Nullable MapSelectionRef selectedTarget,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        Label title = new Label(activeTool.label());
        title.getStyleClass().add("bold");
        Label summary = new Label(activeTool.summary());
        summary.setWrapText(true);
        VBox card = MapWorkspaceSupport.card("Werkzeug", title, summary);
        if (activeTool == DungeonEditorTool.ROOM) {
            card.getChildren().add(roomMoveControls(controller, selectedTarget, viewportSupplier));
        } else {
            card.getChildren().add(placeholderDock(activeTool));
        }
        return card;
    }

    static VBox mutationFeedbackCard(DungeonMapSurfaceController controller) {
        var state = controller.state();
        VBox card = MapWorkspaceSupport.card(
                "Meldungen",
                new Label(state.lastMutationSummary()));
        List<String> messages = state.lastMutationMessages();
        if (messages.isEmpty()) {
            card.getChildren().add(MapWorkspaceSupport.muted("Keine weiteren Rueckmeldungen."));
            return card;
        }
        for (String message : messages) {
            Label line = new Label(message);
            line.setWrapText(true);
            card.getChildren().add(line);
        }
        return card;
    }

    private static VBox roomMoveControls(
            DungeonMapSurfaceController controller,
            @Nullable MapSelectionRef selectedTarget,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        boolean canMoveRoom = controller.state().canApplyEditorOperation()
                && selectedTarget != null
                && "room".equalsIgnoreCase(selectedTarget.ownerKind());
        Button up = moveButton("Raum hoch", 0, -1, canMoveRoom, controller, viewportSupplier);
        Button down = moveButton("Raum runter", 0, 1, canMoveRoom, controller, viewportSupplier);
        Button left = moveButton("Raum links", -1, 0, canMoveRoom, controller, viewportSupplier);
        Button right = moveButton("Raum rechts", 1, 0, canMoveRoom, controller, viewportSupplier);
        HBox row1 = new HBox(8, left, right);
        HBox row2 = new HBox(8, up, down);
        row1.setMaxWidth(Double.MAX_VALUE);
        row2.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(left, Priority.ALWAYS);
        HBox.setHgrow(right, Priority.ALWAYS);
        HBox.setHgrow(up, Priority.ALWAYS);
        HBox.setHgrow(down, Priority.ALWAYS);
        return new VBox(8,
                MapWorkspaceSupport.muted(canMoveRoom
                        ? "Die vorhandene Room-Anchor-Capability ist aktiv."
                        : "Waehle einen Raum aus, um die vorhandene Room-Anchor-Capability zu testen."),
                row1,
                row2);
    }

    // PMD suppression is local: this helper keeps one editor-action wiring site for the state dock; see src/view/dungeoneditor/UI.md.
    @SuppressWarnings("PMD.ExcessiveParameterList")
    private static Button moveButton(
            String text,
            int deltaQ,
            int deltaR,
            boolean enabled,
            DungeonMapSurfaceController controller,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        Button button = new Button(text);
        button.setDisable(!enabled);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> controller.applyEditorOperation(
                new src.domain.dungeon.api.DungeonEditorOperation.MoveRoomAnchor(deltaQ, deltaR),
                viewportSupplier.get()));
        return button;
    }

    private static VBox placeholderDock(DungeonEditorTool tool) {
        return switch (tool) {
            case SELECT -> MapWorkspaceSupport.card(
                    "Selection",
                    MapWorkspaceSupport.muted("Selection nutzt die vorhandenen selectable targets und den Shell-Inspector."));
            case WALL -> capabilityList("DrawInternalWall", "EraseInternalWall");
            case DOOR -> capabilityList("PlaceDoor", "UpdateDoor", "RemoveDoor", "UpdateConnectionMetadata");
            case CORRIDOR -> capabilityList("ExtendCorridor", "RerouteCorridor");
            case STAIR -> capabilityList("PlaceStair", "UpdateStair", "RemoveConnection");
            case TRANSITION -> capabilityList("UI placeholder only", "Docking-Stelle fuer spaetere Transition-Capability");
            case ROOM -> capabilityList("PaintArea", "EraseArea", "PaintFloorOpening", "EraseFloorOpening");
        };
    }

    private static VBox capabilityList(String... capabilities) {
        VBox box = new VBox(4);
        box.getChildren().add(MapWorkspaceSupport.muted("Angedockte Capability-Oberflaeche:"));
        for (String capability : capabilities) {
            box.getChildren().add(new Label(capability));
        }
        return box;
    }
}
