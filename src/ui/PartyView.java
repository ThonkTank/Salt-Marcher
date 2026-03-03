package ui;

import entities.PlayerCharacter;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import repositories.PlayerCharacterRepository;

import java.util.List;

/**
 * Party management view (CRUD for player characters).
 * Replaces the previous modal PartyDialog — now a full sidebar view.
 */
public class PartyView implements AppView {

    private final VBox root;
    private final TableView<PlayerCharacter> table;
    private final ObservableList<PlayerCharacter> items = FXCollections.observableArrayList();
    private final TextField nameField;
    private final Spinner<Integer> levelSpinner;
    private Runnable onPartyChanged;

    public PartyView() {
        root = new VBox(8);
        root.setPadding(new Insets(16));
        root.setMaxWidth(500);
        root.setAlignment(Pos.TOP_CENTER);

        // Table
        table = new TableView<>(items);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(new Label("Keine Party-Mitglieder"));

        TableColumn<PlayerCharacter, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setPrefWidth(300);

        TableColumn<PlayerCharacter, Number> levelCol = new TableColumn<>("Level");
        levelCol.setCellValueFactory(cd -> new SimpleIntegerProperty(cd.getValue().Level));
        levelCol.setPrefWidth(80);

        table.getColumns().addAll(nameCol, levelCol);
        VBox.setVgrow(table, Priority.ALWAYS);

        // Add form
        GridPane form = new GridPane();
        form.setHgap(8);
        form.setVgap(8);

        Label nameLbl = new Label("Name:");
        nameField = new TextField();
        nameField.setPrefWidth(200);
        Label levelLbl = new Label("Level:");
        levelSpinner = new Spinner<>(1, 20, 1);
        levelSpinner.setEditable(true);
        levelSpinner.setPrefWidth(80);

        Button addButton = new Button("Hinzufuegen");
        addButton.getStyleClass().add("accent");
        addButton.disableProperty().bind(nameField.textProperty().isEmpty());
        Button removeButton = new Button("Entfernen");
        removeButton.disableProperty().bind(table.getSelectionModel().selectedItemProperty().isNull());

        form.add(nameLbl, 0, 0);
        form.add(nameField, 1, 0);
        form.add(levelLbl, 2, 0);
        form.add(levelSpinner, 3, 0);
        form.add(addButton, 0, 1, 2, 1);
        form.add(removeButton, 2, 1, 2, 1);

        root.getChildren().addAll(table, form);

        addButton.setOnAction(e -> onAdd());
        nameField.setOnAction(e -> onAdd());
        removeButton.setOnAction(e -> onRemove());
    }

    public void setOnPartyChanged(Runnable callback) { this.onPartyChanged = callback; }

    // ---- AppView ----

    @Override public Node getRoot() { return root; }
    @Override public String getTitle() { return "Party"; }
    @Override public String getIconText() { return "\u265F"; }

    @Override
    public void onShow() {
        reloadTable();
        nameField.requestFocus();
    }

    // ---- Internal ----

    private void onAdd() {
        String name = nameField.getText().trim();
        if (name.isEmpty()) return;
        int level = levelSpinner.getValue();
        nameField.setText("");
        levelSpinner.getValueFactory().setValue(1);
        nameField.requestFocus();
        Task<List<PlayerCharacter>> task = new Task<>() {
            @Override protected List<PlayerCharacter> call() {
                PlayerCharacterRepository.createCharacter(name, level);
                return PlayerCharacterRepository.getAllCharacters();
            }
        };
        task.setOnSucceeded(e -> {
            items.setAll(task.getValue());
            if (onPartyChanged != null) onPartyChanged.run();
        });
        task.setOnFailed(e ->
                System.err.println("Charakter erstellen fehlgeschlagen: " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-party-add");
        t.setDaemon(true);
        t.start();
    }

    private void onRemove() {
        PlayerCharacter selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) return;
        new Alert(Alert.AlertType.CONFIRMATION,
                "Charakter '" + selected.Name + "' entfernen?",
                ButtonType.YES, ButtonType.NO)
                .showAndWait().ifPresent(bt -> {
                    if (bt == ButtonType.YES) {
                        long id = selected.Id;
                        Task<List<PlayerCharacter>> task = new Task<>() {
                            @Override protected List<PlayerCharacter> call() {
                                PlayerCharacterRepository.deleteCharacter(id);
                                return PlayerCharacterRepository.getAllCharacters();
                            }
                        };
                        task.setOnSucceeded(e -> {
                            items.setAll(task.getValue());
                            if (onPartyChanged != null) onPartyChanged.run();
                        });
                        task.setOnFailed(e ->
                                System.err.println("Charakter entfernen fehlgeschlagen: " + task.getException().getMessage()));
                        Thread t = new Thread(task, "sm-party-remove");
                        t.setDaemon(true);
                        t.start();
                    }
                });
    }

    private void reloadTable() {
        Task<List<PlayerCharacter>> task = new Task<>() {
            @Override protected List<PlayerCharacter> call() {
                return PlayerCharacterRepository.getAllCharacters();
            }
        };
        task.setOnSucceeded(e -> items.setAll(task.getValue()));
        task.setOnFailed(e ->
                System.err.println("Party laden fehlgeschlagen: " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-party-load");
        t.setDaemon(true);
        t.start();
    }
}
