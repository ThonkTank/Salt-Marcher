package src.view.dungeontravel.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.mapshared.interactor.MapWorkspaceSupport;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonTravelStatePane {

    private final DungeonMapSurfaceController controller;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final VBox content = new VBox(12);
    private final TextField searchField = new TextField();
    private final ListView<DungeonMapSummary> mapList = new ListView<>();
    private final TextField createNameField = new TextField();
    private final Button loadButton = new Button("Load map");
    private final Button createButton = new Button("Create map");
    private final Button deleteButton = new Button("Delete loaded");
    private final ListView<MapSelectionRef> objectList = new ListView<>();
    private Consumer<MapSelectionRef> onTargetSelected = ignored -> { };
    private @Nullable MapSelectionRef selectedTarget;
    private boolean syncingSelection;

    DungeonTravelStatePane(
            DungeonMapSurfaceController controller,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        content.getStyleClass().setAll("dungeon-editor-sidebar", "scene-pane");
        content.setPadding(new Insets(12));

        searchField.setPromptText("Search maps");
        mapList.setPrefHeight(180.0);
        mapList.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (syncingSelection) {
                return;
            }
            controller.selectMap(after == null ? null : after.mapId());
            refresh();
        });
        mapList.setOnMouseClicked(event -> {
            if (event.getClickCount() == 2) {
                loadButton.fire();
            }
        });
        mapList.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapSummary item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.toString());
            }
        });

        objectList.setPrefHeight(160.0);
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

        createNameField.setPromptText("Dungeon Nr.X");
        createNameField.textProperty().addListener((ignored, before, after) -> refresh());
        searchField.textProperty().addListener((ignored, before, after) -> controller.setSearchText(after));
        loadButton.setMaxWidth(Double.MAX_VALUE);
        loadButton.setOnAction(event -> controller.loadSelected(this.viewportSupplier.get()));
        createButton.setMaxWidth(Double.MAX_VALUE);
        createButton.setOnAction(event -> controller.createMap(createNameField.getText(), this.viewportSupplier.get()));
        deleteButton.setMaxWidth(Double.MAX_VALUE);
        deleteButton.setOnAction(event -> controller.deleteLoaded());

        controller.addListener(this::refresh);
        refresh();
    }

    Node content() {
        return content;
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
        syncMapList();
        syncObjectList(snapshot);
        if (createNameField.getText().isBlank()) {
            createNameField.setText(controller.defaultMapName());
        }
        loadButton.setDisable(!controller.canLoadSelected());
        createButton.setDisable(createNameField.getText().trim().isEmpty());
        deleteButton.setDisable(!controller.hasLoadedMap());
        content.getChildren().setAll(
                mapSearchCard(),
                mapCreateCard(),
                runtimeStateCard(snapshot),
                objectListCard(snapshot)
        );
    }

    private VBox mapSearchCard() {
        return MapWorkspaceSupport.card(
                "Map Search",
                searchField,
                mapList,
                loadButton);
    }

    private VBox mapCreateCard() {
        return MapWorkspaceSupport.card(
                "Map Create",
                createNameField,
                createButton,
                deleteButton);
    }

    private VBox runtimeStateCard(@Nullable BaseMapSnapshot snapshot) {
        if (snapshot == null) {
            return MapWorkspaceSupport.card(
                    "Travel State",
                    MapWorkspaceSupport.muted("Lade einen Dungeon, um Room-, Exit- und Travel-Placeholder zu sehen."));
        }
        VBox card = MapWorkspaceSupport.card(
                "Travel State",
                new Label("Aktiver Dungeon: " + snapshot.mapName()),
                new Label("Floor: z=" + snapshot.currentFloor()),
                new Label("Overlay: " + controller.overlaySettings().mode().label()),
                MapWorkspaceSupport.muted(selectedTarget == null
                        ? "Kein Raumfokus ausgewählt."
                        : "Fokus: " + selectedTarget.ownerKind() + " · " + selectedTarget.label()),
                MapWorkspaceSupport.muted("Party-Token, Facing, Exits und Travel-Actions bleiben produktionsreife Andockstellen, bis die Runtime-Domain sie liefert."));
        for (String message : controller.lastMutationMessages()) {
            Label line = new Label(message);
            line.setWrapText(true);
            card.getChildren().add(line);
        }
        return card;
    }

    private VBox objectListCard(@Nullable BaseMapSnapshot snapshot) {
        if (snapshot == null || snapshot.selectableTargets().isEmpty()) {
            return MapWorkspaceSupport.card(
                    "Room Inspector",
                    MapWorkspaceSupport.muted("Keine selektierbaren Runtime-Objekte vorhanden."));
        }
        return MapWorkspaceSupport.card(
                "Room Inspector",
                objectList,
                MapWorkspaceSupport.muted("Details landen im shell-owned Inspector. Travel-Actions bleiben Placeholder."));
    }

    private void syncMapList() {
        syncingSelection = true;
        mapList.getItems().setAll(controller.visibleMaps());
        DungeonMapSummary selected = controller.selectedSummary();
        if (selected == null) {
            mapList.getSelectionModel().clearSelection();
        } else {
            mapList.getSelectionModel().select(selected);
        }
        syncingSelection = false;
    }

    private void syncObjectList(@Nullable BaseMapSnapshot snapshot) {
        syncingSelection = true;
        objectList.getItems().setAll(snapshot == null ? List.of() : snapshot.selectableTargets());
        MapSelectionRef resolved = resolveSelection(snapshot, selectedTarget);
        selectedTarget = resolved;
        if (resolved == null) {
            objectList.getSelectionModel().clearSelection();
        } else {
            objectList.getSelectionModel().select(resolved);
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
