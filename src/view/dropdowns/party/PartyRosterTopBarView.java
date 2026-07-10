package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import javafx.event.ActionEvent;
import javafx.geometry.Pos;
import javafx.scene.AccessibleRole;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.OverrunStyle;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class PartyRosterTopBarView extends VBox {

    private static final int XP_ADJUSTMENT_STEP = 100;
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_NEUTRAL_ACTION = "neutral-action";

    private final VBox memberListPane = new StyledVBox("party-list");
    private final HBox restActionsPane = new StyledHBox("party-rest-actions");
    private final VBox reserveListPane = new StyledVBox("party-search");
    private final TextField reserveSearchField = new StyledTextField("party-search-field");
    private final Button shortRestButton = new StyledButton("Short Rest", STYLE_COMPACT);
    private final Button longRestButton = new StyledButton("Long Rest", STYLE_COMPACT);
    private final Button newCharacterButton = new Button("+ Neuer Charakter");
    private final Label summaryLabel = new StyledLabel("party-summary");
    private final Label restSummaryLabel = new StyledLabel("party-summary-rest");
    private final Label actionStatusLabel = new StyledLabel();
    private final RosterRows rosterRows = new RosterRows();
    private final RosterEvents rosterEvents = new RosterEvents();
    private Consumer<String> reserveSearchChangedHandler = ignored -> { };
    private Runnable createEditorRequestedHandler = () -> { };
    private Consumer<Long> editEditorRequestedHandler = ignored -> { };
    private Consumer<Long> addExistingRequestedHandler = ignored -> { };
    private Consumer<Long> removeRequestedHandler = ignored -> { };
    private BiConsumer<Long, Integer> xpRequestedHandler = (ignoredId, ignoredDelta) -> { };
    private Runnable shortRestRequestedHandler = () -> { };
    private Runnable longRestRequestedHandler = () -> { };

    public PartyRosterTopBarView() {
        getStyleClass().add("party-roster-panel");
        setFillWidth(true);
        configureStaticControls();
        getChildren().addAll(
                PartyRosterChrome.sectionLabel(PartyTopBarVocabulary.ACTIVE_SECTION),
                memberListPane,
                restActionsPane,
                new Separator(),
                PartyRosterChrome.sectionLabel(PartyTopBarVocabulary.ADD_SECTION),
                reserveSearchField,
                reserveListPane,
                newCharacterButton,
                summaryLabel,
                restSummaryLabel,
                actionStatusLabel);
    }

    public void bind(PartyTopBarViewModel viewModel) {
        PartyTopBarViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        showPanel(safeModel.panelContentProperty().get());
        safeModel.panelContentProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    public void onReserveSearchChanged(Consumer<String> handler) {
        reserveSearchChangedHandler = handler == null ? ignored -> { } : handler;
    }

    public void onCreateEditorRequested(Runnable handler) {
        createEditorRequestedHandler = handler == null ? () -> { } : handler;
    }

    public void onEditEditorRequested(Consumer<Long> handler) {
        editEditorRequestedHandler = handler == null ? ignored -> { } : handler;
    }

    public void onAddExistingRequested(Consumer<Long> handler) {
        addExistingRequestedHandler = handler == null ? ignored -> { } : handler;
    }

    public void onRemoveRequested(Consumer<Long> handler) {
        removeRequestedHandler = handler == null ? ignored -> { } : handler;
    }

    public void onXpRequested(BiConsumer<Long, Integer> handler) {
        xpRequestedHandler = handler == null ? (ignoredId, ignoredDelta) -> { } : handler;
    }

    public void onShortRestRequested(Runnable handler) {
        shortRestRequestedHandler = handler == null ? () -> { } : handler;
    }

    public void onLongRestRequested(Runnable handler) {
        longRestRequestedHandler = handler == null ? () -> { } : handler;
    }

    private void configureStaticControls() {
        reserveSearchField.setPromptText(PartyTopBarVocabulary.RESERVE_SEARCH_PROMPT);
        reserveSearchField.setAccessibleText(PartyTopBarVocabulary.RESERVE_SEARCH_ACCESSIBLE);
        reserveSearchField.textProperty().addListener((ignored, before, after) ->
                rosterEvents.publishReserveSearchChanged(after));
        shortRestButton.setAccessibleText("Short Rest, fuer die aktive Party ausfuehren");
        longRestButton.setAccessibleText("Long Rest, fuer die aktive Party ausfuehren");
        shortRestButton.setOnAction(event -> rosterEvents.publishShortRestRequested());
        longRestButton.setOnAction(event -> rosterEvents.publishLongRestRequested());
        ((StyledHBox) restActionsPane).setNodes(shortRestButton, longRestButton);
        newCharacterButton.setMaxWidth(Double.MAX_VALUE);
        newCharacterButton.setAccessibleText(PartyTopBarVocabulary.NEW_CHARACTER_ACCESSIBLE);
        newCharacterButton.setOnAction(event -> rosterEvents.publishCreateEditorRequested());
        actionStatusLabel.setWrapText(true);
        actionStatusLabel.setAccessibleRole(AccessibleRole.TEXT);
        actionStatusLabel.setFocusTraversable(false);
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);
    }

    private void showPanel(PartyTopBarViewModel.PanelContent content) {
        if (content == null || content.loading()) {
            showLoadingPanel();
            return;
        }
        boolean actionsDisabled = content.actionsDisabled();
        rosterRows.showMemberList(content, actionsDisabled);
        rosterRows.showReserveList(content, actionsDisabled);
        showPanelActions(content, actionsDisabled);
        showSummaries(content);
        showActionStatus(content);
    }

    private void showPanelActions(PartyTopBarViewModel.PanelContent content, boolean actionsDisabled) {
        boolean restDisabled = content.restActionsDisabled() || actionsDisabled;
        shortRestButton.setDisable(restDisabled);
        longRestButton.setDisable(restDisabled);
        newCharacterButton.setDisable(actionsDisabled);
    }

    private void showSummaries(PartyTopBarViewModel.PanelContent content) {
        summaryLabel.setText(safe(content.summaryText()));
        restSummaryLabel.setText(safe(content.restSummaryText()));
    }

    private void showActionStatus(PartyTopBarViewModel.PanelContent content) {
        String actionStatus = safe(content.actionStatus());
        boolean hasActionStatus = !actionStatus.isBlank();
        actionStatusLabel.setText(actionStatus);
        actionStatusLabel.setAccessibleText(actionStatus);
        actionStatusLabel.setVisible(hasActionStatus);
        actionStatusLabel.setManaged(hasActionStatus);
        actionStatusLabel.setFocusTraversable(hasActionStatus);
        ((StyledLabel) actionStatusLabel).replaceStyleClasses(
                content.actionStatusError() ? "text-warning" : STYLE_TEXT_MUTED,
                "text-warning",
                STYLE_TEXT_MUTED);
    }

    private void showLoadingPanel() {
        ((StyledVBox) memberListPane).setNodes(PartyRosterChrome.messageLabel(PartyTopBarVocabulary.LOADING));
        ((StyledVBox) reserveListPane).clearNodes();
        shortRestButton.setDisable(true);
        longRestButton.setDisable(true);
        newCharacterButton.setDisable(true);
        summaryLabel.setText(PartyTopBarVocabulary.LOADING);
        restSummaryLabel.setText("");
        actionStatusLabel.setText("");
        actionStatusLabel.setAccessibleText("");
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);
        actionStatusLabel.setFocusTraversable(false);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private final class RosterRows {

        private void showMemberList(PartyTopBarViewModel.PanelContent content, boolean actionsDisabled) {
            ((StyledVBox) memberListPane).clearNodes();
            if (content.storageError()) {
                ((StyledVBox) memberListPane).setNodes(PartyRosterChrome.messageLabel(content.storageMessage()));
                return;
            }
            if (content.activeMembers().isEmpty()) {
                ((StyledVBox) memberListPane).setNodes(PartyRosterChrome.messageLabel(PartyTopBarVocabulary.EMPTY_ACTIVE));
                return;
            }
            for (PartyTopBarViewModel.MemberModel member : content.activeMembers()) {
                ((StyledVBox) memberListPane).addNode(memberRow(member, actionsDisabled));
            }
        }

        private void showReserveList(PartyTopBarViewModel.PanelContent content, boolean actionsDisabled) {
            ((StyledVBox) reserveListPane).clearNodes();
            if (content.allReserveMembers().isEmpty()) {
                ((StyledVBox) reserveListPane).setNodes(PartyRosterChrome.messageLabel(PartyTopBarVocabulary.NO_RESERVE));
                return;
            }
            if (content.reserveMembers().isEmpty()) {
                ((StyledVBox) reserveListPane).setNodes(PartyRosterChrome.messageLabel(PartyTopBarVocabulary.NO_RESERVE_MATCH));
                return;
            }
            for (PartyTopBarViewModel.MemberModel member : content.reserveMembers()) {
                ((StyledVBox) reserveListPane).addNode(reserveMemberButton(member, actionsDisabled));
            }
        }

        private Node memberRow(PartyTopBarViewModel.MemberModel member, boolean actionsDisabled) {
            Label identityLabel = PartyRosterChrome.clippedLabel(member.identityText(), "bold");
            HBox.setHgrow(identityLabel, Priority.ALWAYS);

            Button xpDownButton = memberActionButton(
                    member.id(),
                    "-XP",
                    STYLE_NEUTRAL_ACTION,
                    "-XP, " + member.name() + " XP verringern",
                    "XP verringern",
                    actionsDisabled,
                    true);
            xpDownButton.setOnAction(event -> rosterEvents.publishXp(event, -XP_ADJUSTMENT_STEP));

            Button xpUpButton = memberActionButton(
                    member.id(),
                    "+XP",
                    STYLE_ACCENT,
                    "+XP, " + member.name() + " XP erhoehen",
                    "XP erhoehen",
                    actionsDisabled,
                    true);
            xpUpButton.setOnAction(event -> rosterEvents.publishXp(event, XP_ADJUSTMENT_STEP));

            HBox progressRow = new StyledHBox(
                    "party-level-progress-row",
                    5,
                    new Label(member.levelLabel()),
                    PartyRosterChrome.clippedLabel(member.levelProgressText(), STYLE_TEXT_SECONDARY),
                    new Label(member.nextLevelLabel()),
                    xpDownButton,
                    xpUpButton);
            progressRow.setAlignment(Pos.CENTER_LEFT);

            Button editButton = memberActionButton(
                    member.id(),
                    "Edit",
                    STYLE_ACCENT,
                    "Edit, Charakter bearbeiten: " + member.name(),
                    "Charakter bearbeiten",
                    actionsDisabled,
                    false);
            editButton.setOnAction(rosterEvents::publishEditRequested);

            Button removeButton = memberActionButton(
                    member.id(),
                    "Entfernen",
                    STYLE_NEUTRAL_ACTION,
                    "Entfernen, aus aktiver Party entfernen: " + member.name(),
                    "Aus aktiver Party entfernen",
                    actionsDisabled,
                    false);
            removeButton.setOnAction(rosterEvents::publishRemoveRequested);

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox managementActions = new HBox(6, editButton, removeButton);
            managementActions.setAlignment(Pos.CENTER_RIGHT);

            HBox headerRow = new HBox(8, identityLabel, progressRow);
            headerRow.setAlignment(Pos.CENTER_LEFT);
            headerRow.setMaxWidth(Double.MAX_VALUE);

            HBox actionRow = new HBox(
                    8,
                    PartyRosterChrome.clippedLabel(member.combatText(), STYLE_TEXT_SECONDARY),
                    PartyRosterChrome.restChipLabel(member),
                    spacer,
                    managementActions);
            actionRow.setAlignment(Pos.CENTER_LEFT);
            actionRow.setMaxWidth(Double.MAX_VALUE);

            VBox row = new StyledVBox("party-row", headerRow, actionRow);
            row.setMaxWidth(Double.MAX_VALUE);
            return row;
        }

        private Button reserveMemberButton(PartyTopBarViewModel.MemberModel member, boolean actionsDisabled) {
            Button button = memberActionButton(
                    member.id(),
                    member.name() + " (" + member.levelLabel() + ")",
                    STYLE_NEUTRAL_ACTION,
                    member.name() + " (" + member.levelLabel() + "), zur aktiven Party hinzufuegen",
                    "Zur aktiven Party hinzufuegen",
                    actionsDisabled,
                    false);
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(rosterEvents::publishAddExistingRequested);
            return button;
        }

        private Button memberActionButton(
                Long memberId,
                String text,
                String actionStyle,
                String accessibleText,
                String tooltipText,
                boolean disabled,
                boolean iconSized
        ) {
            Button button = PartyRosterChrome.actionButton(
                    text,
                    actionStyle,
                    accessibleText,
                    tooltipText,
                    disabled,
                    iconSized);
            button.setUserData(memberId);
            return button;
        }
    }

    private final class RosterEvents {

        private void publishReserveSearchChanged(String reserveSearchText) {
            reserveSearchChangedHandler.accept(safe(reserveSearchText));
        }

        private void publishShortRestRequested() {
            shortRestRequestedHandler.run();
        }

        private void publishLongRestRequested() {
            longRestRequestedHandler.run();
        }

        private void publishCreateEditorRequested() {
            createEditorRequestedHandler.run();
        }

        private void publishEditRequested(ActionEvent event) {
            editEditorRequestedHandler.accept(memberId(event));
        }

        private void publishAddExistingRequested(ActionEvent event) {
            addExistingRequestedHandler.accept(memberId(event));
        }

        private void publishRemoveRequested(ActionEvent event) {
            removeRequestedHandler.accept(memberId(event));
        }

        private void publishXp(ActionEvent event, int xpDelta) {
            xpRequestedHandler.accept(memberId(event), xpDelta);
        }

        private long memberId(ActionEvent event) {
            Object source = event.getSource();
            Object userData = source instanceof Node node ? node.getUserData() : null;
            return userData instanceof Long id ? id : 0L;
        }
    }

    private static final class PartyRosterChrome {

        private static Button actionButton(
                String text,
                String actionStyle,
                String accessibleText,
                String tooltipText,
                boolean disabled,
                boolean iconSized
        ) {
            StyledButton button = new StyledButton(text, STYLE_COMPACT, actionStyle);
            if (iconSized) {
                button.addStyle("icon-button");
            }
            button.setAccessibleText(accessibleText);
            button.setTooltip(new Tooltip(tooltipText));
            button.setDisable(disabled);
            return button;
        }

        private static Label clippedLabel(String text, String styleClass) {
            Label label = new StyledLabel(safe(text), styleClass);
            label.setWrapText(false);
            label.setTextOverrun(OverrunStyle.ELLIPSIS);
            label.setMinWidth(0);
            label.setMaxWidth(Double.MAX_VALUE);
            label.setTooltip(new Tooltip(safe(text)));
            return label;
        }

        private static Label restChipLabel(PartyTopBarViewModel.MemberModel member) {
            StyledLabel label = new StyledLabel(member.restText(), "party-rest-chip");
            if (!member.restStyleClass().isBlank()) {
                label.addStyle(member.restStyleClass());
            }
            return label;
        }

        private static Label sectionLabel(String text) {
            return new StyledLabel(text, "section-header", STYLE_TEXT_MUTED);
        }

        private static Label messageLabel(String text) {
            Label label = new StyledLabel(safe(text), STYLE_TEXT_MUTED, "party-message-label");
            label.setWrapText(true);
            return label;
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel() {
        }

        private StyledLabel(String styleClass) {
            getStyleClass().add(styleClass);
        }

        private StyledLabel(String text, String firstStyleClass, String... additionalStyleClasses) {
            super(text);
            getStyleClass().add(firstStyleClass);
            getStyleClass().addAll(additionalStyleClasses);
        }

        private void addStyle(String styleClass) {
            getStyleClass().add(styleClass);
        }

        private void replaceStyleClasses(String replacement, String... removedStyleClasses) {
            getStyleClass().removeAll(removedStyleClasses);
            getStyleClass().add(replacement);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }

        private void addStyle(String styleClass) {
            getStyleClass().add(styleClass);
        }
    }

    private static final class StyledTextField extends TextField {

        private StyledTextField(String styleClass) {
            getStyleClass().add(styleClass);
        }
    }

    private static final class StyledHBox extends HBox {

        private StyledHBox(String styleClass) {
            getStyleClass().add(styleClass);
        }

        private StyledHBox(String styleClass, double spacing, Node... children) {
            super(spacing, children);
            getStyleClass().add(styleClass);
        }

        private void setNodes(Node... nodes) {
            getChildren().setAll(nodes);
        }
    }

    private static final class StyledVBox extends VBox {

        private StyledVBox(String styleClass, Node... children) {
            super(children);
            getStyleClass().add(styleClass);
        }

        private void addNode(Node child) {
            getChildren().add(child);
        }

        private void setNodes(Node... nodes) {
            getChildren().setAll(nodes);
        }

        private void clearNodes() {
            getChildren().clear();
        }
    }
}
