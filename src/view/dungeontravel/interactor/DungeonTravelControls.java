package src.view.dungeontravel.interactor;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.view.dungeonshared.interactor.DungeonMapSurfaceController;
import src.view.dungeonshared.interactor.DungeonOverlayBindings;
import src.view.dungeonshared.interactor.DungeonOverlayControls;

import java.util.Objects;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;

final class DungeonTravelControls extends VBox {

    private final DungeonMapSurfaceController controller;
    private final DoubleSupplier zoomSupplier;
    private final Supplier<src.domain.dungeon.api.Viewport> viewportSupplier;
    private final Label zoomLabel = new Label();
    private final Label mapLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final DungeonOverlayControls overlayControls = new DungeonOverlayControls();

    DungeonTravelControls(
            DungeonMapSurfaceController controller,
            DoubleSupplier zoomSupplier,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.zoomSupplier = Objects.requireNonNull(zoomSupplier, "zoomSupplier");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        getStyleClass().add("dungeon-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));

        Button downLevelButton = actionButton("Ebene -");
        downLevelButton.setOnAction(event -> controller.stepFloor(-1, this.viewportSupplier.get()));
        Button upLevelButton = actionButton("Ebene +");
        upLevelButton.setOnAction(event -> controller.stepFloor(1, this.viewportSupplier.get()));
        DungeonOverlayBindings.bind(overlayControls, controller, this.viewportSupplier);

        Region levelSpacer = new Region();
        HBox.setHgrow(levelSpacer, Priority.ALWAYS);
        HBox levelRow = new HBox(8, levelLabel, downLevelButton, upLevelButton, levelSpacer, overlayControls.trigger());
        levelRow.setAlignment(Pos.CENTER_LEFT);

        getChildren().addAll(zoomLabel, mapLabel, levelRow);
        controller.addListener(this::refresh);
        refresh();
    }

    Node content() {
        return this;
    }

    void refresh() {
        var state = controller.state();
        BaseMapSnapshot snapshot = state.loadedSnapshot();
        zoomLabel.setText("Zoom: " + Math.round(zoomSupplier.getAsDouble() * 100.0) + "%");
        mapLabel.setText(state.statusText());
        levelLabel.setText("Ebene z=" + (snapshot == null ? state.currentFloor() : snapshot.currentFloor()));
        overlayControls.showSettings(state.overlaySettings(), !state.hasLoadedMap());
    }

    private static Button actionButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}
