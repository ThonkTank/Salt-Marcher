package ui;

import entities.PlayerCharacter;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.stage.Window;
import repositories.PlayerCharacterRepository;

import java.util.List;

public class PartyDialog extends Stage {

    private final TableView<PlayerCharacter> table;
    private final ObservableList<PlayerCharacter> items = FXCollections.observableArrayList();
    private final TextField nameField;
    private final Spinner<Integer> levelSpinner;
    private final Runnable onPartyChanged;

    public PartyDialog(Window owner, Runnable onPartyChanged) {
        this.onPartyChanged = onPartyChanged;
        initOwner(owner);
        initModality(Modality.APPLICATION_MODAL);
        setTitle("Party verwalten");

        VBox content = new VBox(8);
        content.setPadding(new Insets(12));

        Label title = new Label("Party-Mitglieder");
        title.getStyleClass().add("title");

        // Table
        table = new TableView<>(items);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(new Label("Keine Party-Mitglieder"));

        TableColumn<PlayerCharacter, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setPrefWidth(200);

        TableColumn<PlayerCharacter, Number> levelCol = new TableColumn<>("Level");
        levelCol.setCellValueFactory(cd -> new SimpleIntegerProperty(cd.getValue().Level));
        levelCol.setPrefWidth(60);

        table.getColumns().addAll(nameCol, levelCol);
        VBox.setVgrow(table, Priority.ALWAYS);

        // Add form
        GridPane form = new GridPane();
        form.setHgap(4);
        form.setVgap(4);

        Label nameLbl = new Label("Name:");
        nameField = new TextField();
        nameField.setPrefWidth(160);
        Label levelLbl = new Label("Level:");
        levelSpinner = new Spinner<>(1, 20, 1);
        levelSpinner.setEditable(true);
        levelSpinner.setPrefWidth(70);

        Button addButton = new Button("Hinzufuegen");
        addButton.getStyleClass().add("accent");
        Button removeButton = new Button("Entfernen");

        form.add(nameLbl, 0, 0);
        form.add(nameField, 1, 0);
        form.add(levelLbl, 2, 0);
        form.add(levelSpinner, 3, 0);
        form.add(addButton, 0, 1, 2, 1);
        form.add(removeButton, 2, 1, 2, 1);

        content.getChildren().addAll(title, table, form);

        Scene scene = new Scene(content, 400, 350);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());
        setScene(scene);

        addButton.setOnAction(e -> onAdd());
        nameField.setOnAction(e -> onAdd());
        removeButton.setOnAction(e -> onRemove());

        reloadTable();
    }

    private void onAdd() {
        String name = nameField.getText().trim();
        if (name.isEmpty()) return;
        int level = levelSpinner.getValue();
        PlayerCharacter created = PlayerCharacterRepository.createCharacter(name, level);
        if (created == null) return;
        nameField.setText("");
        levelSpinner.getValueFactory().setValue(1);
        nameField.requestFocus();
        reloadTable();
        if (onPartyChanged != null) onPartyChanged.run();
    }

    private void onRemove() {
        PlayerCharacter selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) return;
        PlayerCharacterRepository.deleteCharacter(selected.Id);
        reloadTable();
        if (onPartyChanged != null) onPartyChanged.run();
    }

    private void reloadTable() {
        List<PlayerCharacter> chars = PlayerCharacterRepository.getAllCharacters();
        items.setAll(chars);
    }
}
