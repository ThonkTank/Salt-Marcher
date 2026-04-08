package features.world.dungeon.shell.editor.state;

import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.components.AnchoredDropdown;

import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonMapEditorDropdown {

    public record EditRequest(Long mapId, String name) {}

    private final VBox panel = new VBox(10);
    private final AnchoredDropdown dropdown = new AnchoredDropdown(panel);
    private final Label titleLabel = new Label();
    private final TextField nameField = new TextField();
    private final Label errorLabel = new Label();
    private final Label deleteLabel = new Label("Dungeon löschen?");
    private final Button cancelDeleteButton = new Button("Abbrechen");
    private final Button confirmDeleteButton = new Button("Löschen");
    private final HBox deleteConfirmRow;
    private final Button cancelButton = new Button("Abbrechen");
    private final Button deleteButton = new Button("Dungeon löschen");
    private final Button submitButton = new Button("Speichern");
    private final HBox actionRow;
    private Consumer<String> onCreate = name -> { };
    private Consumer<EditRequest> onSave = request -> { };
    private Runnable onDelete = () -> { };
    private Long editingMapId;
    private boolean createMode;
    private boolean busy;

    public DungeonMapEditorDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        panel.setPadding(new Insets(10));

        titleLabel.getStyleClass().add("dropdown-title");
        errorLabel.getStyleClass().add("text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setManaged(false);
        errorLabel.setVisible(false);

        deleteLabel.getStyleClass().add("text-warning");
        Region deleteSpacer = new Region();
        HBox.setHgrow(deleteSpacer, Priority.ALWAYS);
        deleteConfirmRow = new HBox(8, deleteLabel, deleteSpacer, cancelDeleteButton, confirmDeleteButton);
        deleteConfirmRow.getStyleClass().add("dropdown-actions");
        deleteConfirmRow.setManaged(false);
        deleteConfirmRow.setVisible(false);

        Region actionSpacer = new Region();
        HBox.setHgrow(actionSpacer, Priority.ALWAYS);
        actionRow = new HBox(8, cancelButton, deleteButton, actionSpacer, submitButton);
        actionRow.getStyleClass().add("dropdown-actions");

        panel.getChildren().addAll(titleLabel, nameField, errorLabel, deleteConfirmRow, actionRow);

        cancelButton.setOnAction(event -> dropdown.hide());
        deleteButton.setOnAction(event -> showDeleteConfirmation(true));
        cancelDeleteButton.setOnAction(event -> showDeleteConfirmation(false));
        confirmDeleteButton.setOnAction(event -> onDelete.run());
        submitButton.setOnAction(event -> submit());
        nameField.setOnAction(event -> submit());
        dropdown.setOnHidden(this::resetTransientState);
    }

    public void showCreate(Node anchor, Consumer<String> onCreate) {
        createMode = true;
        editingMapId = null;
        this.onCreate = onCreate == null ? name -> { } : onCreate;
        this.onSave = request -> { };
        this.onDelete = () -> { };
        titleLabel.setText("Neuen Dungeon anlegen");
        nameField.setText("Dungeon");
        submitButton.setText("Erstellen");
        deleteButton.setManaged(false);
        deleteButton.setVisible(false);
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void showEdit(Node anchor, DungeonMapCatalogEntry map, Consumer<EditRequest> onSave, Runnable onDelete) {
        Objects.requireNonNull(map, "map");
        createMode = false;
        editingMapId = map.mapId();
        this.onCreate = name -> { };
        this.onSave = onSave == null ? request -> { } : onSave;
        this.onDelete = onDelete == null ? () -> { } : onDelete;
        titleLabel.setText("Dungeon bearbeiten");
        nameField.setText(map.name() == null ? "" : map.name());
        submitButton.setText("Speichern");
        deleteButton.setManaged(true);
        deleteButton.setVisible(true);
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void showError(String message) {
        setBusy(false);
        errorLabel.setText(message == null ? "" : message);
        errorLabel.setManaged(true);
        errorLabel.setVisible(true);
    }

    public void setBusy(boolean busy) {
        this.busy = busy;
        nameField.setDisable(busy);
        cancelButton.setDisable(busy);
        deleteButton.setDisable(busy);
        cancelDeleteButton.setDisable(busy);
        confirmDeleteButton.setDisable(busy);
        submitButton.setDisable(busy);
    }

    public void hide() {
        dropdown.hide();
    }

    private void submit() {
        if (busy) {
            return;
        }
        String name = nameField.getText() == null ? "" : nameField.getText().strip();
        if (name.isBlank()) {
            dropdown.requestFocus(nameField);
            return;
        }
        if (createMode) {
            onCreate.accept(name);
            return;
        }
        if (editingMapId != null) {
            onSave.accept(new EditRequest(editingMapId, name));
        }
    }

    private void showDeleteConfirmation(boolean visible) {
        if (busy) {
            return;
        }
        deleteConfirmRow.setManaged(visible);
        deleteConfirmRow.setVisible(visible);
        deleteButton.setManaged(!visible && !createMode);
        deleteButton.setVisible(!visible && !createMode);
        if (visible) {
            dropdown.requestFocus(confirmDeleteButton);
        } else {
            dropdown.requestFocus(deleteButton);
        }
    }

    private void resetTransientState() {
        setBusy(false);
        errorLabel.setText("");
        errorLabel.setManaged(false);
        errorLabel.setVisible(false);
        showDeleteConfirmation(false);
    }
}
