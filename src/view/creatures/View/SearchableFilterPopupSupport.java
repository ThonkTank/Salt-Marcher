package src.view.creatures.View;

import javafx.geometry.Insets;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.function.Consumer;

final class SearchableFilterPopupSupport {

    private SearchableFilterPopupSupport() {
    }

    // PMD suppression is local: the popup builder carries one UI-specific argument bundle by design; see src/view/creatures/UI.md.
    @SuppressWarnings("PMD.ExcessiveParameterList")
    static PopupContent buildPopupContent(
            String label,
            int searchFieldThreshold,
            List<String> options,
            List<String> selectedValues,
            List<CheckBox> checkboxes,
            Consumer<String> queryChanged,
            Runnable selectionChanged
    ) {
        VBox popupContent = new VBox(4);
        popupContent.getStyleClass().add("filter-dropdown");
        popupContent.setPadding(new Insets(8));
        TextField searchField = createSearchField(label, searchFieldThreshold, options, popupContent, queryChanged);
        popupContent.getChildren().add(createScrollPane(selectedValues, options, checkboxes, selectionChanged));
        return new PopupContent(popupContent, searchField);
    }

    static void installPopupHandlers(
            Popup popup,
            String label,
            @Nullable TextField focusTarget,
            VBox popupContent,
            Runnable refocusButton
    ) {
        popup.setOnShown(event -> javafx.application.Platform.runLater(() -> {
            if (focusTarget != null) {
                focusTarget.requestFocus();
            } else {
                popupContent.requestFocus();
            }
        }));
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> handlePopupKeyPressed(event, popup, label, refocusButton));
    }

    private static @Nullable TextField createSearchField(
            String label,
            int searchFieldThreshold,
            List<String> options,
            VBox popupContent,
            Consumer<String> queryChanged
    ) {
        if (options.size() <= searchFieldThreshold) {
            return null;
        }
        TextField searchField = new TextField();
        searchField.setPromptText(label + " suchen...");
        searchField.getStyleClass().add("quick-search-field");
        searchField.textProperty().addListener((ignored, before, after) -> queryChanged.accept(after));
        popupContent.getChildren().add(searchField);
        return searchField;
    }

    private static ScrollPane createScrollPane(
            List<String> selectedValues,
            List<String> options,
            List<CheckBox> checkboxes,
            Runnable selectionChanged
    ) {
        VBox checkboxList = new VBox(2);
        for (String option : options) {
            checkboxList.getChildren().add(createCheckbox(option, selectedValues, checkboxes, selectionChanged));
        }
        ScrollPane scrollPane = new ScrollPane(checkboxList);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setMaxHeight(280);
        scrollPane.setPrefWidth(200);
        scrollPane.setMinWidth(160);
        return scrollPane;
    }

    private static CheckBox createCheckbox(
            String option,
            List<String> selectedValues,
            List<CheckBox> checkboxes,
            Runnable selectionChanged
    ) {
        CheckBox checkbox = new CheckBox(option);
        checkbox.setSelected(selectedValues.contains(option));
        checkbox.setOnAction(event -> selectionChanged.run());
        checkboxes.add(checkbox);
        return checkbox;
    }

    private static void handlePopupKeyPressed(
            KeyEvent event,
            Popup popup,
            String label,
            Runnable refocusButton
    ) {
        if (event.getCode() == KeyCode.ESCAPE) {
            popup.hide();
            refocusButton.run();
            event.consume();
            return;
        }
        if (event.getCode() == KeyCode.TAB) {
            javafx.application.Platform.runLater(() -> {
                if (!popup.isShowing()) {
                    return;
                }
                javafx.scene.Scene popupScene = popup.getScene();
                if (popupScene == null || popupScene.getFocusOwner() == null) {
                    popup.hide();
                    refocusButton.run();
                }
            });
        }
    }

    record PopupContent(
            VBox content,
            @Nullable TextField focusTarget
    ) {
    }
}
