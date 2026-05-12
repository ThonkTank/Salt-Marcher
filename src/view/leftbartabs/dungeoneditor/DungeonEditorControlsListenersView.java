package src.view.leftbartabs.dungeoneditor;

import javafx.beans.value.ChangeListener;
import javafx.scene.control.ComboBox;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleGroup;

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
