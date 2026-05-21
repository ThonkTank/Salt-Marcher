package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelViewInputEvent;

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

    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    @SuppressWarnings("PMD.LambdaCanBeMethodReference")
    private final DungeonEditorControlsEvents events = new DungeonEditorControlsEvents(event -> viewInputEventHandler.accept(event));
    private final DungeonEditorMapControlsView mapControls = new DungeonEditorMapControlsView(this, events);
    private final DungeonEditorProjectionControlsView projectionControls = new DungeonEditorProjectionControlsView(this, events);
    private final DungeonEditorToolControlsView toolControls = new DungeonEditorToolControlsView(this, events);

    public DungeonEditorControlsView() {
        super("");
        DungeonEditorControlsFxAccess.addStyle(this, "control-toolbar");
        super.onViewInputEvent(this::handleDungeonControlInput);
        setFillWidth(true);
        getChildren().setAll(mapControls.row(), projectionControls.row(), toolControls.row());
    }

    public void onDungeonEditorControlsInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        mapControls.bind(contentModel.mapControlsContentModel());
        projectionControls.bind(contentModel.projectionControlsContentModel());
        toolControls.bind(contentModel.toolControlsContentModel());
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

}

final class DungeonEditorControlsEvents {

    private static final DungeonEditorControlsViewInputEvent.MapSnapshot EMPTY_MAP =
            new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, null, false, false, false, false, false, false, false);
    private static final DungeonEditorControlsViewInputEvent.ToolSnapshot EMPTY_TOOL =
            new DungeonEditorControlsViewInputEvent.ToolSnapshot(null, null, false);
    private static final DungeonEditorControlsViewInputEvent.ProjectionSnapshot EMPTY_PROJECTION =
            new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(null, 0);
    private static final DungeonEditorControlsViewInputEvent.OverlaySnapshot EMPTY_OVERLAY =
            new DungeonEditorControlsViewInputEvent.OverlaySnapshot(null, 0, 0.0, null);
    private static final String TOOL_FAMILY_ROOM = "ROOM";
    private static final String TOOL_FAMILY_WALL = "WALL";
    private static final String TOOL_FAMILY_DOOR = "DOOR";
    private static final String TOOL_FAMILY_CORRIDOR = "CORRIDOR";
    private static final String TOOL_FAMILY_STAIR = "STAIR";
    private static final String TOOL_FAMILY_TRANSITION = "TRANSITION";

    private final Consumer<DungeonEditorControlsViewInputEvent> sink;

    DungeonEditorControlsEvents(Consumer<DungeonEditorControlsViewInputEvent> sink) {
        this.sink = sink;
    }

    void mapSelection(long selectedMapIdValue) {
        sink.accept(event(new DungeonEditorControlsViewInputEvent.MapSnapshot(
                selectedMapIdValue,
                null,
                false,
                false,
                false,
                false,
                false,
                false,
                false), EMPTY_TOOL, EMPTY_PROJECTION, EMPTY_OVERLAY));
    }

    void openCreateMapEditor(String draftText) {
        mapEditorInput(draftText, true, false, false, false, false, false);
    }

    void openRenameMapEditor(String draftText) {
        mapEditorInput(draftText, false, true, false, false, false, false);
    }

    void openDeleteMapEditor(String draftText) {
        mapEditorInput(draftText, false, false, true, false, false, false);
    }

    void dismissMapEditor(String draftText) {
        mapEditorInput(draftText, false, false, false, true, false, false);
    }

    void submitMapEditor(String draftText) {
        mapEditorInput(draftText, false, false, false, false, true, false);
    }

    void confirmMapDelete(String draftText) {
        mapEditorInput(draftText, false, false, false, false, false, true);
    }

    void mapEditorDraftChanged(String draftText) {
        mapEditorInput(draftText, false, false, false, false, false, false);
    }

    void viewModeSelected(String viewModeKey) {
        sink.accept(event(
                EMPTY_MAP,
                EMPTY_TOOL,
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(viewModeKey, 0),
                EMPTY_OVERLAY));
    }

    void roomToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_ROOM, primaryToolKey);
    }

    void wallToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_WALL, primaryToolKey);
    }

    void doorToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_DOOR, primaryToolKey);
    }

    void corridorToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_CORRIDOR, primaryToolKey);
    }

    void stairToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_STAIR, primaryToolKey);
    }

    void transitionToolFamilySelected(String primaryToolKey) {
        toolFamilySelected(TOOL_FAMILY_TRANSITION, primaryToolKey);
    }

    void toolSelected(@Nullable String selectedToolKey) {
        sink.accept(event(
                EMPTY_MAP,
                new DungeonEditorControlsViewInputEvent.ToolSnapshot(null, selectedToolKey, false),
                EMPTY_PROJECTION,
                EMPTY_OVERLAY));
    }

    void toolDismissed() {
        sink.accept(event(
                EMPTY_MAP,
                new DungeonEditorControlsViewInputEvent.ToolSnapshot(null, null, true),
                EMPTY_PROJECTION,
                EMPTY_OVERLAY));
    }

    void projectionShift(int projectionLevelShift) {
        sink.accept(event(
                EMPTY_MAP,
                EMPTY_TOOL,
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(null, projectionLevelShift),
                EMPTY_OVERLAY));
    }

    void overlayInput(DungeonControlPanelViewInputEvent.OverlayInput overlayInput) {
        sink.accept(event(
                EMPTY_MAP,
                EMPTY_TOOL,
                EMPTY_PROJECTION,
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot(
                        overlayInput.modeKey(),
                        overlayInput.levelRange(),
                        overlayInput.opacity(),
                        overlayInput.selectedLevelsText())));
    }

    private void mapEditorInput(
            String draftText,
            boolean openCreate,
            boolean openRename,
            boolean openDelete,
            boolean dismiss,
            boolean submit,
            boolean confirmDelete
    ) {
        sink.accept(event(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(
                        0L,
                        draftText,
                        true,
                        openCreate,
                        openRename,
                        openDelete,
                        dismiss,
                        submit,
                        confirmDelete),
                EMPTY_TOOL,
                EMPTY_PROJECTION,
                EMPTY_OVERLAY));
    }

    private void toolFamilySelected(String familyKey, String primaryToolKey) {
        sink.accept(event(
                EMPTY_MAP,
                new DungeonEditorControlsViewInputEvent.ToolSnapshot(familyKey, primaryToolKey, false),
                EMPTY_PROJECTION,
                EMPTY_OVERLAY));
    }

    private static DungeonEditorControlsViewInputEvent event(
            DungeonEditorControlsViewInputEvent.MapSnapshot map,
            DungeonEditorControlsViewInputEvent.ToolSnapshot tool,
            DungeonEditorControlsViewInputEvent.ProjectionSnapshot projection,
            DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay
    ) {
        return new DungeonEditorControlsViewInputEvent(map, tool, projection, overlay);
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
