package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelContentModel;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelViewInputEvent;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class DungeonEditorControlsView extends DungeonControlPanelView {

    static final String VIEW_GRID = "Grid";
    static final String VIEW_GRAPH = "Graph";
    static final String SELECT_TOOL = "Auswahl";
    static final String ROOM_PAINT_TOOL = "Raum malen";
    static final String ROOM_DELETE_TOOL = "Raum löschen";
    static final String WALL_CREATE_TOOL = "Wand setzen";
    static final String WALL_DELETE_TOOL = "Wand löschen";
    static final String DOOR_CREATE_TOOL = "Tür setzen";
    static final String DOOR_DELETE_TOOL = "Tür löschen";
    static final String CORRIDOR_CREATE_TOOL = "Korridor erstellen";
    static final String CORRIDOR_DELETE_TOOL = "Korridor löschen";
    static final String STAIR_CREATE_TOOL = "Treppe erstellen";
    static final String STAIR_DELETE_TOOL = "Treppe löschen";
    static final String TRANSITION_CREATE_TOOL = "Übergang erstellen";
    static final String TRANSITION_DELETE_TOOL = "Übergang löschen";
    static final String TOOL_BUTTON_STYLE = "tool-btn";

    private final DungeonEditorControlsEvents events = new DungeonEditorControlsEvents(this::publish);
    private final DungeonEditorMapControls mapControls = new DungeonEditorMapControls(this, events);
    private final DungeonEditorProjectionControls projectionControls = new DungeonEditorProjectionControls(this, events);
    private final DungeonEditorToolControls toolControls = new DungeonEditorToolControls(this, events);
    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public DungeonEditorControlsView() {
        super("");
        DungeonEditorControlsFxAccess.addStyle(this, "control-toolbar");
        super.onViewInputEvent(this::handleDungeonControlInput);
        setFillWidth(true);
        getChildren().setAll(mapControls.row(), projectionControls.row(), toolControls.row());
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.controlsProjectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contributionModel.controlsProjectionProperty().get());
    }

    private void publish(DungeonEditorControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private void showProjection(DungeonEditorContributionModel.ControlsProjection projection) {
        DungeonEditorContributionModel.ControlsProjection resolvedProjection = projection == null
                ? DungeonEditorContributionModel.ControlsProjection.initial()
                : projection;
        boolean hasMap = !resolvedProjection.selectedMapKey().isBlank();
        boolean busy = resolvedProjection.busy();
        mapControls.showMaps(
                resolvedProjection.mapEntries().stream()
                        .map(DungeonEditorControlsView::toMapItem)
                        .toList(),
                resolvedProjection.selectedMapKey(),
                busy,
                resolvedProjection.statusText());
        projectionControls.showLevels(
                resolvedProjection.projectionLevel(),
                busy,
                hasMap);
        projectionControls.showOverlaySettings(DungeonEditorProjectionControls.toSettings(resolvedProjection.overlayProjection()), busy);
        projectionControls.showViewMode(resolvedProjection.viewModeLabel());
        toolControls.showTool(resolvedProjection.selectedToolLabel());
        mapControls.showMapEditor(resolvedProjection.mapEditorUiState());
        toolControls.showToolPalette(resolvedProjection.toolPaletteUiState());
    }

    private void handleDungeonControlInput(DungeonControlPanelViewInputEvent event) {
        if (event == null || event.overlay() == null) {
            return;
        }
        events.overlayInput(event.overlay());
    }

    HBox controlsRow(Node... nodes) {
        return compactControlRow(nodes);
    }

    HBox controlsGroup(Node... nodes) {
        return compactControlGroup(nodes);
    }

    void describeNode(Node node, String description) {
        describe(node, description);
    }

    Region rowSpacer() {
        return spacer();
    }

    Label newSectionLabel(String text) {
        return sectionLabel(text);
    }

    private static MapItem toMapItem(DungeonEditorContributionModel.MapListEntry selection) {
        return new MapItem(
                selection.key(),
                selection.mapIdValue(),
                selection.mapName(),
                selection.revision());
    }

    public record MapItem(
            String key,
            long mapId,
            String mapName,
            long revision
    ) {
        public MapItem {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }
}

final class DungeonEditorControlsEvents {

    private final Consumer<DungeonEditorControlsViewInputEvent> sink;

    DungeonEditorControlsEvents(Consumer<DungeonEditorControlsViewInputEvent> sink) {
        this.sink = sink;
    }

    void mapSelection(long selectedMapIdValue) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSelectionInput(selectedMapIdValue),
                null,
                null,
                null,
                0,
                null));
    }

    void mapEditorInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested,
            String draftText
    ) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                new DungeonEditorControlsViewInputEvent.MapEditorInput(
                        openCreateRequested,
                        openRenameRequested,
                        openDeleteRequested,
                        dismissRequested,
                        submitRequested,
                        confirmDeleteRequested,
                        draftText),
                null,
                null,
                0,
                null));
    }

    void viewModeSelected(String viewModeKey) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                viewModeKey,
                null,
                0,
                null));
    }

    void toolFamilySelected(DungeonEditorControlsViewInputEvent.ToolFamily family, String primaryToolLabel) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(family, primaryToolLabel, false),
                0,
                null));
    }

    void toolSelected(@Nullable String selectedToolLabel) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, selectedToolLabel, false),
                0,
                null));
    }

    void toolDismissed() {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, null, true),
                0,
                null));
    }

    void projectionShift(int projectionLevelShift) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                projectionLevelShift,
                null));
    }

    void overlayInput(DungeonControlPanelViewInputEvent.OverlayInput overlayInput) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                0,
                new DungeonEditorControlsViewInputEvent.OverlayInput(
                        overlayInput.modeKey(),
                        overlayInput.levelRange(),
                        overlayInput.opacity(),
                        overlayInput.selectedLevelsText())));
    }
}

final class DungeonEditorControlsFxAccess {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";

    private DungeonEditorControlsFxAccess() {
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static void addStyle(Node node, String styleClass) {
        node.getStyleClass().add(styleClass);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static void addStyles(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static boolean hasStyle(Node node, String styleClass) {
        return node.getStyleClass().contains(styleClass);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static void removeStyle(Node node, String styleClass) {
        node.getStyleClass().remove(styleClass);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static <T> void setItems(ComboBox<T> comboBox, List<T> items) {
        comboBox.getItems().setAll(items);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static <T> void select(ComboBox<T> comboBox, @Nullable T value) {
        comboBox.getSelectionModel().select(value);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static <T> @Nullable T selectedItem(ComboBox<T> comboBox) {
        return comboBox.getSelectionModel().getSelectedItem();
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static void setItems(SplitMenuButton splitMenuButton, MenuItem... items) {
        splitMenuButton.getItems().setAll(items);
    }
}

final class DungeonEditorControlsListeners {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";

    private DungeonEditorControlsListeners() {
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static <T> void onSelectedItemChanged(ComboBox<T> comboBox, ChangeListener<? super T> changeListener) {
        comboBox.getSelectionModel().selectedItemProperty().addListener(changeListener);
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    static <T> void withDetachedSelectionUpdate(
            ComboBox<T> comboBox,
            ChangeListener<? super T> changeListener,
            Runnable action
    ) {
        comboBox.getSelectionModel().selectedItemProperty().removeListener(changeListener);
        try {
            action.run();
        } finally {
            comboBox.getSelectionModel().selectedItemProperty().addListener(changeListener);
        }
    }

    static void withDetachedTextUpdate(TextField textField, ChangeListener<String> changeListener, Runnable action) {
        textField.textProperty().removeListener(changeListener);
        try {
            action.run();
        } finally {
            textField.textProperty().addListener(changeListener);
        }
    }

    static void withDetachedToggleUpdate(ToggleGroup toggleGroup, ChangeListener<Toggle> changeListener, Runnable action) {
        toggleGroup.selectedToggleProperty().removeListener(changeListener);
        try {
            action.run();
        } finally {
            toggleGroup.selectedToggleProperty().addListener(changeListener);
        }
    }
}

final class DungeonEditorControlsGate {

    private final AtomicBoolean enabled = new AtomicBoolean();

    boolean enabled() {
        return enabled.get();
    }

    void runSuppressed(Runnable action) {
        enabled.set(true);
        try {
            action.run();
        } finally {
            enabled.set(false);
        }
    }
}

final class DungeonEditorMapControls {

    private final ComboBox<DungeonEditorControlsView.MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
    private final Label statusLabel = new Label();
    private final ChangeListener<DungeonEditorControlsView.MapItem> selectionListener =
            (ignored, before, after) -> handleSelectionChanged(after);
    private final DungeonEditorMapEditorPopup mapEditorPopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorMapControls(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEditorControlsView.MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public DungeonEditorControlsView.MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        DungeonEditorControlsListeners.onSelectedItemChanged(mapSelector, selectionListener);

        mapActionButton.setText("Neu");
        DungeonEditorControlsFxAccess.setItems(mapActionButton, editMapItem, deleteMapItem);
        DungeonEditorControlsFxAccess.addStyles(mapActionButton, "toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);

        mapEditorPopup = new DungeonEditorMapEditorPopup(panelView, events, mapActionButton);
        mapActionButton.setOnAction(event -> mapEditorPopup.publishInput(true, false, false, false, false, false));
        editMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, true, false, false, false, false));
        deleteMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, false, true, false, false, false));
        panelView.describeNode(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");

        DungeonEditorControlsFxAccess.addStyle(statusLabel, "text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);

        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        row = panelView.controlsRow(mapSelector, mapActionButton, statusLabel);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-map-row");
    }

    HBox row() {
        return row;
    }

    void showMaps(List<DungeonEditorControlsView.MapItem> maps, String selectedKey, boolean busy, String statusText) {
        List<DungeonEditorControlsView.MapItem> safeMaps = maps == null ? List.of() : List.copyOf(maps);
        DungeonEditorControlsListeners.withDetachedSelectionUpdate(mapSelector, selectionListener, () -> {
            DungeonEditorControlsFxAccess.setItems(mapSelector, safeMaps);
            DungeonEditorControlsFxAccess.select(mapSelector, resolveSelected(safeMaps, selectedKey));
        });
        mapSelector.setDisable(busy || safeMaps.isEmpty());
        mapActionButton.setDisable(busy);
        boolean selectionMissing = DungeonEditorControlsFxAccess.selectedItem(mapSelector) == null;
        editMapItem.setDisable(busy || selectionMissing);
        deleteMapItem.setDisable(busy || selectionMissing);
        String resolvedStatus = statusText == null ? "" : statusText;
        statusLabel.setText(resolvedStatus);
        statusLabel.setVisible(!resolvedStatus.isBlank());
        statusLabel.setManaged(!resolvedStatus.isBlank());
    }

    void showMapEditor(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        mapEditorPopup.show(mapEditorUiState);
    }

    private void handleSelectionChanged(DungeonEditorControlsView.MapItem selectedMap) {
        boolean hasSelection = selectedMap != null;
        editMapItem.setDisable(!hasSelection);
        deleteMapItem.setDisable(!hasSelection);
        if (hasSelection) {
            events.mapSelection(selectedMap.mapId());
        }
    }

    private DungeonEditorControlsView.MapItem resolveSelected(
            List<DungeonEditorControlsView.MapItem> maps,
            String selectedKey
    ) {
        DungeonEditorControlsView.MapItem selectedMap = maps.stream()
                .filter(item -> Objects.equals(item.key(), selectedKey))
                .findFirst()
                .orElse(null);
        if (selectedMap != null || maps.isEmpty()) {
            return selectedMap;
        }
        return maps.getFirst();
    }
}

final class DungeonEditorMapEditorPopup {

    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final Label titleLabel = new Label();
    private final TextField draftField = new TextField();
    private final Label errorLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button saveButton = new Button("Speichern");
    private final ChangeListener<String> draftListener = (ignored, before, after) -> handleDraftChanged();
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final HBox deleteConfirmRow;
    private final HBox actionRow;
    private final Node anchor;
    private final DungeonEditorControlsEvents events;

    DungeonEditorMapEditorPopup(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events, Node anchor) {
        this.events = events;
        this.anchor = anchor;
        DungeonEditorControlsFxAccess.addStyle(titleLabel, "panel-title");
        DungeonEditorControlsFxAccess.addStyle(errorLabel, "text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setManaged(false);
        errorLabel.setVisible(false);

        Button cancelDeleteButton = new Button("Abbrechen");
        Button confirmDeleteButton = new Button("Löschen");
        Label deleteLabel = new Label("Dungeon löschen?");
        DungeonEditorControlsFxAccess.addStyle(deleteLabel, "text-warning");
        deleteConfirmRow = new HBox(8, deleteLabel, panelView.rowSpacer(), cancelDeleteButton, confirmDeleteButton);
        deleteConfirmRow.setVisible(false);
        deleteConfirmRow.setManaged(false);

        actionRow = new HBox(8, cancelButton, panelView.rowSpacer(), saveButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);

        VBox body = new VBox(10, draftField, errorLabel, deleteConfirmRow);
        DialogSurfaceView panel = new DialogSurfaceView();
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        panel.setHeader(titleLabel);
        panel.setBody(body, BodyPolicy.FIXED);
        panel.setFooter(actionRow);
        popup.setContent(panel);
        popup.addOnHidden(event -> handleHidden());

        cancelButton.setOnAction(event -> publishInput(false, false, false, true, false, false));
        cancelDeleteButton.setOnAction(event -> publishInput(false, false, false, true, false, false));
        confirmDeleteButton.setOnAction(event -> publishInput(false, false, false, false, false, true));
        saveButton.setOnAction(event -> publishInput(false, false, false, false, true, false));
        draftField.setOnAction(event -> publishInput(false, false, false, false, true, false));
        draftField.textProperty().addListener(draftListener);
    }

    void publishInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested
    ) {
        events.mapEditorInput(
                openCreateRequested,
                openRenameRequested,
                openDeleteRequested,
                dismissRequested,
                submitRequested,
                confirmDeleteRequested,
                currentDraftText());
    }

    void show(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        DungeonEditorContributionModel.MapEditorUiState resolvedState = mapEditorUiState == null
                ? DungeonEditorContributionModel.MapEditorUiState.hidden()
                : mapEditorUiState;
        boolean popupWasShowing = popup.isShowing();
        titleLabel.setText(resolvedState.title());
        DungeonEditorControlsListeners.withDetachedTextUpdate(draftField, draftListener, () ->
                draftField.setText(resolvedState.draftName()));
        draftField.setVisible(resolvedState.draftFieldVisible());
        draftField.setManaged(resolvedState.draftFieldVisible());
        actionRow.setVisible(resolvedState.actionRowVisible());
        actionRow.setManaged(resolvedState.actionRowVisible());
        saveButton.setVisible(resolvedState.submitVisible());
        saveButton.setManaged(resolvedState.submitVisible());
        saveButton.setText(resolvedState.submitLabel());
        errorLabel.setText(resolvedState.errorText());
        errorLabel.setVisible(!resolvedState.errorText().isBlank());
        errorLabel.setManaged(!resolvedState.errorText().isBlank());
        deleteConfirmRow.setVisible(resolvedState.deleteConfirmationVisible());
        deleteConfirmRow.setManaged(resolvedState.deleteConfirmationVisible());
        if (!resolvedState.visible()) {
            hidePopup();
            return;
        }
        if (!popupWasShowing) {
            popup.showBelow(anchor);
        }
        if (resolvedState.draftFieldVisible()) {
            popup.focusAfterShown(draftField);
            if (!popupWasShowing) {
                draftField.selectAll();
            }
        }
    }

    private void handleDraftChanged() {
        publishInput(false, false, false, false, false, false);
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            publishInput(false, false, false, true, false, false);
        }
    }

    private void hidePopup() {
        if (popup.isShowing()) {
            hiddenGate.runSuppressed(popup::hide);
        }
    }

    private String currentDraftText() {
        String draftText = draftField.getText();
        return draftText == null ? "" : draftText.strip();
    }
}

final class DungeonEditorProjectionControls {

    private static final String VIEW_GRID = "Grid";
    private static final String VIEW_GRAPH = "Graph";

    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final OverlayControlsPanel overlayControls;
    private final ToggleButton gridButton = createToolToggle(VIEW_GRID);
    private final ToggleButton graphButton = createToolToggle(VIEW_GRAPH);
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ChangeListener<Toggle> viewModeListener = (ignored, oldToggle, newToggle) ->
            handleViewModeChanged(oldToggle, newToggle);
    private final HBox row;
    private final DungeonEditorControlsEvents events;
    private final DungeonEditorControlsView panelView;

    DungeonEditorProjectionControls(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.panelView = panelView;
        this.events = events;
        this.overlayControls = panelView.newOverlayControls();
        DungeonEditorControlsFxAccess.addStyle(previousLevelButton, "toolbar-action-button");
        DungeonEditorControlsFxAccess.addStyle(nextLevelButton, "toolbar-action-button");
        previousLevelButton.setOnAction(event -> events.projectionShift(-1));
        nextLevelButton.setOnAction(event -> events.projectionShift(1));
        DungeonEditorControlsFxAccess.addStyle(levelLabel, "text-muted");
        panelView.describeNode(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        panelView.describeNode(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");

        gridButton.setToggleGroup(viewModeGroup);
        graphButton.setToggleGroup(viewModeGroup);
        gridButton.setSelected(true);
        viewModeGroup.selectedToggleProperty().addListener(viewModeListener);

        HBox stepper = panelView.controlsGroup(levelLabel, previousLevelButton, nextLevelButton);
        DungeonEditorControlsFxAccess.addStyle(stepper, "dungeon-stepper-group");
        HBox viewModeSegment = panelView.controlsGroup(gridButton, graphButton);
        DungeonEditorControlsFxAccess.addStyle(viewModeSegment, "dungeon-segment-group");
        row = panelView.controlsRow(stepper, overlayControls.trigger(), viewModeSegment);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-projection-row");
    }

    static DungeonControlPanelContentModel.OverlaySettings toSettings(DungeonEditorContributionModel.OverlayProjection settings) {
        return new DungeonControlPanelContentModel.OverlaySettings(
                OverlayModeKey.fromModelKey(settings.modeKey()).overlayMode(),
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    HBox row() {
        return row;
    }

    void showLevels(int activeLevel, boolean busy, boolean navigationEnabled) {
        levelLabel.setText("Ebene z=" + activeLevel);
        previousLevelButton.setDisable(busy || !navigationEnabled);
        nextLevelButton.setDisable(busy || !navigationEnabled);
    }

    void showOverlaySettings(DungeonControlPanelContentModel.OverlaySettings settings, boolean disabled) {
        panelView.contentModel().showOverlaySettings(settings, disabled);
    }

    void showViewMode(String viewMode) {
        DungeonEditorControlsListeners.withDetachedToggleUpdate(viewModeGroup, viewModeListener, () -> {
            graphButton.setSelected(VIEW_GRAPH.equals(viewMode));
            gridButton.setSelected(!VIEW_GRAPH.equals(viewMode));
        });
    }

    private void handleViewModeChanged(Toggle oldToggle, Toggle newToggle) {
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        events.viewModeSelected(graphButton.equals(newToggle) ? VIEW_GRAPH : VIEW_GRID);
    }

    private static ToggleButton createToolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private enum OverlayModeKey {
        OFF(DungeonControlPanelContentModel.Mode.OFF),
        NEARBY(DungeonControlPanelContentModel.Mode.NEARBY),
        SELECTED(DungeonControlPanelContentModel.Mode.SELECTED);

        private final DungeonControlPanelContentModel.Mode overlayMode;

        OverlayModeKey(DungeonControlPanelContentModel.Mode overlayMode) {
            this.overlayMode = overlayMode;
        }

        private DungeonControlPanelContentModel.Mode overlayMode() {
            return overlayMode;
        }

        private static OverlayModeKey fromModelKey(String modelKey) {
            for (OverlayModeKey value : values()) {
                if (value.matches(modelKey)) {
                    return value;
                }
            }
            return OFF;
        }

        private boolean matches(String modelKey) {
            return modelKey != null && name().equalsIgnoreCase(modelKey);
        }
    }
}

final class DungeonEditorToolControls {

    private static final String ROOM_FAMILY = "Raum";
    private static final String WALL_FAMILY = "Wand";
    private static final String DOOR_FAMILY = "Tür";
    private static final String CORRIDOR_FAMILY = "Korridor";
    private static final String STAIR_FAMILY = "Treppe";
    private static final String TRANSITION_FAMILY = "Übergang";
    private static final String STYLE_SELECTED = "selected";

    private final ToggleButton selectButton = createToolToggle(DungeonEditorControlsView.SELECT_TOOL);
    private final Button roomButton = createToolButton(ROOM_FAMILY);
    private final Button wallButton = createToolButton(WALL_FAMILY);
    private final Button doorButton = createToolButton(DOOR_FAMILY);
    private final Button corridorButton = createToolButton(CORRIDOR_FAMILY);
    private final Button stairButton = createToolButton(STAIR_FAMILY);
    private final Button transitionButton = createToolButton(TRANSITION_FAMILY);
    private final DungeonEditorToolPalettePopup toolPalettePopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorToolControls(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        this.toolPalettePopup = new DungeonEditorToolPalettePopup(events, this);
        ToggleGroup toolGroup = new ToggleGroup();
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> events.toolSelected(DungeonEditorControlsView.SELECT_TOOL));
        panelView.describeNode(selectButton, "Auswahlwerkzeug aktivieren");
        panelView.describeNode(roomButton, "Raumwerkzeug waehlen");
        panelView.describeNode(wallButton, "Wandwerkzeug waehlen");
        panelView.describeNode(doorButton, "Türwerkzeug wählen");
        panelView.describeNode(corridorButton, "Korridorwerkzeug waehlen");
        panelView.describeNode(stairButton, "Treppenwerkzeug waehlen");
        panelView.describeNode(transitionButton, "Übergangswerkzeug wählen");

        roomButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.ROOM,
                DungeonEditorControlsView.ROOM_PAINT_TOOL));
        wallButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.WALL,
                DungeonEditorControlsView.WALL_CREATE_TOOL));
        doorButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.DOOR,
                DungeonEditorControlsView.DOOR_CREATE_TOOL));
        corridorButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.CORRIDOR,
                DungeonEditorControlsView.CORRIDOR_CREATE_TOOL));
        stairButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.STAIR,
                DungeonEditorControlsView.STAIR_CREATE_TOOL));
        transitionButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.TRANSITION,
                DungeonEditorControlsView.TRANSITION_CREATE_TOOL));

        row = panelView.controlsRow(selectButton, roomButton, wallButton, doorButton,
                corridorButton, stairButton, transitionButton);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-tool-row");
    }

    HBox row() {
        return row;
    }

    void showTool(String tool) {
        String selectedTool = normalizeTool(tool);
        selectButton.setSelected(DungeonEditorControlsView.SELECT_TOOL.equals(selectedTool));
        markSelected(roomButton, matchesTool(selectedTool, DungeonEditorControlsView.ROOM_PAINT_TOOL, DungeonEditorControlsView.ROOM_DELETE_TOOL));
        markSelected(wallButton, matchesTool(selectedTool, DungeonEditorControlsView.WALL_CREATE_TOOL, DungeonEditorControlsView.WALL_DELETE_TOOL));
        markSelected(doorButton, matchesTool(selectedTool, DungeonEditorControlsView.DOOR_CREATE_TOOL, DungeonEditorControlsView.DOOR_DELETE_TOOL));
        markSelected(corridorButton, matchesTool(selectedTool, DungeonEditorControlsView.CORRIDOR_CREATE_TOOL, DungeonEditorControlsView.CORRIDOR_DELETE_TOOL));
        markSelected(stairButton, matchesTool(selectedTool, DungeonEditorControlsView.STAIR_CREATE_TOOL, DungeonEditorControlsView.STAIR_DELETE_TOOL));
        markSelected(transitionButton, matchesTool(selectedTool, DungeonEditorControlsView.TRANSITION_CREATE_TOOL, DungeonEditorControlsView.TRANSITION_DELETE_TOOL));
    }

    void showToolPalette(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        toolPalettePopup.show(toolPaletteUiState);
    }

    @Nullable Button anchorFor(DungeonEditorContributionModel.ToolFamily family) {
        if (family == null) {
            return null;
        }
        return switch (family) {
            case ROOM -> roomButton;
            case WALL -> wallButton;
            case DOOR -> doorButton;
            case CORRIDOR -> corridorButton;
            case STAIR -> stairButton;
            case TRANSITION -> transitionButton;
            case NONE -> null;
        };
    }

    private static String normalizeTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? DungeonEditorControlsView.SELECT_TOOL : tool;
        return isKnownTool(selectedTool) ? selectedTool : DungeonEditorControlsView.SELECT_TOOL;
    }

    private static boolean isKnownTool(String tool) {
        return DungeonEditorControlsView.SELECT_TOOL.equals(tool)
                || DungeonEditorControlsView.ROOM_PAINT_TOOL.equals(tool)
                || DungeonEditorControlsView.ROOM_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.WALL_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.WALL_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.DOOR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.DOOR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.CORRIDOR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.CORRIDOR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.STAIR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.STAIR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.TRANSITION_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.TRANSITION_DELETE_TOOL.equals(tool);
    }

    private static boolean matchesTool(String selectedTool, String primaryLabel, String secondaryLabel) {
        return primaryLabel.equals(selectedTool) || secondaryLabel.equals(selectedTool);
    }

    private static void markSelected(Button button, boolean selected) {
        if (selected) {
            if (!DungeonEditorControlsFxAccess.hasStyle(button, STYLE_SELECTED)) {
                DungeonEditorControlsFxAccess.addStyle(button, STYLE_SELECTED);
            }
            return;
        }
        DungeonEditorControlsFxAccess.removeStyle(button, STYLE_SELECTED);
    }

    private static ToggleButton createToolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}

final class DungeonEditorToolPalettePopup {

    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final Button primaryToolOption = createToolButton("");
    private final Button secondaryToolOption = createToolButton("");
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final DungeonEditorControlsEvents events;
    private final DungeonEditorToolControls toolControls;

    DungeonEditorToolPalettePopup(DungeonEditorControlsEvents events, DungeonEditorToolControls toolControls) {
        this.events = events;
        this.toolControls = toolControls;
        HBox panel = new HBox(8, primaryToolOption, secondaryToolOption);
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        popup.setContent(panel);
        popup.addOnHidden(event -> handleHidden());
    }

    void show(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        DungeonEditorContributionModel.ToolPaletteUiState resolvedState = toolPaletteUiState == null
                ? DungeonEditorContributionModel.ToolPaletteUiState.closed()
                : toolPaletteUiState;
        primaryToolOption.setText(resolvedState.primaryToolLabel());
        secondaryToolOption.setText(resolvedState.secondaryToolLabel());
        primaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.primaryToolLabel()));
        secondaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.secondaryToolLabel()));
        if (!resolvedState.visible()) {
            hidePopup();
            return;
        }
        Button anchor = toolControls.anchorFor(resolvedState.family());
        if (anchor == null) {
            hidePopup();
            return;
        }
        if (popup.isShowing()) {
            hidePopup();
        }
        popup.showBelow(anchor);
        popup.focusAfterShown(primaryToolOption);
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            events.toolDismissed();
        }
    }

    private void hidePopup() {
        if (popup.isShowing()) {
            hiddenGate.runSuppressed(popup::hide);
        }
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}
