package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonEditorStatePane {

    private final DungeonMapSurfaceController controller;
    private final Supplier<String> viewportSummarySupplier;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final VBox content = new VBox(12);
    private final Button deleteButton = new Button("Delete loaded");
    private final ListView<MapSelectionRef> objectList = new ListView<>();
    private Consumer<MapSelectionRef> onTargetSelected = ignored -> { };
    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private @Nullable MapSelectionRef selectedTarget;
    private boolean syncingSelection;

    DungeonEditorStatePane(
            DungeonMapSurfaceController controller,
            Supplier<String> viewportSummarySupplier,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSummarySupplier = Objects.requireNonNull(viewportSummarySupplier, "viewportSummarySupplier");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("dungeon-editor-sidebar", "scene-pane");
        content.setPadding(new Insets(12));
        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> controller.deleteLoaded());

        objectList.setPrefHeight(180.0);
        objectList.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(MapSelectionRef item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.ownerKind() + " · " + item.label());
            }
        });
        objectList.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (!syncingSelection && after != null) {
                onTargetSelected.accept(after);
            }
        });

        controller.addListener(this::refresh);
        refresh();
    }

    Node content() {
        return content;
    }

    void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        refresh();
    }

    void setOnTargetSelected(Consumer<MapSelectionRef> onTargetSelected) {
        this.onTargetSelected = onTargetSelected == null ? ignored -> { } : onTargetSelected;
    }

    void showSelectedTarget(@Nullable MapSelectionRef selectedTarget) {
        this.selectedTarget = selectedTarget;
        refresh();
    }

    void refresh() {
        BaseMapSnapshot snapshot = controller.loadedSnapshot();
        syncObjectList(snapshot);
        deleteButton.setDisable(!controller.hasLoadedMap());
        content.getChildren().setAll(
                loadedMapCard(snapshot),
                objectSelectionCard(snapshot),
                toolDockCard(),
                historyCard(),
                mutationFeedbackCard()
        );
    }

    private VBox loadedMapCard(@Nullable BaseMapSnapshot snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                    "Loaded Map",
                    new Label("None"),
                    MapWorkspaceSupport.muted("Empty dungeon aggregates can be created from the toolbar."));
        }
        Label mapId = new Label("Map ID: " + snapshot.mapId().value());
        Label revision = new Label("Revision: " + snapshot.revision());
        Label floor = new Label("Current floor: " + snapshot.currentFloor());
        Label viewport = new Label(viewportSummarySupplier.get());
        viewport.setWrapText(true);
        return MapWorkspaceSupport.card(
                "Loaded Map",
                mapId,
                revision,
                floor,
                MapWorkspaceSupport.muted("Viewport"),
                viewport,
                deleteButton);
    }

    private VBox objectSelectionCard(@Nullable BaseMapSnapshot snapshot) {
        Label hint = selectedTarget == null
                ? MapWorkspaceSupport.muted("Wähle Zellen im Workspace oder Einträge aus der Liste.")
                : MapWorkspaceSupport.muted("Aktiv: " + selectedTarget.ownerKind() + " · " + selectedTarget.label());
        if (snapshot == null || snapshot.selectableTargets().isEmpty()) {
            return MapWorkspaceSupport.card(
                    "Map Objects",
                    MapWorkspaceSupport.muted("Für den geladenen Placeholder sind noch keine selektierbaren Objekte sichtbar."));
        }
        return MapWorkspaceSupport.card("Map Objects", objectList, hint);
    }

    private VBox toolDockCard() {
        Label title = new Label(activeTool.label());
        title.getStyleClass().add("bold");
        Label summary = new Label(activeTool.summary());
        summary.setWrapText(true);
        VBox card = MapWorkspaceSupport.card("Werkzeug", title, summary);
        if (activeTool == DungeonEditorTool.ROOM) {
            card.getChildren().add(roomMoveControls());
        } else {
            card.getChildren().add(placeholderDock(activeTool));
        }
        return card;
    }

    private VBox historyCard() {
        Button commitButton = new Button("Commit");
        commitButton.setDisable(true);
        Button cancelButton = new Button("Cancel");
        cancelButton.setDisable(true);
        Button undoButton = new Button("Undo");
        undoButton.setDisable(true);
        Button redoButton = new Button("Redo");
        redoButton.setDisable(true);
        HBox row = new HBox(8, commitButton, cancelButton, undoButton, redoButton);
        return MapWorkspaceSupport.card(
                "History",
                row,
                MapWorkspaceSupport.muted("Preview-, Commit- und History-Semantik sind als stabile Andockstelle vorbereitet."));
    }

    private VBox mutationFeedbackCard() {
        VBox card = MapWorkspaceSupport.card(
                "Mutation Feedback",
                new Label(controller.lastMutationSummary()));
        List<String> messages = controller.lastMutationMessages();
        if (messages.isEmpty()) {
            card.getChildren().add(MapWorkspaceSupport.muted("Noch keine zusätzlichen Meldungen."));
        } else {
            for (String message : messages) {
                Label line = new Label(message);
                line.setWrapText(true);
                card.getChildren().add(line);
            }
        }
        return card;
    }

    private VBox roomMoveControls() {
        boolean canMoveRoom = controller.canApplyEditorOperation()
                && selectedTarget != null
                && "room".equalsIgnoreCase(selectedTarget.ownerKind());
        Button up = moveButton("Raum hoch", 0, -1, canMoveRoom);
        Button down = moveButton("Raum runter", 0, 1, canMoveRoom);
        Button left = moveButton("Raum links", -1, 0, canMoveRoom);
        Button right = moveButton("Raum rechts", 1, 0, canMoveRoom);
        HBox row1 = new HBox(8, left, right);
        HBox row2 = new HBox(8, up, down);
        row1.setMaxWidth(Double.MAX_VALUE);
        row2.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(left, Priority.ALWAYS);
        HBox.setHgrow(right, Priority.ALWAYS);
        HBox.setHgrow(up, Priority.ALWAYS);
        HBox.setHgrow(down, Priority.ALWAYS);
        VBox box = new VBox(8,
                MapWorkspaceSupport.muted(canMoveRoom
                        ? "Die vorhandene Domain-Capability `MoveRoomAnchor` ist verdrahtet."
                        : "Wähle einen Raum aus, um die vorhandene Placeholder-Capability zu testen."),
                row1,
                row2);
        return box;
    }

    private Button moveButton(String text, int deltaQ, int deltaR, boolean enabled) {
        Button button = new Button(text);
        button.setDisable(!enabled);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> controller.applyEditorOperation(
                new DungeonEditorOperation.MoveRoomAnchor(deltaQ, deltaR),
                viewportSupplier.get()));
        return button;
    }

    private VBox placeholderDock(DungeonEditorTool tool) {
        return switch (tool) {
            case SELECT -> MapWorkspaceSupport.card(
                    "Selection",
                    MapWorkspaceSupport.muted("Selection nutzt die vorhandenen selectable targets und den Domain-Inspector."));
            case WALL -> capabilityList("DrawInternalWall", "EraseInternalWall");
            case DOOR -> capabilityList("PlaceDoor", "UpdateDoor", "RemoveDoor", "UpdateConnectionMetadata");
            case CORRIDOR -> capabilityList("ExtendCorridor", "RerouteCorridor");
            case STAIR -> capabilityList("PlaceStair", "UpdateStair", "RemoveConnection");
            case TRANSITION -> capabilityList("UI placeholder only", "Produktionsreife Docking-Stelle für künftige Domain-Capability");
            case ROOM -> capabilityList("PaintArea", "EraseArea", "PaintFloorOpening", "EraseFloorOpening");
        };
    }

    private VBox capabilityList(String... capabilities) {
        VBox box = new VBox(4);
        box.getChildren().add(MapWorkspaceSupport.muted("Angedockte Capability-Oberfläche:"));
        for (String capability : capabilities) {
            Label line = new Label(capability);
            box.getChildren().add(line);
        }
        return box;
    }

    private void syncObjectList(@Nullable BaseMapSnapshot snapshot) {
        syncingSelection = true;
        objectList.getItems().setAll(snapshot == null ? List.of() : snapshot.selectableTargets());
        MapSelectionRef resolvedSelection = resolveSelection(snapshot, selectedTarget);
        selectedTarget = resolvedSelection;
        if (resolvedSelection == null) {
            objectList.getSelectionModel().clearSelection();
        } else {
            objectList.getSelectionModel().select(resolvedSelection);
        }
        syncingSelection = false;
    }

    private @Nullable MapSelectionRef resolveSelection(@Nullable BaseMapSnapshot snapshot, @Nullable MapSelectionRef selection) {
        if (snapshot == null || selection == null) {
            return null;
        }
        return snapshot.selectableTargets().stream()
                .filter(candidate -> candidate.ownerId() == selection.ownerId())
                .filter(candidate -> candidate.ownerKind().equalsIgnoreCase(selection.ownerKind()))
                .filter(candidate -> candidate.partKind().equalsIgnoreCase(selection.partKind()))
                .findFirst()
                .orElse(null);
    }
}
