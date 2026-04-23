package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Function;
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
import javafx.scene.control.ProgressBar;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class PartyTopBarView extends HBox {

    private static final double POPUP_WIDTH = 380.0;

    private final Button triggerButton = new Button("Keine _Party \u25bc");
    private final Popup popup = new Popup();
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
    private final PartyCharacterEditorTopBarView editorView = new PartyCharacterEditorTopBarView();
    private boolean actionsDisabled;

    private Runnable onOpen = () -> {};
    private Consumer<MemberView> onAddExisting = ignored -> {};
    private Consumer<MemberView> onRemoveFromParty = ignored -> {};
    private Consumer<AwardXpRequest> onAwardXp = ignored -> {};
    private Runnable onShortRest = () -> {};
    private Runnable onLongRest = () -> {};

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

    public void onOpen(Runnable action) {
        onOpen = action == null ? () -> {} : action;
    }

    public void onAddExisting(Consumer<MemberView> action) {
        onAddExisting = action == null ? ignored -> {} : action;
    }

    public void onRemoveFromParty(Consumer<MemberView> action) {
        onRemoveFromParty = action == null ? ignored -> {} : action;
    }

    public void onAwardXp(Consumer<AwardXpRequest> action) {
        onAwardXp = action == null ? ignored -> {} : action;
    }

    public void onShortRest(Runnable action) {
        onShortRest = action == null ? () -> {} : action;
    }

    public void onLongRest(Runnable action) {
        onLongRest = action == null ? () -> {} : action;
    }

    public void onCreateCharacter(
            Function<PartyCharacterEditorTopBarView.EditorDraft, PartyCharacterEditorTopBarView.EditorResult> action
    ) {
        editorView.onCreate(action);
    }

    public void onUpdateCharacter(
            Function<PartyCharacterEditorTopBarView.EditorDraft, PartyCharacterEditorTopBarView.EditorResult> action
    ) {
        editorView.onUpdate(action);
    }

    public void onDeleteCharacter(
            Function<PartyCharacterEditorTopBarView.EditorMember, PartyCharacterEditorTopBarView.EditorResult> action
    ) {
        editorView.onDelete(action);
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
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(panel);
        popup.setOnShowing(event -> triggerButton.setAccessibleText("Party-Panel geoeffnet, Escape zum Schliessen"));
        popup.setOnHiding(event -> editorView.hide());
        popup.setOnHidden(event -> triggerButton.requestFocus());
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                event.consume();
            }
        });
    }

    private VBox buildPanel() {
        Button closeButton = new Button("x");
        closeButton.getStyleClass().add("party-btn");
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
        shortRestButton.setOnAction(event -> onShortRest.run());
        longRestButton.setOnAction(event -> onLongRest.run());
        HBox restActions = new HBox(6, shortRestButton, longRestButton);
        restActions.getStyleClass().add("party-rest-actions");

        VBox searchBox = new VBox(4, searchField, suggestionList);
        searchBox.getStyleClass().add("party-search");
        newCharacterButton.setMaxWidth(Double.MAX_VALUE);
        newCharacterButton.setOnAction(event -> editorView.showCreate(newCharacterButton));
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
        DropdownPopupView.toggleTrailing(popup, triggerButton, POPUP_WIDTH, onOpen);
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
        Label nameLabel = clippedLabel(member.name(), "party-member-name");
        HBox.setHgrow(nameLabel, Priority.ALWAYS);

        Label detailsLabel = clippedLabel(member.detailsText(), "party-member-meta");
        detailsLabel.setMaxWidth(118);
        Node restChip = restChip(member);

        TextField xpField = createIntegerField();
        xpField.setPromptText("XP");
        xpField.getStyleClass().add("party-xp-field");
        Button xpButton = new Button("+XP");
        xpButton.getStyleClass().add("compact");
        xpButton.setOnAction(event -> onAwardXp.accept(new AwardXpRequest(member, xpField.getText())));
        xpField.setOnAction(event -> onAwardXp.accept(new AwardXpRequest(member, xpField.getText())));
        xpField.setDisable(actionsDisabled);
        xpButton.setDisable(actionsDisabled);
        HBox xpActions = new HBox(6, xpField, xpButton);
        xpActions.getStyleClass().add("party-xp-actions");
        xpActions.setAlignment(Pos.CENTER_RIGHT);

        Button editButton = new Button("\u270e");
        editButton.getStyleClass().addAll("party-btn", "party-icon-btn", "edit");
        editButton.setAccessibleText("Charakter bearbeiten: " + member.name());
        editButton.setTooltip(new Tooltip("Charakter bearbeiten"));
        editButton.setOnAction(event -> editorView.showEdit(editButton, toEditorMember(member)));
        editButton.setDisable(actionsDisabled);

        Button removeButton = new Button("\u00d7");
        removeButton.getStyleClass().addAll("party-btn", "party-icon-btn", "remove");
        removeButton.setAccessibleText("Aus aktiver Party entfernen: " + member.name());
        removeButton.setTooltip(new Tooltip("Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)"));
        removeButton.setOnAction(event -> onRemoveFromParty.accept(member));
        removeButton.setDisable(actionsDisabled);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox managementActions = new HBox(6, editButton, removeButton);
        managementActions.getStyleClass().add("party-management-actions");
        managementActions.setAlignment(Pos.CENTER_RIGHT);

        HBox headerRow = new HBox(6, nameLabel, detailsLabel, restChip, spacer, managementActions);
        headerRow.setAlignment(Pos.CENTER_LEFT);
        headerRow.setMaxWidth(Double.MAX_VALUE);

        HBox progressRow = levelProgressRow(member);
        HBox.setHgrow(progressRow, Priority.ALWAYS);
        HBox actionRow = new HBox(8, progressRow, xpActions);
        actionRow.getStyleClass().add("party-action-row");
        actionRow.setAlignment(Pos.CENTER_LEFT);
        actionRow.setMaxWidth(Double.MAX_VALUE);

        VBox row = new VBox(3, headerRow, actionRow);
        row.getStyleClass().add("party-row");
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static HBox levelProgressRow(MemberView member) {
        Label currentLevelLabel = new Label(member.levelLabel());
        currentLevelLabel.getStyleClass().add("party-level-edge");
        Label nextLevelLabel = new Label(member.nextLevelLabel());
        nextLevelLabel.getStyleClass().add("party-level-edge");
        Label progressTextLabel = clippedLabel(member.levelProgressText(), "party-level-xp");
        progressTextLabel.setMaxWidth(86);

        ProgressBar progressBar = new ProgressBar(member.levelProgressFraction());
        progressBar.getStyleClass().add("party-level-progress-bar");
        progressBar.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(progressBar, Priority.ALWAYS);

        HBox row = new HBox(5, currentLevelLabel, progressBar, nextLevelLabel, progressTextLabel);
        row.getStyleClass().add("party-level-progress-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
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
            onAddExisting.accept(selected);
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private void addFirstFilteredMember() {
        if (actionsDisabled) {
            return;
        }
        if (!filteredMembers.isEmpty()) {
            onAddExisting.accept(filteredMembers.get(0));
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("party-section-label");
        return label;
    }

    private static Label messageLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setPadding(new Insets(8));
        label.setWrapText(true);
        return label;
    }

    private static TextField createIntegerField() {
        TextField field = new TextField();
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static PartyCharacterEditorTopBarView.EditorMember toEditorMember(MemberView member) {
        return new PartyCharacterEditorTopBarView.EditorMember(
                member.id(),
                member.name(),
                member.playerName(),
                member.level(),
                member.passivePerception(),
                member.armorClass());
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

    public record AwardXpRequest(MemberView member, String rawXp) {
    }
}
