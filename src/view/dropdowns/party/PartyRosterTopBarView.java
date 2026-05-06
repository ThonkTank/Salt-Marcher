package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.OverrunStyle;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupAction;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupSpec;

public final class PartyRosterTopBarView extends VBox {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_NEUTRAL_ACTION = "neutral-action";

    private final EventPublisher eventPublisher = new EventPublisher();
    private final MemberListPane memberList = new MemberListPane(
            eventPublisher::editRequested,
            eventPublisher::removeRequested,
            eventPublisher::xpAdjustmentRequested);
    private final SummaryLabel summaryLabel = new SummaryLabel("party-summary");
    private final SummaryLabel restSummaryLabel = new SummaryLabel("party-summary-rest");
    private final ActionStatusLabel actionStatusLabel = new ActionStatusLabel();
    private final RestActionsBar restActions = new RestActionsBar(
            eventPublisher::shortRestRequested,
            eventPublisher::longRestRequested);
    private final SearchSection searchSection = new SearchSection(eventPublisher::addRequested);
    private final NewCharacterPane newCharacterPane = new NewCharacterPane(eventPublisher::createEditorRequested);
    private Consumer<PartyRosterTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyRosterTopBarView() {
        getStyleClass().add("party-roster-panel");
        setFillWidth(true);
        getChildren().addAll(
                new SectionLabel("AKTUELLE PARTY"),
                memberList,
                restActions,
                new Separator(),
                new SectionLabel("CHARAKTER HINZUFUEGEN"),
                searchSection,
                newCharacterPane,
                summaryLabel,
                restSummaryLabel,
                actionStatusLabel);
    }

    public void showPanel(PanelContent content) {
        PanelContent safeContent = content == null ? PanelContent.loadingContent() : content;
        boolean actionsDisabled = safeContent.actionsDisabled();
        memberList.showPanel(safeContent, actionsDisabled);
        searchSection.showMembers(safeContent.reserveMembers(), actionsDisabled);
        summaryLabel.setText(safeContent.summaryText());
        restSummaryLabel.showText(safeContent.restSummaryText());
        restActions.setActionsDisabled(safeContent.restActionsDisabled() || actionsDisabled);
        newCharacterPane.setActionsDisabled(actionsDisabled);
        actionStatusLabel.showStatus(safeContent.actionStatus(), safeContent.actionStatusError());
    }

    public void onViewInputEvent(Consumer<PartyRosterTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
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

    private final class EventPublisher {

        private void createEditorRequested() {
            publish(new PartyRosterTopBarViewInputEvent(
                    true,
                    false,
                    false,
                    0L,
                    "",
                    0,
                    false,
                    false,
                    false,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void editRequested(MemberView member) {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    true,
                    false,
                    member.id() == null ? 0L : member.id(),
                    member.name(),
                    0,
                    false,
                    false,
                    false,
                    new PartyRosterTopBarViewInputEvent.EditorSeed(
                            member.id() == null ? 0L : member.id(),
                            member.name(),
                            member.playerName(),
                            Integer.toString(member.level()),
                            Integer.toString(member.passivePerception()),
                            Integer.toString(member.armorClass()))));
        }

        private void addRequested(MemberView member) {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    false,
                    true,
                    member.id() == null ? 0L : member.id(),
                    member.name(),
                    0,
                    false,
                    false,
                    false,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void removeRequested(MemberView member) {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    false,
                    false,
                    member.id() == null ? 0L : member.id(),
                    member.name(),
                    0,
                    true,
                    false,
                    false,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void xpAdjustmentRequested(MemberView member, int xpDelta) {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    false,
                    false,
                    member.id() == null ? 0L : member.id(),
                    member.name(),
                    xpDelta,
                    false,
                    false,
                    false,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void shortRestRequested() {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    false,
                    false,
                    0L,
                    "",
                    0,
                    false,
                    true,
                    false,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void longRestRequested() {
            publish(new PartyRosterTopBarViewInputEvent(
                    false,
                    false,
                    false,
                    0L,
                    "",
                    0,
                    false,
                    false,
                    true,
                    PartyRosterTopBarViewInputEvent.EditorSeed.empty()));
        }

        private void publish(PartyRosterTopBarViewInputEvent event) {
            viewInputEventHandler.accept(event);
        }
    }

    private static final class MemberListPane extends VBox {

        private final Consumer<MemberView> onEditRequested;
        private final Consumer<MemberView> onRemoveRequested;
        private final BiConsumer<MemberView, Integer> onXpAdjustmentRequested;

        private MemberListPane(
                Consumer<MemberView> onEditRequested,
                Consumer<MemberView> onRemoveRequested,
                BiConsumer<MemberView, Integer> onXpAdjustmentRequested
        ) {
            this.onEditRequested = onEditRequested;
            this.onRemoveRequested = onRemoveRequested;
            this.onXpAdjustmentRequested = onXpAdjustmentRequested;
            getStyleClass().add("party-list");
            setMaxWidth(Double.MAX_VALUE);
        }

        private void showPanel(PanelContent content, boolean actionsDisabled) {
            getChildren().clear();
            if (content.loading()) {
                getChildren().add(new MessageLabel("Lade..."));
                return;
            }
            if (content.storageError()) {
                getChildren().add(new MessageLabel(content.storageMessage()));
                return;
            }
            if (content.activeMembers().isEmpty()) {
                getChildren().add(new MessageLabel("Keine aktiven Party-Mitglieder"));
                return;
            }
            for (MemberView member : content.activeMembers()) {
                getChildren().add(new MemberRow(
                        member,
                        actionsDisabled,
                        onEditRequested,
                        onRemoveRequested,
                        onXpAdjustmentRequested));
            }
        }
    }

    private static final class MemberRow extends VBox {

        private MemberRow(
                MemberView member,
                boolean actionsDisabled,
                Consumer<MemberView> onEditRequested,
                Consumer<MemberView> onRemoveRequested,
                BiConsumer<MemberView, Integer> onXpAdjustmentRequested
        ) {
            Label identityLabel = new ClippedLabel(identityText(member), "bold");
            HBox.setHgrow(identityLabel, Priority.ALWAYS);

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);

            HBox managementActions = new HBox(
                    6,
                    new ActionButton(
                            "✎",
                            STYLE_ACCENT,
                            "Charakter bearbeiten: " + member.name(),
                            "Charakter bearbeiten",
                            actionsDisabled,
                            () -> onEditRequested.accept(member)),
                    new ActionButton(
                            "×",
                            STYLE_NEUTRAL_ACTION,
                            "Aus aktiver Party entfernen: " + member.name(),
                            "Aus aktiver Party entfernen\n(Charakter bleibt in der Datenbank)",
                            actionsDisabled,
                            () -> onRemoveRequested.accept(member)));
            managementActions.setAlignment(Pos.CENTER_RIGHT);

            HBox headerRow = new HBox(8, identityLabel, new LevelProgressRow(member, actionsDisabled, onXpAdjustmentRequested));
            headerRow.setAlignment(Pos.CENTER_LEFT);
            headerRow.setMaxWidth(Double.MAX_VALUE);

            Label combatLabel = new ClippedLabel(combatText(member), STYLE_TEXT_SECONDARY);
            HBox.setHgrow(combatLabel, Priority.ALWAYS);
            HBox actionRow = new HBox(
                    8,
                    combatLabel,
                    new RestChipLabel(member),
                    spacer,
                    managementActions);
            actionRow.setAlignment(Pos.CENTER_LEFT);
            actionRow.setMaxWidth(Double.MAX_VALUE);

            getChildren().addAll(headerRow, actionRow);
            getStyleClass().add("party-row");
            setMaxWidth(Double.MAX_VALUE);
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
    }

    private static final class LevelProgressRow extends HBox {

        private LevelProgressRow(
                MemberView member,
                boolean actionsDisabled,
                BiConsumer<MemberView, Integer> onXpAdjustmentRequested
        ) {
            PopupSpec popupSpec = actionsDisabled ? null : new PopupSpec(
                    "XP korrigieren",
                    100,
                    List.of(
                            new PopupAction("-XP", "", false, amount -> onXpAdjustmentRequested.accept(member, -amount)),
                            new PopupAction("+XP", "accent", true, amount -> onXpAdjustmentRequested.accept(member, amount))));
            ProgressMeterView progressMeter = new ProgressMeterView(
                    member.levelProgressFraction(),
                    member.levelProgressText(),
                    "Level-Fortschritt " + member.levelProgressText(),
                    "progress-meter-fill-xp",
                    "progress-meter-level",
                    popupSpec);
            getChildren().addAll(
                    new LevelEdgeLabel(member.levelLabel()),
                    progressMeter,
                    new LevelEdgeLabel(member.nextLevelLabel()));
            setAlignment(Pos.CENTER_LEFT);
            setSpacing(5);
        }
    }

    private static final class SearchSection extends VBox {

        private final TextField searchField = new TextField();
        private final SuggestionList suggestionList = new SuggestionList();
        private final ObservableList<MemberView> availableMembers = FXCollections.observableArrayList();
        private final ObservableList<MemberView> matchingMembers = FXCollections.observableArrayList();
        private final Consumer<MemberView> onAddRequested;
        private boolean actionsDisabled;

        private SearchSection(Consumer<MemberView> onAddRequested) {
            this.onAddRequested = onAddRequested;
            suggestionList.setItems(matchingMembers);
            searchField.setPromptText("Suche...");
            searchField.textProperty().addListener((ignored, oldText, newText) -> applySearch());
            searchField.focusedProperty().addListener((ignored, wasFocused, focused) -> {
                if (focused) {
                    updateSuggestionVisibility();
                }
            });
            searchField.setOnAction(event -> addFirstVisibleMember());
            suggestionList.setOnMouseClicked(event -> addSelectedSuggestion());
            suggestionList.setOnKeyPressed(event -> {
                if (event.getCode() == KeyCode.ENTER) {
                    addSelectedSuggestion();
                    event.consume();
                }
            });
            getChildren().addAll(searchField, suggestionList);
            getStyleClass().add("party-search");
            setSpacing(4);
        }

        private void showMembers(List<MemberView> members, boolean actionsDisabled) {
            availableMembers.setAll(members == null ? List.of() : members);
            this.actionsDisabled = actionsDisabled;
            searchField.clear();
            suggestionList.clearSelection();
            searchField.setDisable(actionsDisabled);
            suggestionList.setDisable(actionsDisabled);
            applySearch();
            hideSuggestions();
        }

        private void applySearch() {
            String lower = safe(searchField.getText()).trim().toLowerCase(Locale.ROOT);
            matchingMembers.setAll(availableMembers.stream()
                    .filter(member -> lower.isEmpty() || member.name().toLowerCase(Locale.ROOT).contains(lower))
                    .toList());
            updateSuggestionVisibility();
        }

        private void updateSuggestionVisibility() {
            boolean visible = !actionsDisabled && searchField.isFocused() && !matchingMembers.isEmpty();
            suggestionList.setVisible(visible);
            suggestionList.setManaged(visible);
        }

        private void addSelectedSuggestion() {
            if (actionsDisabled) {
                return;
            }
            MemberView selected = suggestionList.selectedMember();
            if (selected != null) {
                onAddRequested.accept(selected);
                hideSuggestions();
            }
        }

        private void addFirstVisibleMember() {
            if (actionsDisabled || matchingMembers.isEmpty()) {
                return;
            }
            onAddRequested.accept(matchingMembers.get(0));
            hideSuggestions();
        }

        private void hideSuggestions() {
            suggestionList.setVisible(false);
            suggestionList.setManaged(false);
        }
    }

    private static final class SuggestionList extends ListView<MemberView> {

        private SuggestionList() {
            setPrefHeight(USE_COMPUTED_SIZE);
            setMaxHeight(120);
            setVisible(false);
            setManaged(false);
            getStyleClass().add("party-suggestions");
            setCellFactory(listView -> new ListCell<>() {
                @Override
                protected void updateItem(MemberView member, boolean empty) {
                    super.updateItem(member, empty);
                    setText(empty || member == null ? null : member.name() + "  (" + member.levelLabel() + ")");
                }
            });
        }

        private MemberView selectedMember() {
            return getSelectionModel().getSelectedItem();
        }

        private void clearSelection() {
            getSelectionModel().clearSelection();
        }
    }

    private static final class RestActionsBar extends HBox {

        private final Button shortRestButton = new CompactButton("Short Rest");
        private final Button longRestButton = new CompactButton("Long Rest");

        private RestActionsBar(Runnable onShortRestRequested, Runnable onLongRestRequested) {
            shortRestButton.setOnAction(event -> onShortRestRequested.run());
            longRestButton.setOnAction(event -> onLongRestRequested.run());
            getChildren().addAll(shortRestButton, longRestButton);
            getStyleClass().add("party-rest-actions");
            setSpacing(6);
        }

        private void setActionsDisabled(boolean actionsDisabled) {
            shortRestButton.setDisable(actionsDisabled);
            longRestButton.setDisable(actionsDisabled);
        }
    }

    private static final class NewCharacterPane extends VBox {

        private final Button newCharacterButton = new Button("+ Neuer Charakter");

        private NewCharacterPane(Runnable onCreateEditorRequested) {
            newCharacterButton.setMaxWidth(Double.MAX_VALUE);
            newCharacterButton.setOnAction(event -> onCreateEditorRequested.run());
            getChildren().add(newCharacterButton);
            getStyleClass().add("party-search");
        }

        private void setActionsDisabled(boolean actionsDisabled) {
            newCharacterButton.setDisable(actionsDisabled);
        }
    }

    private static final class ClippedLabel extends Label {

        private ClippedLabel(String text, String styleClass) {
            String safeText = safe(text);
            setText(safeText);
            getStyleClass().add(styleClass);
            setWrapText(false);
            setTextOverrun(OverrunStyle.ELLIPSIS);
            setMinWidth(0);
            setMaxWidth(Double.MAX_VALUE);
            if (!safeText.isBlank()) {
                setTooltip(new Tooltip(safeText));
            }
        }
    }

    private static final class SummaryLabel extends Label {

        private SummaryLabel(String styleClass) {
            getStyleClass().add(styleClass);
            setMaxWidth(Double.MAX_VALUE);
        }

        private void showText(String text) {
            setText(safe(text));
            setVisible(!safe(text).isBlank());
            setManaged(isVisible());
        }
    }

    private static final class ActionStatusLabel extends Label {

        private ActionStatusLabel() {
            setWrapText(true);
            setVisible(false);
            setManaged(false);
        }

        private void showStatus(String message, boolean error) {
            String safeMessage = safe(message);
            setText(safeMessage);
            getStyleClass().removeAll("text-warning", STYLE_TEXT_MUTED);
            getStyleClass().add(error ? "text-warning" : STYLE_TEXT_MUTED);
            setVisible(!safeMessage.isBlank());
            setManaged(isVisible());
        }
    }

    private static final class SectionLabel extends Label {

        private SectionLabel(String text) {
            setText(text);
            getStyleClass().addAll("section-header", STYLE_TEXT_MUTED);
        }
    }

    private static final class MessageLabel extends Label {

        private MessageLabel(String text) {
            setText(text);
            getStyleClass().add(STYLE_TEXT_MUTED);
            setPadding(new Insets(8));
            setWrapText(true);
        }
    }

    private static final class RestChipLabel extends Label {

        private RestChipLabel(MemberView member) {
            setText(member.restText());
            getStyleClass().add("party-rest-chip");
            if (!member.restStyleClass().isBlank()) {
                getStyleClass().add(member.restStyleClass());
            }
            setVisible(!member.restText().isBlank());
            setManaged(isVisible());
        }
    }

    private static final class CompactButton extends Button {

        private CompactButton(String text) {
            super(text);
            getStyleClass().add(STYLE_COMPACT);
        }
    }

    private static final class ActionButton extends Button {

        private ActionButton(
                String text,
                String actionStyle,
                String accessibleText,
                String tooltipText,
                boolean disabled,
                Runnable action
        ) {
            super(text);
            getStyleClass().addAll(STYLE_COMPACT, "icon-button", actionStyle);
            setAccessibleText(accessibleText);
            setTooltip(new Tooltip(tooltipText));
            setDisable(disabled);
            setOnAction(event -> action.run());
        }
    }

    private static final class LevelEdgeLabel extends Label {

        private LevelEdgeLabel(String text) {
            super(text);
            getStyleClass().add("party-level-edge");
        }
    }
}
