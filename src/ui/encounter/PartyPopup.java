package ui.encounter;

import entities.PlayerCharacter;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.transformation.FilteredList;
import javafx.concurrent.Task;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Control;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Separator;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.application.Platform;
import javafx.stage.Popup;
import services.PartyService;

import java.util.List;

/** Toolbar party management controller (popup-backed, not a Node). Use {@link #getTriggerButton()} to get the toolbar entry point. */
public class PartyPopup {

    private final Button triggerButton;
    private final Popup popup;

    private final VBox memberList = new VBox();
    private final ListView<PlayerCharacter> suggestionList = new ListView<>();
    private final TextField searchField = new TextField();
    private final Label summaryLabel = new Label();

    private final ObservableList<PlayerCharacter> available = FXCollections.observableArrayList();
    private final FilteredList<PlayerCharacter> filtered = new FilteredList<>(available);

    private Runnable onPartyChanged;

    public PartyPopup() {
        triggerButton = new Button("Keine _Party \u25BE");
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setTooltip(new javafx.scene.control.Tooltip("Party-Panel \u00f6ffnen (Alt+P)"));

        popup = new Popup();
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);

        VBox panel = buildPanel();
        panel.getStyleClass().add("party-panel");
        popup.getContent().add(panel);

        triggerButton.setOnAction(e -> togglePopup());
        popup.setOnShowing(e -> triggerButton.setAccessibleText("Party-Panel geöffnet – Escape zum Schließen"));
        popup.setOnHiding(e -> triggerButton.setAccessibleText(triggerButton.getText().replace("_", "")));
        popup.setOnHidden(e -> triggerButton.requestFocus());
    }

    public Button getTriggerButton() { return triggerButton; }

    public void setOnPartyChanged(Runnable callback) { this.onPartyChanged = callback; }

    // ---- Panel construction ----

    private VBox buildPanel() {
        // Header
        Label headerLabel = new Label("PARTY");
        headerLabel.getStyleClass().addAll("large");
        Button closeBtn = new Button("\u00D7");
        closeBtn.getStyleClass().add("party-btn");
        closeBtn.setAccessibleText("Party-Panel schliessen");
        closeBtn.setOnAction(e -> popup.hide());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(6, headerLabel, spacer, closeBtn);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        // Member list section
        Label partyLabel = new Label("AKTUELLE PARTY");
        partyLabel.getStyleClass().add("party-section-label");
        memberList.getStyleClass().add("party-list");

        // Search section
        Label searchLabel = new Label("CHARAKTER HINZUF\u00DCGEN");
        searchLabel.getStyleClass().add("party-section-label");

        searchField.setPromptText("Suche\u2026");
        searchField.textProperty().addListener((obs, old, nv) -> {
            String lower = nv.trim().toLowerCase();
            filtered.setPredicate(lower.isEmpty() ? p -> true
                    : pc -> pc.Name.toLowerCase().contains(lower));
            suggestionList.setVisible(!filtered.isEmpty());
            suggestionList.setManaged(!filtered.isEmpty());
        });
        searchField.focusedProperty().addListener((obs, old, focused) -> {
            if (focused && !filtered.isEmpty()) {
                suggestionList.setVisible(true);
                suggestionList.setManaged(true);
            }
        });

        suggestionList.setItems(filtered);
        suggestionList.getStyleClass().add("party-suggestions");
        suggestionList.setPrefHeight(Control.USE_COMPUTED_SIZE);
        suggestionList.setMaxHeight(120);
        suggestionList.setVisible(false);
        suggestionList.setManaged(false);
        suggestionList.setCellFactory(lv -> new ListCell<>() {
            @Override
            protected void updateItem(PlayerCharacter pc, boolean empty) {
                super.updateItem(pc, empty);
                setText(empty || pc == null ? null : pc.Name + "  (Lv " + pc.Level + ")");
            }
        });
        suggestionList.setOnMouseClicked(e -> {
            PlayerCharacter sel = suggestionList.getSelectionModel().getSelectedItem();
            if (sel != null) addExisting(sel);
        });
        suggestionList.setOnKeyPressed(e -> {
            if (e.getCode() == javafx.scene.input.KeyCode.ENTER) {
                PlayerCharacter sel = suggestionList.getSelectionModel().getSelectedItem();
                if (sel != null) addExisting(sel);
            }
        });
        searchField.setOnAction(e -> {
            if (!filtered.isEmpty()) addExisting(filtered.get(0));
        });

        VBox searchBox = new VBox(4, searchField, suggestionList);
        searchBox.getStyleClass().add("party-search");

        Button newCharBtn = new Button("+ _Neuer Charakter");
        newCharBtn.setMaxWidth(Double.MAX_VALUE);
        newCharBtn.setOnAction(e -> onNewCharacter());
        VBox newCharBox = new VBox(newCharBtn);
        newCharBox.getStyleClass().add("party-search");

        // Stats footer
        summaryLabel.getStyleClass().add("party-summary");
        summaryLabel.setMaxWidth(Double.MAX_VALUE);

        VBox panel = new VBox(
                header,
                partyLabel,
                memberList,
                new Separator(),
                searchLabel,
                searchBox,
                newCharBox,
                summaryLabel
        );
        panel.setFillWidth(true);
        return panel;
    }

    // ---- Toggle popup ----

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        // Show loading placeholder while data loads
        memberList.getChildren().clear();
        Label loadingLabel = new Label("Lade...");
        loadingLabel.getStyleClass().add("text-muted");
        memberList.getChildren().add(loadingLabel);
        loadData();
        triggerButton.applyCss();
        triggerButton.layout();
        Bounds screenBounds = triggerButton.localToScreen(triggerButton.getBoundsInLocal());
        if (screenBounds != null) {
            popup.show(triggerButton.getScene().getWindow(),
                    screenBounds.getMaxX() - 320,
                    screenBounds.getMaxY() + 2);
        }
    }

    // ---- Data loading ----

    private void loadData() {
        Task<LoadResult> task = new Task<>() {
            @Override
            protected LoadResult call() {
                return new LoadResult(
                        PartyService.getActiveParty(),
                        PartyService.getAvailableCharacters());
            }
        };
        task.setOnSucceeded(e -> applyData(task.getValue()));
        task.setOnFailed(e ->
                System.err.println("PartyPopup.loadData(): " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-party-panel-load");
        t.setDaemon(true);
        t.start();
    }

    private void applyData(LoadResult result) {
        // Update member list
        memberList.getChildren().clear();
        for (PlayerCharacter pc : result.members) {
            memberList.getChildren().add(buildMemberRow(pc));
        }

        // Update search suggestions
        available.setAll(result.available);
        searchField.clear();
        suggestionList.setVisible(false);
        suggestionList.setManaged(false);

        // Update toolbar button and footer
        updateSummary(result.members);
    }

    private HBox buildMemberRow(PlayerCharacter pc) {
        Label nameLabel = new Label(pc.Name + "  Lv " + pc.Level);
        nameLabel.getStyleClass().add("text-secondary");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Button removeBtn = new Button("Entfernen");
        removeBtn.getStyleClass().addAll("party-btn", "remove");
        removeBtn.setTooltip(new Tooltip("Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)"));
        removeBtn.setOnAction(e -> onRemoveFromParty(pc));

        Button deleteBtn = new Button("L\u00f6schen");
        deleteBtn.getStyleClass().addAll("party-btn", "delete");
        deleteBtn.setTooltip(new Tooltip("Dauerhaft l\u00f6schen\n(Kann nicht r\u00fcckg\u00e4ngig gemacht werden)"));
        deleteBtn.setOnAction(e -> onDeleteCharacter(pc));

        HBox row = new HBox(8, nameLabel, spacer, removeBtn, deleteBtn);
        row.getStyleClass().add("party-row");
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private void updateSummary(List<PlayerCharacter> members) {
        if (members.isEmpty()) {
            triggerButton.setText("Keine _Party \u25BE");
            summaryLabel.setText("Keine Party-Mitglieder");
        } else {
            int size = members.size();
            double avgLevelExact = members.stream().mapToInt(pc -> pc.Level).average().orElse(1.0);
            int avgLvl = PartyService.averageLevel(members);
            triggerButton.setText("_Party: " + size + " Chars, \u00D8 Lv " + avgLvl + " \u25BE");
            summaryLabel.setText("\u00D8 Lv: " + String.format("%.1f", avgLevelExact));
        }
    }

    // ---- Actions ----

    /**
     * Runs {@code mutation} (a DB write) and a full party reload as a single background Task,
     * then applies the result on the FX thread and fires {@link #onPartyChanged}.
     * Mutation and reload run atomically from the UI's perspective — no partial state is visible.
     */
    private void mutateAndReload(Runnable mutation, String threadName) {
        Task<LoadResult> task = new Task<>() {
            @Override protected LoadResult call() {
                mutation.run();
                return new LoadResult(
                        PartyService.getActiveParty(),
                        PartyService.getAvailableCharacters());
            }
        };
        task.setOnSucceeded(e -> {
            applyData(task.getValue());
            if (onPartyChanged != null) onPartyChanged.run();
        });
        task.setOnFailed(e ->
                System.err.println("PartyPopup.mutateAndReload(" + threadName + "): " + task.getException().getMessage()));
        Thread t = new Thread(task, threadName);
        t.setDaemon(true);
        t.start();
    }

    private void addExisting(PlayerCharacter pc) {
        mutateAndReload(() -> PartyService.addToParty(pc.Id), "sm-party-add");
    }

    private void onRemoveFromParty(PlayerCharacter pc) {
        mutateAndReload(() -> PartyService.removeFromParty(pc.Id), "sm-party-remove");
    }

    private void onDeleteCharacter(PlayerCharacter pc) {
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "\"" + pc.Name + "\" wirklich dauerhaft l\u00f6schen?\nDieser Schritt kann nicht r\u00fcckg\u00e4ngig gemacht werden.",
                ButtonType.CANCEL, ButtonType.OK);
        confirm.setHeaderText("Charakter l\u00f6schen");
        // Make Cancel the default to prevent accidental deletion via Enter key
        Button cancelBt = (Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL);
        cancelBt.setDefaultButton(true);
        Button okBt = (Button) confirm.getDialogPane().lookupButton(ButtonType.OK);
        okBt.setDefaultButton(false);
        confirm.showAndWait().ifPresent(bt -> {
            if (bt != ButtonType.OK) return;
            mutateAndReload(() -> PartyService.deleteCharacter(pc.Id), "sm-party-delete");
        });
    }

    private void onNewCharacter() {
        Dialog<ButtonType> dlg = new Dialog<>();
        dlg.setTitle("Neuer Charakter");
        dlg.setHeaderText("Charakter erstellen und zur Party hinzuf\u00fcgen");
        dlg.getDialogPane().getButtonTypes().addAll(ButtonType.OK, ButtonType.CANCEL);

        TextField nameField = new TextField();
        nameField.setPromptText("Name");
        // No setAccessibleText — setLabelFor below is sufficient and more correct (WCAG 1.3.1)
        Spinner<Integer> levelSpinner = new Spinner<>(1, 20, 1);
        levelSpinner.setEditable(true);
        levelSpinner.setPrefWidth(80);

        Label nameGridLabel = new Label("Name:");
        nameGridLabel.setLabelFor(nameField);
        Label levelGridLabel = new Label("Level:");
        levelGridLabel.setLabelFor(levelSpinner);
        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(8);
        grid.add(nameGridLabel, 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(levelGridLabel, 0, 1);
        grid.add(levelSpinner, 1, 1);
        dlg.getDialogPane().setContent(grid);

        // Disable OK when name is empty
        javafx.scene.Node okButton = dlg.getDialogPane().lookupButton(ButtonType.OK);
        okButton.setDisable(true);
        nameField.textProperty().addListener((obs, o, n) -> okButton.setDisable(n.trim().isEmpty()));

        Platform.runLater(nameField::requestFocus);

        dlg.showAndWait().ifPresent(bt -> {
            if (bt != ButtonType.OK) return;
            String name = nameField.getText().trim();
            if (name.isEmpty()) return;
            int level = levelSpinner.getValue();
            mutateAndReload(() -> {
                var created = PartyService.createCharacter(name, level);
                if (created.isEmpty()) {
                    System.err.println("PartyPopup.onNewCharacter(): createCharacter returned empty for name='" + name + "', level=" + level);
                }
                created.ifPresent(pc -> PartyService.addToParty(pc.Id));
            }, "sm-party-new");
        });
    }

    // ---- Data holder ----

    private record LoadResult(List<PlayerCharacter> members, List<PlayerCharacter> available) {}
}
