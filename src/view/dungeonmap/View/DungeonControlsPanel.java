package src.view.dungeonmap.View;

import java.util.Objects;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.dungeonmap.api.DungeonLoadedMapViewModel;
import src.view.dungeonmap.api.DungeonMapSurfaceViewModel;
import src.view.dungeonmap.api.DungeonMapSummaryViewModel;
import src.view.dungeonmap.api.DungeonViewportViewModel;

public final class DungeonControlsPanel extends VBox {

    public enum Mode {
        EDITOR,
        TRAVEL
    }

    private final DungeonMapSurfaceViewModel viewModel;
    private final Supplier<DungeonViewportViewModel> viewportSupplier;
    private final @Nullable DoubleSupplier zoomSupplier;
    private final Mode mode;
    private final ComboBox<DungeonMapSummaryViewModel> selector = new ComboBox<>();
    private final Label zoomLabel = new Label();
    private final Label statusLabel = new Label();
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button loadButton;
    private final Button previousLevelButton = actionButton("Ebene -");
    private final Button nextLevelButton = actionButton("Ebene +");
    private final DungeonOverlayControls overlayControls = new DungeonOverlayControls();
    private final HBox mapRowActions = new HBox(8);
    private final VBox modeControls = new VBox(6);
    private final VBox footerContent = new VBox(6);
    private boolean syncingSelection;

    public DungeonControlsPanel(
            Mode mode,
            DungeonMapSurfaceViewModel viewModel,
            Supplier<DungeonViewportViewModel> viewportSupplier,
            @Nullable DoubleSupplier zoomSupplier
    ) {
        this.mode = Objects.requireNonNull(mode, "mode");
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.viewportSupplier = Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        this.zoomSupplier = zoomSupplier;
        this.loadButton = actionButton(mode == Mode.EDITOR ? "Dungeon bearbeiten" : "Dungeon laden");

        getStyleClass().add("control-toolbar");
        setSpacing(10);
        setPadding(new Insets(12));
        setFillWidth(true);
        setMaxWidth(Double.MAX_VALUE);

        configureSelector();
        configureActions();
        DungeonOverlayBindings.bind(overlayControls, viewModel, viewportSupplier);

        if (mode == Mode.TRAVEL) {
            getChildren().add(zoomLabel);
        }
        getChildren().addAll(buildDungeonGroup(), modeControls, footerContent);
        viewModel.addListener(this::refresh);
        refresh();
    }

    public void setMapRowActions(Node... nodes) {
        mapRowActions.getChildren().setAll(nodes == null ? java.util.List.of() : java.util.List.of(nodes));
    }

    public void setModeControls(Node... nodes) {
        modeControls.getChildren().setAll(nodes == null ? java.util.List.of() : java.util.List.of(nodes));
    }

    public void setFooterContent(Node... nodes) {
        footerContent.getChildren().setAll(nodes == null ? java.util.List.of() : java.util.List.of(nodes));
    }

    public void refresh() {
        var state = viewModel.viewState();
        withSelectionSync(() -> {
            selector.getItems().setAll(state.visibleMaps());
            DungeonMapSummaryViewModel selected = state.selectedSummary();
            if (selected == null) {
                selector.getSelectionModel().clearSelection();
            } else {
                selector.getSelectionModel().select(selected);
            }
        });
        DungeonLoadedMapViewModel snapshot = state.loadedMap();
        selector.setDisable(state.visibleMaps().isEmpty());
        loadButton.setDisable(!state.canLoadSelected());
        previousLevelButton.setDisable(!state.hasLoadedMap());
        nextLevelButton.setDisable(!state.hasLoadedMap());
        overlayControls.showSettings(state.overlaySettings(), !state.hasLoadedMap());
        if (zoomSupplier != null) {
            zoomLabel.setText("Zoom: " + Math.round(zoomSupplier.getAsDouble() * 100.0) + "%");
        }
        statusLabel.setText(state.statusText());
        levelLabel.setText("Ebene z=" + (snapshot == null ? state.currentFloor() : snapshot.currentFloor()));
    }

    private void configureActions() {
        loadButton.setOnAction(event -> viewModel.loadSelected(viewportSupplier.get()));
        previousLevelButton.setOnAction(event -> viewModel.stepFloor(-1, viewportSupplier.get()));
        nextLevelButton.setOnAction(event -> viewModel.stepFloor(1, viewportSupplier.get()));
    }

    private void configureSelector() {
        selector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonMapSummaryViewModel summary) {
                return summary == null ? "" : summary.mapName();
            }

            @Override
            public DungeonMapSummaryViewModel fromString(String string) {
                throw new UnsupportedOperationException("ComboBox conversion is view-only.");
            }
        });
        selector.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(DungeonMapSummaryViewModel item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.mapName());
            }
        });
        selector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector, Priority.ALWAYS);
        selector.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (syncingSelection || after == null) {
                return;
            }
            viewModel.selectMap(after.mapId());
        });
    }

    private VBox buildDungeonGroup() {
        HBox mapRow = new HBox(8, selector, loadButton, mapRowActions);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        mapRow.setMaxWidth(Double.MAX_VALUE);
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox levelRow = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer, overlayControls.trigger());
        levelRow.setAlignment(Pos.CENTER_LEFT);
        levelRow.setMaxWidth(Double.MAX_VALUE);
        VBox dungeonGroup = new VBox(6, MapWorkspaceSupport.sectionLabel("Dungeon"), mapRow, statusLabel, levelRow);
        dungeonGroup.getStyleClass().add("control-group");
        return dungeonGroup;
    }

    @SuppressWarnings("PMD.UnusedAssignment")
    private void withSelectionSync(Runnable action) {
        syncingSelection = true;
        try {
            action.run();
        } finally {
            syncingSelection = false;
        }
    }

    public static Button actionButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }
}
