package ui.components;

import entities.Creature;
import javafx.animation.PauseTransition;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.stage.Popup;
import javafx.concurrent.Task;
import javafx.util.Duration;
import repositories.CreatureRepository;

import java.util.List;
import java.util.function.Consumer;

/**
 * Compact creature search field with typeahead dropdown for quick combat additions.
 */
public class QuickSearchBar extends HBox {

    private final TextField searchField;
    private final ListView<Creature> resultList;
    private final Popup popup;
    private Consumer<Creature> onCreatureSelected;
    private Task<?> currentTask;

    public QuickSearchBar() {
        setAlignment(Pos.CENTER_LEFT);
        setSpacing(4);

        searchField = new TextField();
        searchField.setPromptText("+Monster hinzufuegen...");
        searchField.getStyleClass().add("quick-search-field");
        searchField.setPrefWidth(200);
        searchField.setMaxWidth(240);

        resultList = new ListView<>();
        resultList.setPrefHeight(240);
        resultList.setPrefWidth(300);
        resultList.getStyleClass().add("quick-search-list");
        resultList.setCellFactory(lv -> new ListCell<>() {
            private final HBox row = new HBox(8);
            private final Label name = new Label();
            private final Label cr = new Label();
            private final Label xp = new Label();
            {
                row.setAlignment(Pos.CENTER_LEFT);
                name.getStyleClass().add("bold");
                cr.getStyleClass().add("text-secondary");
                xp.getStyleClass().add("text-muted");
                row.getChildren().addAll(name, cr, xp);
            }
            @Override
            protected void updateItem(Creature c, boolean empty) {
                super.updateItem(c, empty);
                if (empty || c == null) {
                    setGraphic(null);
                    return;
                }
                name.setText(c.Name);
                cr.setText("CR " + c.CR);
                xp.setText(c.XP + " XP");
                setGraphic(row);
            }
        });

        popup = new Popup();
        popup.setAutoHide(true);
        popup.getContent().add(resultList);

        // Debounced search
        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(e -> search(searchField.getText().trim()));
        searchField.textProperty().addListener((obs, o, n) -> debounce.playFromStart());

        // Keyboard navigation
        searchField.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.DOWN && popup.isShowing()) {
                resultList.requestFocus();
                if (resultList.getSelectionModel().getSelectedIndex() < 0) {
                    resultList.getSelectionModel().selectFirst();
                }
                e.consume();
            } else if (e.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                e.consume();
            } else if (e.getCode() == KeyCode.ENTER && popup.isShowing()) {
                selectCurrent();
                e.consume();
            }
        });

        resultList.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                selectCurrent();
                e.consume();
            } else if (e.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                searchField.requestFocus();
                e.consume();
            }
        });

        resultList.setOnMouseClicked(e -> {
            if (e.getClickCount() == 1) selectCurrent();
        });

        getChildren().add(searchField);
        HBox.setHgrow(searchField, Priority.NEVER);
    }

    public void setOnCreatureSelected(Consumer<Creature> callback) {
        this.onCreatureSelected = callback;
    }

    public void focus() {
        searchField.requestFocus();
    }

    private void search(String query) {
        if (query.length() < 2) {
            popup.hide();
            return;
        }
        if (currentTask != null && currentTask.isRunning()) currentTask.cancel();

        Task<List<Creature>> task = new Task<>() {
            @Override
            protected List<Creature> call() {
                return CreatureRepository.searchByName(query, 8, false);
            }
        };
        task.setOnSucceeded(e -> {
            List<Creature> results = task.getValue();
            if (results == null || results.isEmpty()) {
                popup.hide();
                return;
            }
            resultList.getItems().setAll(results);
            resultList.getSelectionModel().selectFirst();
            if (!popup.isShowing()) {
                Bounds bounds = searchField.localToScreen(searchField.getBoundsInLocal());
                if (bounds != null) {
                    popup.show(searchField, bounds.getMinX(), bounds.getMaxY());
                }
            }
        });
        task.setOnFailed(e ->
                System.err.println("Quick-Search fehlgeschlagen: " + task.getException().getMessage()));
        currentTask = task;
        Thread t = new Thread(task, "sm-quick-search");
        t.setDaemon(true);
        t.start();
    }

    private void selectCurrent() {
        Creature selected = resultList.getSelectionModel().getSelectedItem();
        if (selected != null && onCreatureSelected != null) {
            onCreatureSelected.accept(selected);
            searchField.clear();
            popup.hide();
            searchField.requestFocus();
        }
    }
}
