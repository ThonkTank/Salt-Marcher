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
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupAction;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupSpec;

public final class PartyRosterTopBarView extends VBox {

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
    private boolean actionsDisabled;
    private Consumer<PartyRosterTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyRosterTopBarView() {
        getStyleClass().add("party-roster-panel");
        setFillWidth(true);
        configureSearch();
        getChildren().addAll(
                sectionLabel("AKTUELLE PARTY"),
                memberList,
                restActions(),
                new Separator(),
                sectionLabel("CHARAKTER HINZUFUEGEN"),
                searchBox(),
                newCharacterBox(),
                summaryLabel,
                restSummaryLabel,
                actionStatusLabel);
        memberList.getStyleClass().add("party-list");
        memberList.setMaxWidth(Double.MAX_VALUE);
        summaryLabel.getStyleClass().add("party-summary");
        summaryLabel.setMaxWidth(Double.MAX_VALUE);
        restSummaryLabel.getStyleClass().add("party-summary-rest");
        actionStatusLabel.setWrapText(true);
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);
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

    public void onViewInputEvent(Consumer<PartyRosterTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
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

    private Node restActions() {
        shortRestButton.getStyleClass().add("compact");
        longRestButton.getStyleClass().add("compact");
        shortRestButton.setOnAction(event -> publish(
                PartyRosterTopBarViewInputEvent.Source.SHORT_REST_BUTTON,
                0L,
                "",
                0,
                PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        longRestButton.setOnAction(event -> publish(
                PartyRosterTopBarViewInputEvent.Source.LONG_REST_BUTTON,
                0L,
                "",
                0,
                PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        HBox restActions = new HBox(6, shortRestButton, longRestButton);
        restActions.getStyleClass().add("party-rest-actions");
        return restActions;
    }

    private Node searchBox() {
        VBox searchBox = new VBox(4, searchField, suggestionList);
        searchBox.getStyleClass().add("party-search");
        return searchBox;
    }

    private Node newCharacterBox() {
        newCharacterButton.setMaxWidth(Double.MAX_VALUE);
        newCharacterButton.setOnAction(event -> publish(
                PartyRosterTopBarViewInputEvent.Source.OPEN_CREATE_EDITOR,
                0L,
                "",
                0,
                PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        VBox newCharacterBox = new VBox(newCharacterButton);
        newCharacterBox.getStyleClass().add("party-search");
        return newCharacterBox;
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

        Button editButton = new Button("✎");
        editButton.getStyleClass().addAll("compact", "icon-button", "accent");
        editButton.setAccessibleText("Charakter bearbeiten: " + member.name());
        editButton.setTooltip(new Tooltip("Charakter bearbeiten"));
        editButton.setOnAction(event -> publish(
                PartyRosterTopBarViewInputEvent.Source.OPEN_EDIT_EDITOR,
                member.id() == null ? 0L : member.id(),
                member.name(),
                0,
                toEditorSeed(member)));
        editButton.setDisable(actionsDisabled);

        Button removeButton = new Button("×");
        removeButton.getStyleClass().addAll("compact", "icon-button", "neutral-action");
        removeButton.setAccessibleText("Aus aktiver Party entfernen: " + member.name());
        removeButton.setTooltip(new Tooltip("Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)"));
        removeButton.setOnAction(event -> publish(
                PartyRosterTopBarViewInputEvent.Source.REMOVE_ACTIVE_MEMBER_BUTTON,
                member.id() == null ? 0L : member.id(),
                member.name(),
                0,
                PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
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
        PopupSpec popupSpec = actionsDisabled ? null : new PopupSpec(
                "XP korrigieren",
                100,
                List.of(
                        new PopupAction("-XP", "", false, amount -> publish(
                                PartyRosterTopBarViewInputEvent.Source.ADJUST_XP_POPUP,
                                member.id() == null ? 0L : member.id(),
                                member.name(),
                                -amount,
                                PartyRosterTopBarViewInputEvent.EditorSeed.empty())),
                        new PopupAction("+XP", "accent", true, amount -> publish(
                                PartyRosterTopBarViewInputEvent.Source.ADJUST_XP_POPUP,
                                member.id() == null ? 0L : member.id(),
                                member.name(),
                                amount,
                                PartyRosterTopBarViewInputEvent.EditorSeed.empty()))));
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
            publish(
                    PartyRosterTopBarViewInputEvent.Source.ADD_EXISTING_MEMBER,
                    selected.id() == null ? 0L : selected.id(),
                    selected.name(),
                    0,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty());
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
            publish(
                    PartyRosterTopBarViewInputEvent.Source.ADD_EXISTING_MEMBER,
                    firstMatch.id() == null ? 0L : firstMatch.id(),
                    firstMatch.name(),
                    0,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty());
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private void publish(
            PartyRosterTopBarViewInputEvent.Source source,
            long memberId,
            String memberName,
            int xpDelta,
            PartyRosterTopBarViewInputEvent.EditorSeed editorSeed
    ) {
        viewInputEventHandler.accept(new PartyRosterTopBarViewInputEvent(
                source,
                memberId,
                memberName,
                xpDelta,
                editorSeed));
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

    private static PartyRosterTopBarViewInputEvent.EditorSeed toEditorSeed(MemberView member) {
        return new PartyRosterTopBarViewInputEvent.EditorSeed(
                member.id() == null ? 0L : member.id(),
                member.name(),
                member.playerName(),
                Integer.toString(member.level()),
                Integer.toString(member.passivePerception()),
                Integer.toString(member.armorClass()));
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

    private static String safe(String value) {
        return value == null ? "" : value;
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
            Long id,
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
