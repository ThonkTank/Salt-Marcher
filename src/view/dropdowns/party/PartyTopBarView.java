package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.transformation.FilteredList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.OverrunStyle;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupAction;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupSpec;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class PartyTopBarView extends HBox {

    private static final double POPUP_WIDTH = 380.0;

    private final Button triggerButton = new Button("Keine _Party \u25bc");
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final VBox memberList = new VBox();
    private final Label summaryLabel = new Label();
    private final Label restSummaryLabel = new Label();
    private final Label actionStatusLabel = new Label();
    private final Button shortRestButton = new Button("Short Rest");
    private final Button longRestButton = new Button("Long Rest");
    private final Button newCharacterButton = new Button("+ Neuer Charakter");
    private final TextField searchField = new TextField();
    private final ListView<MemberView> suggestionList = new ListView<>();
    private final ObservableList<MemberView> availableMembers = FXCollections.observableArrayList();
    private final FilteredList<MemberView> filteredMembers = new FilteredList<>(availableMembers);
    private final PartyCharacterEditorTopBarPanel editorPanel = new PartyCharacterEditorTopBarPanel();
    private boolean actionsDisabled;

    private Consumer<PartyTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public PartyTopBarView() {
        setSpacing(8);
        setPadding(new Insets(4, 8, 4, 8));
        configureTrigger();
        configureSearch();
        configurePopup();
        getChildren().add(triggerButton);
    }

    public void setTriggerText(String text) {
        triggerButton.setText(safe(text));
        triggerButton.setAccessibleText(safe(text).replace("_", ""));
    }

    public void showPanel(PanelContent content) {
        PanelContent safeContent = content == null ? PanelContent.loadingContent() : content;
        actionsDisabled = safeContent.actionsDisabled();
        renderMembers(safeContent);
        availableMembers.setAll(safeContent.reserveMembers());
        searchField.clear();
        suggestionList.setVisible(false);
        suggestionList.setManaged(false);
        summaryLabel.setText(safeContent.summaryText());
        restSummaryLabel.setText(safeContent.restSummaryText());
        restSummaryLabel.setVisible(!safeContent.restSummaryText().isBlank());
        restSummaryLabel.setManaged(restSummaryLabel.isVisible());
        shortRestButton.setDisable(safeContent.restActionsDisabled() || actionsDisabled);
        longRestButton.setDisable(safeContent.restActionsDisabled() || actionsDisabled);
        searchField.setDisable(actionsDisabled);
        suggestionList.setDisable(actionsDisabled);
        newCharacterButton.setDisable(actionsDisabled);
        showActionStatus(safeContent.actionStatus(), safeContent.actionStatusError());
    }

    public void onViewInputEvent(Consumer<PartyTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureTrigger() {
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setMnemonicParsing(true);
        triggerButton.setTooltip(new Tooltip("Party-Panel oeffnen (Alt+P)"));
        triggerButton.setOnAction(event -> togglePopup());
    }

    private void configureSearch() {
        searchField.setPromptText("Suche...");
        searchField.textProperty().addListener((ignored, oldText, newText) -> applySearch(newText));
        searchField.focusedProperty().addListener((ignored, wasFocused, focused) -> {
            if (focused) {
                updateSuggestionVisibility();
            }
        });
        searchField.setOnAction(event -> addFirstFilteredMember());
        suggestionList.setItems(filteredMembers);
        suggestionList.getStyleClass().add("party-suggestions");
        suggestionList.setPrefHeight(Control.USE_COMPUTED_SIZE);
        suggestionList.setMaxHeight(120);
        suggestionList.setVisible(false);
        suggestionList.setManaged(false);
        suggestionList.setCellFactory(listView -> new ListCell<>() {
            @Override
            protected void updateItem(MemberView member, boolean empty) {
                super.updateItem(member, empty);
                setText(empty || member == null ? null : member.name() + "  (" + member.levelLabel() + ")");
            }
        });
        suggestionList.setOnMouseClicked(event -> addSelectedSuggestion());
        suggestionList.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                addSelectedSuggestion();
                event.consume();
            }
        });
    }

    private void configurePopup() {
        VBox panel = buildPanel();
        panel.getStyleClass().add("party-panel");
        popup.setContent(panel);
        popup.addOnShowing(event -> triggerButton.setAccessibleText("Party-Panel geoeffnet, Escape zum Schliessen"));
        popup.addOnHiding(event -> editorPanel.hide());
        editorPanel.onCreate(draft -> publish(PartyTopBarViewInputEvent.createCharacter(
                toPublishedDraft(draft))));
        editorPanel.onUpdate(draft -> publish(PartyTopBarViewInputEvent.updateCharacter(
                toPublishedDraft(draft))));
        editorPanel.onDelete(member -> publish(PartyTopBarViewInputEvent.deleteCharacter(
                member == null ? 0L : member.id(),
                member == null ? "" : member.name())));
    }

    private VBox buildPanel() {
        Button closeButton = new Button("x");
        closeButton.getStyleClass().add("compact");
        closeButton.setAccessibleText("Party-Panel schliessen");
        closeButton.setOnAction(event -> popup.hide());
        Region headerSpacer = new Region();
        HBox.setHgrow(headerSpacer, Priority.ALWAYS);
        Label headerLabel = new Label("PARTY");
        headerLabel.getStyleClass().add("title-large");
        HBox header = new HBox(6, headerLabel, headerSpacer, closeButton);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        memberList.getStyleClass().add("party-list");
        memberList.setMaxWidth(Double.MAX_VALUE);
        summaryLabel.getStyleClass().add("party-summary");
        summaryLabel.setMaxWidth(Double.MAX_VALUE);
        restSummaryLabel.getStyleClass().add("party-summary-rest");
        actionStatusLabel.setWrapText(true);
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);

        shortRestButton.getStyleClass().add("compact");
        longRestButton.getStyleClass().add("compact");
        shortRestButton.setOnAction(event -> publish(PartyTopBarViewInputEvent.shortRest()));
        longRestButton.setOnAction(event -> publish(PartyTopBarViewInputEvent.longRest()));
        HBox restActions = new HBox(6, shortRestButton, longRestButton);
        restActions.getStyleClass().add("party-rest-actions");

        VBox searchBox = new VBox(4, searchField, suggestionList);
        searchBox.getStyleClass().add("party-search");
        newCharacterButton.setMaxWidth(Double.MAX_VALUE);
        newCharacterButton.setOnAction(event -> editorPanel.showCreate(newCharacterButton));
        VBox newCharacterBox = new VBox(newCharacterButton);
        newCharacterBox.getStyleClass().add("party-search");

        VBox panel = new VBox(
                header,
                sectionLabel("AKTUELLE PARTY"),
                memberList,
                restActions,
                new Separator(),
                sectionLabel("CHARAKTER HINZUFUEGEN"),
                searchBox,
                newCharacterBox,
                summaryLabel,
                restSummaryLabel,
                actionStatusLabel);
        panel.setFillWidth(true);
        return panel;
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(
                popup,
                triggerButton,
                POPUP_WIDTH,
                () -> publish(PartyTopBarViewInputEvent.opened()));
    }

    private void renderMembers(PanelContent content) {
        memberList.getChildren().clear();
        if (content.loading()) {
            memberList.getChildren().add(messageLabel("Lade..."));
            return;
        }
        if (content.storageError()) {
            memberList.getChildren().add(messageLabel(content.storageMessage()));
            return;
        }
        if (content.activeMembers().isEmpty()) {
            memberList.getChildren().add(messageLabel("Keine aktiven Party-Mitglieder"));
            return;
        }
        for (MemberView member : content.activeMembers()) {
            memberList.getChildren().add(memberRow(member));
        }
    }

    private VBox memberRow(MemberView member) {
        Label identityLabel = clippedLabel(identityText(member), "bold");
        HBox.setHgrow(identityLabel, Priority.ALWAYS);
        Node restChip = restChip(member);

        Button editButton = new Button("\u270e");
        editButton.getStyleClass().addAll("compact", "icon-button", "accent");
        editButton.setAccessibleText("Charakter bearbeiten: " + member.name());
        editButton.setTooltip(new Tooltip("Charakter bearbeiten"));
        editButton.setOnAction(event -> editorPanel.showEdit(editButton, toEditorMember(member)));
        editButton.setDisable(actionsDisabled);

        Button removeButton = new Button("\u00d7");
        removeButton.getStyleClass().addAll("compact", "icon-button", "neutral-action");
        removeButton.setAccessibleText("Aus aktiver Party entfernen: " + member.name());
        removeButton.setTooltip(new Tooltip("Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)"));
        removeButton.setOnAction(event -> publish(PartyTopBarViewInputEvent.removeFromParty(
                member.id() == null ? 0L : member.id(),
                member.name())));
        removeButton.setDisable(actionsDisabled);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox managementActions = new HBox(6, editButton, removeButton);
        managementActions.setAlignment(Pos.CENTER_RIGHT);

        HBox progressRow = levelProgressRow(member);
        HBox headerRow = new HBox(8, identityLabel, progressRow);
        headerRow.setAlignment(Pos.CENTER_LEFT);
        headerRow.setMaxWidth(Double.MAX_VALUE);

        Label combatLabel = clippedLabel(combatText(member), "text-secondary");
        HBox.setHgrow(combatLabel, Priority.ALWAYS);
        HBox actionRow = new HBox(8, combatLabel, restChip, spacer, managementActions);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        actionRow.setMaxWidth(Double.MAX_VALUE);

        VBox row = new VBox(3, headerRow, actionRow);
        row.getStyleClass().add("party-row");
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private HBox levelProgressRow(MemberView member) {
        Label currentLevelLabel = new Label(member.levelLabel());
        currentLevelLabel.getStyleClass().add("party-level-edge");
        Label nextLevelLabel = new Label(member.nextLevelLabel());
        nextLevelLabel.getStyleClass().add("party-level-edge");
        @Nullable PopupSpec popupSpec = actionsDisabled ? null : new PopupSpec(
                "XP korrigieren",
                100,
                List.of(
                        new PopupAction("-XP", "", false, amount -> publish(PartyTopBarViewInputEvent.adjustXp(
                                member.id() == null ? 0L : member.id(),
                                member.name(),
                                -amount))),
                        new PopupAction("+XP", "accent", true, amount -> publish(PartyTopBarViewInputEvent.adjustXp(
                                member.id() == null ? 0L : member.id(),
                                member.name(),
                                amount)))));
        ProgressMeterView progressMeter = new ProgressMeterView(
                member.levelProgressFraction(),
                member.levelProgressText(),
                "Level-Fortschritt " + member.levelProgressText(),
                "progress-meter-fill-xp",
                "progress-meter-level",
                popupSpec);

        HBox row = new HBox(5, currentLevelLabel, progressMeter, nextLevelLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private Node restChip(MemberView member) {
        Label label = new Label(member.restText());
        label.getStyleClass().add("party-rest-chip");
        if (!member.restStyleClass().isBlank()) {
            label.getStyleClass().add(member.restStyleClass());
        }
        label.setVisible(!member.restText().isBlank());
        label.setManaged(label.isVisible());
        return label;
    }

    private static String identityText(MemberView member) {
        String name = safe(member.name()).trim();
        String player = safe(member.playerName()).trim();
        if (player.isBlank()) {
            return name;
        }
        if (name.isBlank()) {
            return player;
        }
        return name + " - " + player;
    }

    private static String combatText(MemberView member) {
        return "AC " + member.armorClass() + " | PP " + member.passivePerception();
    }

    private static Label clippedLabel(String text, String styleClass) {
        String safeText = safe(text);
        Label label = new Label(safeText);
        label.getStyleClass().add(styleClass);
        label.setWrapText(false);
        label.setTextOverrun(OverrunStyle.ELLIPSIS);
        label.setMinWidth(0);
        label.setMaxWidth(Double.MAX_VALUE);
        if (!safeText.isBlank()) {
            label.setTooltip(new Tooltip(safeText));
        }
        return label;
    }

    private void showActionStatus(String message, boolean error) {
        actionStatusLabel.setText(safe(message));
        actionStatusLabel.getStyleClass().removeAll("text-warning", "text-muted");
        actionStatusLabel.getStyleClass().add(error ? "text-warning" : "text-muted");
        actionStatusLabel.setVisible(!safe(message).isBlank());
        actionStatusLabel.setManaged(actionStatusLabel.isVisible());
    }

    private void applySearch(String rawText) {
        String lower = safe(rawText).trim().toLowerCase(Locale.ROOT);
        filteredMembers.setPredicate(lower.isEmpty()
                ? member -> true
                : member -> member.name().toLowerCase(Locale.ROOT).contains(lower));
        updateSuggestionVisibility();
    }

    private void updateSuggestionVisibility() {
        boolean visible = searchField.isFocused() && !filteredMembers.isEmpty();
        suggestionList.setVisible(visible);
        suggestionList.setManaged(visible);
    }

    private void addSelectedSuggestion() {
        if (actionsDisabled) {
            return;
        }
        MemberView selected = suggestionList.getSelectionModel().getSelectedItem();
        if (selected != null) {
            publish(PartyTopBarViewInputEvent.addExisting(
                    selected.id() == null ? 0L : selected.id(),
                    selected.name()));
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private void addFirstFilteredMember() {
        if (actionsDisabled) {
            return;
        }
        if (!filteredMembers.isEmpty()) {
            MemberView firstMatch = filteredMembers.get(0);
            publish(PartyTopBarViewInputEvent.addExisting(
                    firstMatch.id() == null ? 0L : firstMatch.id(),
                    firstMatch.name()));
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static Label messageLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setPadding(new Insets(8));
        label.setWrapText(true);
        return label;
    }

    private static PartyCharacterEditorTopBarPanel.EditorMember toEditorMember(MemberView member) {
        return new PartyCharacterEditorTopBarPanel.EditorMember(
                member.id(),
                member.name(),
                member.playerName(),
                member.level(),
                member.passivePerception(),
                member.armorClass());
    }

    private static PartyTopBarViewInputEvent.EditorDraft toPublishedDraft(PartyCharacterEditorTopBarPanel.EditorDraft draft) {
        PartyCharacterEditorTopBarPanel.EditorDraft safeDraft = draft == null
                ? new PartyCharacterEditorTopBarPanel.EditorDraft(null, "", "", "", "", "")
                : draft;
        return new PartyTopBarViewInputEvent.EditorDraft(
                safeDraft.id() == null ? 0L : safeDraft.id(),
                safeDraft.name(),
                safeDraft.playerName(),
                safeDraft.rawLevel(),
                safeDraft.rawPassivePerception(),
                safeDraft.rawArmorClass());
    }

    private void publish(PartyTopBarViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static final class PartyCharacterEditorTopBarPanel {

        private static final double POPUP_WIDTH = 360.0;

        private final DialogSurfaceView panel = new DialogSurfaceView();
        private final Label titleLabel = new Label();
        private final Label errorLabel = new Label();
        private final TextField nameField = new TextField();
        private final TextField playerNameField = new TextField();
        private final TextField levelField = createIntegerField();
        private final TextField passivePerceptionField = createIntegerField();
        private final TextField armorClassField = createIntegerField();
        private final VBox deleteSection = new VBox(8);
        private final Label deleteMessageLabel = new Label();
        private final Button revealDeleteButton = new Button("Loeschen");
        private final Button cancelDeleteButton = new Button("Abbrechen");
        private final Button confirmDeleteButton = new Button("Wirklich loeschen");
        private final Button cancelButton = new Button("Abbrechen");
        private final Button submitButton = new Button("Speichern");
        private final AnchoredPopupView popup = new AnchoredPopupView();

        private @Nullable EditorMember editingMember;
        private boolean pending;
        private Consumer<EditorDraft> onCreate = ignored -> { };
        private Consumer<EditorDraft> onUpdate = ignored -> { };
        private Consumer<EditorMember> onDelete = ignored -> { };

        private PartyCharacterEditorTopBarPanel() {
            panel.getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-dropdown");
            panel.setPadding(new Insets(10));
            titleLabel.getStyleClass().add("panel-title");
            errorLabel.getStyleClass().add("text-warning");
            errorLabel.setWrapText(true);
            errorLabel.setVisible(false);
            errorLabel.setManaged(false);
            configureFields();
            configureDeleteSection();
            configurePopup();
            VBox body = new VBox(10, formGrid(), errorLabel, revealDeleteButton, deleteSection);
            panel.setHeader(titleLabel);
            panel.setBody(body, BodyPolicy.FIXED);
            panel.setFooter(cancelButton, DialogSurfaceView.spacer(), submitButton);
            resetTransientState();
        }

        private void onCreate(Consumer<EditorDraft> action) {
            onCreate = action == null ? ignored -> { } : action;
        }

        private void onUpdate(Consumer<EditorDraft> action) {
            onUpdate = action == null ? ignored -> { } : action;
        }

        private void onDelete(Consumer<EditorMember> action) {
            onDelete = action == null ? ignored -> { } : action;
        }

        private void showCreate(Node anchor) {
            editingMember = null;
            titleLabel.setText("Neuer Charakter");
            submitButton.setText("Erstellen");
            revealDeleteButton.setVisible(false);
            revealDeleteButton.setManaged(false);
            populateFields("", "", 1, 10, 10);
            setDeleteConfirmationVisible(false);
            resetError();
            show(anchor);
        }

        private void showEdit(Node anchor, @Nullable EditorMember member) {
            editingMember = member;
            EditorMember safeMember = member == null ? EditorMember.empty() : member;
            titleLabel.setText("Charakter bearbeiten");
            submitButton.setText("Speichern");
            revealDeleteButton.setVisible(true);
            revealDeleteButton.setManaged(true);
            populateFields(
                    safeMember.name(),
                    safeMember.playerName(),
                    safeMember.level(),
                    safeMember.passivePerception(),
                    safeMember.armorClass());
            deleteMessageLabel.setText("\"" + safeMember.name() + "\" wirklich dauerhaft loeschen?");
            setDeleteConfirmationVisible(false);
            resetError();
            show(anchor);
        }

        private void hide() {
            popup.hide();
        }

        private void configureFields() {
            configureField(nameField, "Charaktername");
            configureField(playerNameField, "Spielername");
            configureField(levelField, "Level");
            configureField(passivePerceptionField, "Passive Perception");
            configureField(armorClassField, "AC");
            nameField.setOnAction(event -> submit());
            playerNameField.setOnAction(event -> submit());
            levelField.setOnAction(event -> submit());
            passivePerceptionField.setOnAction(event -> submit());
            armorClassField.setOnAction(event -> submit());
            nameField.textProperty().addListener((ignored, before, after) -> updateSubmitDisabled());
            updateSubmitDisabled();
        }

        private void configureDeleteSection() {
            revealDeleteButton.getStyleClass().addAll("compact", "danger-action");
            revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
            revealDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(true));
            deleteMessageLabel.getStyleClass().add("dropdown-message");
            deleteMessageLabel.setWrapText(true);
            cancelDeleteButton.getStyleClass().addAll("compact", "neutral-action");
            cancelDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(false));
            confirmDeleteButton.getStyleClass().addAll("compact", "danger-action");
            confirmDeleteButton.setOnAction(event -> {
                if (pending) {
                    return;
                }
                onDelete.accept(editingMember == null ? EditorMember.empty() : editingMember);
                hide();
            });
            HBox deleteActions = new HBox(8, cancelDeleteButton, confirmDeleteButton);
            deleteActions.setAlignment(Pos.CENTER_RIGHT);
            deleteSection.getStyleClass().add("party-editor-delete-section");
            deleteSection.getChildren().addAll(deleteMessageLabel, deleteActions);
        }

        private void configurePopup() {
            popup.setContent(panel);
            popup.addOnHidden(event -> resetTransientState());
            cancelButton.setOnAction(event -> popup.hide());
            submitButton.setOnAction(event -> submit());
        }

        private GridPane formGrid() {
            GridPane formGrid = new GridPane();
            formGrid.getStyleClass().add("party-editor-form");
            formGrid.setHgap(10);
            formGrid.setVgap(8);
            addRow(formGrid, 0, "Charakter", nameField);
            addRow(formGrid, 1, "Spieler", playerNameField);
            addRow(formGrid, 2, "Level", levelField);
            addRow(formGrid, 3, "Passive Perception", passivePerceptionField);
            addRow(formGrid, 4, "AC", armorClassField);
            return formGrid;
        }

        private void submit() {
            if (pending) {
                return;
            }
            EditorDraft draft = new EditorDraft(
                    editingMember == null ? null : editingMember.id(),
                    safe(nameField.getText()).trim(),
                    safe(playerNameField.getText()).trim(),
                    safe(levelField.getText()).trim(),
                    safe(passivePerceptionField.getText()).trim(),
                    safe(armorClassField.getText()).trim());
            if (editingMember == null) {
                onCreate.accept(draft);
            } else {
                onUpdate.accept(draft);
            }
            hide();
        }

        private void show(Node anchor) {
            if (anchor == null || anchor.getScene() == null) {
                return;
            }
            panel.applyCss();
            panel.layout();
            popup.showTrailing(anchor, POPUP_WIDTH);
            nameField.requestFocus();
            nameField.selectAll();
        }

        private void showError(String message) {
            errorLabel.setText(safe(message));
            errorLabel.setVisible(true);
            errorLabel.setManaged(true);
            nameField.requestFocus();
        }

        private void showInfo(String message) {
            errorLabel.setText(safe(message));
            errorLabel.setVisible(true);
            errorLabel.setManaged(true);
        }

        private void resetError() {
            errorLabel.setText("");
            errorLabel.setVisible(false);
            errorLabel.setManaged(false);
        }

        private void resetTransientState() {
            setPending(false);
            resetError();
            setDeleteConfirmationVisible(false);
        }

        private void setDeleteConfirmationVisible(boolean visible) {
            deleteSection.setVisible(visible);
            deleteSection.setManaged(visible);
            if (visible) {
                cancelDeleteButton.requestFocus();
            }
        }

        private void updateSubmitDisabled() {
            submitButton.setDisable(pending || safe(nameField.getText()).isBlank());
        }

        private void setPending(boolean active) {
            pending = active;
            nameField.setDisable(active);
            playerNameField.setDisable(active);
            levelField.setDisable(active);
            passivePerceptionField.setDisable(active);
            armorClassField.setDisable(active);
            revealDeleteButton.setDisable(active);
            cancelDeleteButton.setDisable(active);
            confirmDeleteButton.setDisable(active);
            cancelButton.setDisable(active);
            updateSubmitDisabled();
        }

        private void populateFields(
                String name,
                String playerName,
                int level,
                int passivePerception,
                int armorClass
        ) {
            nameField.setText(safe(name));
            playerNameField.setText(safe(playerName));
            levelField.setText(Integer.toString(level));
            passivePerceptionField.setText(Integer.toString(passivePerception));
            armorClassField.setText(Integer.toString(armorClass));
        }

        private static void addRow(GridPane grid, int row, String labelText, TextField field) {
            Label label = new Label(labelText);
            label.getStyleClass().add("text-muted");
            label.setLabelFor(field);
            grid.add(label, 0, row);
            grid.add(field, 1, row);
            GridPane.setHgrow(field, Priority.ALWAYS);
        }

        private static void configureField(TextField field, String promptText) {
            field.setPromptText(promptText);
        }

        private static TextField createIntegerField() {
            TextField field = new TextField();
            field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
            return field;
        }

        private record EditorMember(
                @Nullable Long id,
                String name,
                String playerName,
                int level,
                int passivePerception,
                int armorClass
        ) {

            private EditorMember {
                name = safe(name);
                playerName = safe(playerName);
            }

            private static EditorMember empty() {
                return new EditorMember(null, "", "", 1, 10, 10);
            }
        }

        private record EditorDraft(
                @Nullable Long id,
                String name,
                String playerName,
                String rawLevel,
                String rawPassivePerception,
                String rawArmorClass
        ) {

            private EditorDraft {
                name = safe(name);
                playerName = safe(playerName);
                rawLevel = safe(rawLevel);
                rawPassivePerception = safe(rawPassivePerception);
                rawArmorClass = safe(rawArmorClass);
            }
        }

    }

    public record PanelContent(
            boolean loading,
            boolean storageError,
            String storageMessage,
            List<MemberView> activeMembers,
            List<MemberView> reserveMembers,
            String summaryText,
            String restSummaryText,
            String actionStatus,
            boolean actionStatusError,
            boolean restActionsDisabled,
            boolean actionsDisabled
    ) {

        public PanelContent {
            storageMessage = safe(storageMessage);
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
        }

        public static PanelContent loadingContent() {
            return new PanelContent(true, false, "", List.of(), List.of(), "Lade...", "", "", false, true, true);
        }
    }

    public record MemberView(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int currentLevelXp,
            int nextLevelXp,
            int passivePerception,
            int armorClass,
            String levelLabel,
            String nextLevelLabel,
            String detailsText,
            String progressionText,
            String levelProgressText,
            double levelProgressFraction,
            String restText,
            String restStyleClass
    ) {

        public MemberView {
            name = safe(name);
            playerName = safe(playerName);
            levelLabel = safe(levelLabel);
            nextLevelLabel = safe(nextLevelLabel);
            detailsText = safe(detailsText);
            progressionText = safe(progressionText);
            levelProgressText = safe(levelProgressText);
            levelProgressFraction = Math.max(0.0, Math.min(1.0, levelProgressFraction));
            restText = safe(restText);
            restStyleClass = safe(restStyleClass);
        }
    }

}
