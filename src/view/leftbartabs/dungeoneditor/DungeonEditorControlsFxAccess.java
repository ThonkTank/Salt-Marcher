package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import org.jspecify.annotations.Nullable;

final class DungeonEditorControlsFxAccess {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";

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
