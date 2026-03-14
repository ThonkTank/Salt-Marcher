package features.party.ui;

import features.party.model.PlayerCharacter;
import features.party.service.PartyService;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.transformation.FilteredList;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

import java.util.List;

/** Steuerung fuer das Party-Panel in der Toolbar (Popup-basiert, kein Node). */
public class PartyPopup {

    private final Button triggerButton;
    private final Popup popup;

    private final VBox memberList = new VBox();
    private final ListView<PlayerCharacter> suggestionList = new ListView<>();
    private final TextField searchField = new TextField();
    private final Label summaryLabel = new Label();
    private final PartyCharacterEditorDropdown characterEditorDropdown = new PartyCharacterEditorDropdown();

    private final ObservableList<PlayerCharacter> available = FXCollections.observableArrayList();
    private final FilteredList<PlayerCharacter> filtered = new FilteredList<>(available);
    private final PartyPopupController controller;

    public PartyPopup(PartyPopupController controller) {
        this.controller = controller;
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
        popup.setOnHiding(e -> {
            triggerButton.setAccessibleText(triggerButton.getText().replace("_", ""));
            characterEditorDropdown.hide();
        });
        popup.setOnHidden(e -> triggerButton.requestFocus());
    }

    public Button getTriggerButton() { return triggerButton; }

    // ---- Panel-Aufbau ----

    private VBox buildPanel() {
        // Kopfbereich
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

        // Mitgliederliste
        Label partyLabel = new Label("AKTUELLE PARTY");
        partyLabel.getStyleClass().add("party-section-label");
        memberList.getStyleClass().add("party-list");

        // Suchbereich
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
        newCharBtn.setOnAction(e -> onNewCharacter(newCharBtn));
        VBox newCharBox = new VBox(newCharBtn);
        newCharBox.getStyleClass().add("party-search");

        // Statistik-Fusszeile
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

    // ---- Popup umschalten ----

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        // Ladeplatzhalter anzeigen, waehrend Daten geladen werden
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

    // ---- Daten laden ----

    private void loadData() {
        controller.loadPartySnapshot(result -> {
            if (result.status() != PartyService.ReadStatus.SUCCESS) {
                applyData(emptySnapshot());
                showStorageError("Party konnte nicht geladen werden.");
                return;
            }
            applyData(result);
        });
    }

    private void applyData(PartyService.PartySnapshotResult result) {
        // Mitgliederliste aktualisieren
        memberList.getChildren().clear();
        for (PlayerCharacter pc : result.members()) {
            memberList.getChildren().add(buildMemberRow(pc));
        }

        // Suchvorschlaege aktualisieren
        available.setAll(result.available());
        searchField.clear();
        suggestionList.setVisible(false);
        suggestionList.setManaged(false);

        // Toolbar-Button und Fusszeile aktualisieren
        updateSummary(result.members());
    }

    private HBox buildMemberRow(PlayerCharacter pc) {
        Label nameLabel = new Label(pc.Name + "  Lv " + pc.Level);
        nameLabel.getStyleClass().add("text-secondary");
        Label detailLabel = new Label(buildMemberDetails(pc));
        detailLabel.getStyleClass().add("text-muted");
        VBox infoBox = new VBox(2, nameLabel, detailLabel);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Button removeBtn = new Button("Entfernen");
        removeBtn.getStyleClass().addAll("party-btn", "remove");
        removeBtn.setTooltip(new Tooltip("Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)"));
        removeBtn.setOnAction(e -> onRemoveFromParty(pc));

        Button editBtn = new Button("Bearbeiten");
        editBtn.getStyleClass().addAll("party-btn", "edit");
        editBtn.setTooltip(new Tooltip("Charakter bearbeiten"));
        editBtn.setOnAction(e -> onEditCharacter(editBtn, pc));

        HBox row = new HBox(8, infoBox, spacer, removeBtn, editBtn);
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
            triggerButton.setText("_Party: " + size + " Charaktere, \u00D8 Lv " + avgLvl + " \u25BE");
            summaryLabel.setText("\u00D8 Lv: " + String.format("%.1f", avgLevelExact));
        }
    }

    // ---- Aktionen ----

    private void addExisting(PlayerCharacter pc) {
        controller.mutateAndReload(
                () -> PartyService.addToParty(pc.Id),
                "PartyPopup.addExisting(id=" + pc.Id + ")",
                result -> handleMutationAndReloadResult(result, "Charakter konnte nicht zur Party hinzugefügt werden."));
    }

    private void onRemoveFromParty(PlayerCharacter pc) {
        controller.mutateAndReload(
                () -> PartyService.removeFromParty(pc.Id),
                "PartyPopup.onRemoveFromParty(id=" + pc.Id + ")",
                result -> handleMutationAndReloadResult(result, "Charakter konnte nicht aus der Party entfernt werden."));
    }

    private void onEditCharacter(Button anchor, PlayerCharacter pc) {
        characterEditorDropdown.showEdit(
                anchor,
                pc,
                draft -> controller.mutateAndReload(
                        () -> PartyService.updateCharacter(pc.Id, draft),
                        "PartyPopup.onEditCharacter(id=" + pc.Id + ")",
                        result -> handleEditorMutationAndReloadResult(
                                result,
                                "Charakter konnte nicht gespeichert werden.")),
                () -> controller.mutateAndReload(
                        () -> PartyService.deleteCharacter(pc.Id),
                        "PartyPopup.onDeleteCharacter(id=" + pc.Id + ")",
                        result -> handleEditorMutationAndReloadResult(
                                result,
                                "Charakter konnte nicht gelöscht werden.")));
    }

    private void onNewCharacter(Button anchor) {
        characterEditorDropdown.showCreate(
                anchor,
                draft -> controller.createAndAddCharacterAndReload(
                        draft,
                        result -> handleEditorMutationAndReloadResult(
                                result,
                                "Charakter konnte nicht erstellt werden.")));
    }

    private void handleEditorMutationAndReloadResult(
            PartyWorkflowApplicationService.MutationAndReloadResult result,
            String storageErrorMessage
    ) {
        if (result.mutationStatus() == PartyService.MutationStatus.NOT_FOUND) {
            characterEditorDropdown.showError("Charakter wurde nicht gefunden.");
            return;
        }
        if (result.mutationStatus() != PartyService.MutationStatus.SUCCESS) {
            characterEditorDropdown.showError(storageErrorMessage);
            return;
        }
        PartyService.PartySnapshotResult snapshot = result.snapshotResult();
        if (snapshot == null || snapshot.status() != PartyService.ReadStatus.SUCCESS) {
            applyData(emptySnapshot());
            characterEditorDropdown.showError("Party konnte nach der Änderung nicht neu geladen werden.");
            return;
        }
        characterEditorDropdown.hide();
        applyData(snapshot);
    }

    private static String buildMemberDetails(PlayerCharacter pc) {
        String playerName = pc.PlayerName == null || pc.PlayerName.isBlank()
                ? null
                : pc.PlayerName.trim();
        String prefix = playerName == null ? "" : playerName + "  ·  ";
        return prefix + "AC " + pc.ArmorClass + "  ·  PP " + pc.PassivePerception;
    }

    private void handleMutationAndReloadResult(
            PartyWorkflowApplicationService.MutationAndReloadResult result,
            String storageErrorMessage
    ) {
        if (result.mutationStatus() == PartyService.MutationStatus.NOT_FOUND) {
            showStorageError("Charakter wurde nicht gefunden.");
            return;
        }
        if (result.mutationStatus() != PartyService.MutationStatus.SUCCESS) {
            showStorageError(storageErrorMessage);
            return;
        }
        PartyService.PartySnapshotResult snapshot = result.snapshotResult();
        if (snapshot == null || snapshot.status() != PartyService.ReadStatus.SUCCESS) {
            applyData(emptySnapshot());
            showStorageError("Party konnte nach der Änderung nicht neu geladen werden.");
            return;
        }
        applyData(snapshot);
    }

    private static PartyService.PartySnapshotResult emptySnapshot() {
        return new PartyService.PartySnapshotResult(
                PartyService.ReadStatus.STORAGE_ERROR,
                List.of(),
                List.of());
    }

    private void showStorageError(String message) {
        Alert alert = new Alert(Alert.AlertType.WARNING, message, ButtonType.OK);
        alert.setHeaderText("Speicherfehler");
        alert.show();
    }

}
