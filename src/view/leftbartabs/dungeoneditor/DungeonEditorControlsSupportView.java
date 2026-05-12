package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleGroup;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelViewInputEvent;

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
