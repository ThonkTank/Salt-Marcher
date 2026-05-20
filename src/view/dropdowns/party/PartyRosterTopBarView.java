package src.view.dropdowns.party;

import java.util.Objects;
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

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class PartyRosterTopBarView extends VBox {

    private static final int XP_ADJUSTMENT_STEP = 100;
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_NEUTRAL_ACTION = "neutral-action";

    private final VBox memberListPane = new VBox();
    private final HBox restActionsPane = new HBox();
    private final VBox reserveListPane = new VBox();
    private final TextField reserveSearchField = new TextField();
    private final Button shortRestButton = new Button("Short Rest");
    private final Button longRestButton = new Button("Long Rest");
    private final Button newCharacterButton = new Button("+ Neuer Charakter");
    private final Label summaryLabel = new Label();
    private final Label restSummaryLabel = new Label();
    private final Label actionStatusLabel = new Label();
    private Consumer<PartyRosterTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyRosterTopBarView() {
        getStyleClass().add("party-roster-panel");
        setFillWidth(true);
        configureStaticControls();
        getChildren().addAll(
                sectionLabel("AKTUELLE PARTY"),
                memberListPane,
                restActionsPane,
                new Separator(),
                sectionLabel("CHARAKTER HINZUFUEGEN"),
                reserveSearchField,
                reserveListPane,
                newCharacterButton,
                summaryLabel,
                restSummaryLabel,
                actionStatusLabel);
    }

    public void bind(PartyRosterTopBarContentModel contentModel) {
        PartyRosterTopBarContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        showPanel(safeModel.panelContentProperty().get());
        safeModel.panelContentProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    public void onViewInputEvent(Consumer<PartyRosterTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureStaticControls() {
        memberListPane.getStyleClass().add("party-list");
        reserveListPane.getStyleClass().add("party-search");
        reserveSearchField.getStyleClass().add("party-search-field");
        reserveSearchField.setPromptText("Reserve durchsuchen");
        reserveSearchField.setAccessibleText("Reserve-Charaktere durchsuchen");
        reserveSearchField.textProperty().addListener((ignored, before, after) -> publish(new PartyRosterTopBarViewInputEvent(
                false,
                false,
                false,
                0L,
                0,
                false,
                false,
                false,
                true,
                after)));
        restActionsPane.getStyleClass().add("party-rest-actions");
        shortRestButton.getStyleClass().add(STYLE_COMPACT);
        longRestButton.getStyleClass().add(STYLE_COMPACT);
        shortRestButton.setAccessibleText("Short Rest, fuer die aktive Party ausfuehren");
        longRestButton.setAccessibleText("Long Rest, fuer die aktive Party ausfuehren");
        shortRestButton.setOnAction(event -> publish(new PartyRosterTopBarViewInputEvent(
                false,
                false,
                false,
                0L,
                0,
                false,
                true,
                false,
                false,
                "")));
        longRestButton.setOnAction(event -> publish(new PartyRosterTopBarViewInputEvent(
                false,
                false,
                false,
                0L,
                0,
                false,
                false,
                true,
                false,
                "")));
        restActionsPane.getChildren().addAll(shortRestButton, longRestButton);
        newCharacterButton.setMaxWidth(Double.MAX_VALUE);
        newCharacterButton.setAccessibleText("+ Neuer Charakter, neuen Charakter erstellen");
        newCharacterButton.setOnAction(event -> publish(new PartyRosterTopBarViewInputEvent(
                true,
                false,
                false,
                0L,
                0,
                false,
                false,
                false,
                false,
                "")));
        summaryLabel.getStyleClass().add("party-summary");
        restSummaryLabel.getStyleClass().add("party-summary-rest");
        actionStatusLabel.setWrapText(true);
        actionStatusLabel.setAccessibleRole(AccessibleRole.TEXT);
        actionStatusLabel.setFocusTraversable(false);
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);
    }

    private void showPanel(PartyRosterTopBarContentModel.PanelContent content) {
        if (content == null || content.loading()) {
            showLoadingPanel();
            return;
        }
        boolean actionsDisabled = content.actionsDisabled();
        memberListPane.getChildren().clear();
        reserveListPane.getChildren().clear();
        if (content.storageError()) {
            memberListPane.getChildren().add(messageLabel(content.storageMessage()));
        } else if (content.activeMembers().isEmpty()) {
            memberListPane.getChildren().add(messageLabel("Keine aktiven Party-Mitglieder"));
        } else {
            for (PartyRosterTopBarContentModel.MemberModel member : content.activeMembers()) {
                memberListPane.getChildren().add(memberRow(member, actionsDisabled));
            }
        }
        if (content.allReserveMembers().isEmpty()) {
            reserveListPane.getChildren().add(messageLabel("Keine Reserve-Charaktere"));
        } else if (content.reserveMembers().isEmpty()) {
            reserveListPane.getChildren().add(messageLabel("Keine Treffer in der Reserve"));
        } else {
            for (PartyRosterTopBarContentModel.MemberModel member : content.reserveMembers()) {
                reserveListPane.getChildren().add(reserveMemberButton(member, actionsDisabled));
            }
        }
        shortRestButton.setDisable(content.restActionsDisabled() || actionsDisabled);
        longRestButton.setDisable(content.restActionsDisabled() || actionsDisabled);
        newCharacterButton.setDisable(actionsDisabled);
        summaryLabel.setText(safe(content.summaryText()));
        restSummaryLabel.setText(safe(content.restSummaryText()));
        String actionStatus = safe(content.actionStatus());
        boolean hasActionStatus = !actionStatus.isBlank();
        actionStatusLabel.setText(actionStatus);
        actionStatusLabel.setAccessibleText(actionStatus);
        actionStatusLabel.setVisible(hasActionStatus);
        actionStatusLabel.setManaged(hasActionStatus);
        actionStatusLabel.setFocusTraversable(hasActionStatus);
        actionStatusLabel.getStyleClass().removeAll("text-warning", STYLE_TEXT_MUTED);
        actionStatusLabel.getStyleClass().add(content.actionStatusError() ? "text-warning" : STYLE_TEXT_MUTED);
    }

    private void showLoadingPanel() {
        memberListPane.getChildren().setAll(messageLabel("Lade..."));
        reserveListPane.getChildren().clear();
        shortRestButton.setDisable(true);
        longRestButton.setDisable(true);
        newCharacterButton.setDisable(true);
        summaryLabel.setText("Lade...");
        restSummaryLabel.setText("");
        actionStatusLabel.setText("");
        actionStatusLabel.setAccessibleText("");
        actionStatusLabel.setVisible(false);
        actionStatusLabel.setManaged(false);
        actionStatusLabel.setFocusTraversable(false);
    }

    private Node memberRow(PartyRosterTopBarContentModel.MemberModel member, boolean actionsDisabled) {
        Label identityLabel = clippedLabel(member.identityText(), "bold");
        HBox.setHgrow(identityLabel, Priority.ALWAYS);

        Button xpDownButton = actionButton(
                "-XP",
                STYLE_NEUTRAL_ACTION,
                "-XP, " + member.name() + " XP verringern",
                "XP verringern",
                actionsDisabled,
                true);
        xpDownButton.setUserData(member.id());
        xpDownButton.setOnAction(event -> publishXp(event, -XP_ADJUSTMENT_STEP));

        Button xpUpButton = actionButton(
                "+XP",
                STYLE_ACCENT,
                "+XP, " + member.name() + " XP erhoehen",
                "XP erhoehen",
                actionsDisabled,
                true);
        xpUpButton.setUserData(member.id());
        xpUpButton.setOnAction(event -> publishXp(event, XP_ADJUSTMENT_STEP));

        HBox progressRow = new HBox(
                5,
                new Label(member.levelLabel()),
                clippedLabel(member.levelProgressText(), STYLE_TEXT_SECONDARY),
                new Label(member.nextLevelLabel()),
                xpDownButton,
                xpUpButton);
        progressRow.setAlignment(Pos.CENTER_LEFT);
        progressRow.getStyleClass().add("party-level-progress-row");

        Button editButton = actionButton(
                "Edit",
                STYLE_ACCENT,
                "Edit, Charakter bearbeiten: " + member.name(),
                "Charakter bearbeiten",
                actionsDisabled,
                false);
        editButton.setUserData(member.id());
        editButton.setOnAction(event -> publishMemberEvent(event, false, true, false, 0, false));

        Button removeButton = actionButton(
                "Entfernen",
                STYLE_NEUTRAL_ACTION,
                "Entfernen, aus aktiver Party entfernen: " + member.name(),
                "Aus aktiver Party entfernen",
                actionsDisabled,
                false);
        removeButton.setUserData(member.id());
        removeButton.setOnAction(event -> publishMemberEvent(event, false, false, false, 0, true));

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox managementActions = new HBox(6, editButton, removeButton);
        managementActions.setAlignment(Pos.CENTER_RIGHT);

        HBox headerRow = new HBox(8, identityLabel, progressRow);
        headerRow.setAlignment(Pos.CENTER_LEFT);
        headerRow.setMaxWidth(Double.MAX_VALUE);

        HBox actionRow = new HBox(
                8,
                clippedLabel(member.combatText(), STYLE_TEXT_SECONDARY),
                restChipLabel(member),
                spacer,
                managementActions);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        actionRow.setMaxWidth(Double.MAX_VALUE);

        VBox row = new VBox(headerRow, actionRow);
        row.getStyleClass().add("party-row");
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private Node reserveMemberButton(PartyRosterTopBarContentModel.MemberModel member, boolean actionsDisabled) {
        Button button = actionButton(
                member.name() + " (" + member.levelLabel() + ")",
                STYLE_NEUTRAL_ACTION,
                member.name() + " (" + member.levelLabel() + "), zur aktiven Party hinzufuegen",
                "Zur aktiven Party hinzufuegen",
                actionsDisabled,
                false);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setUserData(member.id());
        button.setOnAction(event -> publishMemberEvent(event, false, false, true, 0, false));
        return button;
    }

    private void publishMemberEvent(
            ActionEvent event,
            boolean createEditorRequested,
            boolean editEditorRequested,
            boolean addExistingRequested,
            int xpDelta,
            boolean removeRequested
    ) {
        Object source = event.getSource();
        Object userData = source instanceof Node node ? node.getUserData() : null;
        publish(new PartyRosterTopBarViewInputEvent(
                createEditorRequested,
                editEditorRequested,
                addExistingRequested,
                userData instanceof Long memberId ? memberId : 0L,
                xpDelta,
                removeRequested,
                false,
                false,
                false,
                ""));
    }

    private void publishXp(ActionEvent event, int xpDelta) {
        Object source = event.getSource();
        Object userData = source instanceof Node node ? node.getUserData() : null;
        publish(new PartyRosterTopBarViewInputEvent(
                false,
                false,
                false,
                userData instanceof Long memberId ? memberId : 0L,
                xpDelta,
                false,
                false,
                false,
                false,
                ""));
    }

    private void publish(PartyRosterTopBarViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static Button actionButton(
            String text,
            String actionStyle,
            String accessibleText,
            String tooltipText,
            boolean disabled,
            boolean iconSized
    ) {
        Button button = new Button(text);
        button.getStyleClass().addAll(STYLE_COMPACT, actionStyle);
        if (iconSized) {
            button.getStyleClass().add("icon-button");
        }
        button.setAccessibleText(accessibleText);
        button.setTooltip(new Tooltip(tooltipText));
        button.setDisable(disabled);
        return button;
    }

    private static Label clippedLabel(String text, String styleClass) {
        Label label = new Label(safe(text));
        label.getStyleClass().add(styleClass);
        label.setWrapText(false);
        label.setTextOverrun(OverrunStyle.ELLIPSIS);
        label.setMinWidth(0);
        label.setMaxWidth(Double.MAX_VALUE);
        label.setTooltip(new Tooltip(safe(text)));
        return label;
    }

    private static Label restChipLabel(PartyRosterTopBarContentModel.MemberModel member) {
        Label label = new Label(member.restText());
        label.getStyleClass().add("party-rest-chip");
        if (!member.restStyleClass().isBlank()) {
            label.getStyleClass().add(member.restStyleClass());
        }
        return label;
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", STYLE_TEXT_MUTED);
        return label;
    }

    private static Label messageLabel(String text) {
        Label label = new Label(safe(text));
        label.getStyleClass().addAll(STYLE_TEXT_MUTED, "party-message-label");
        label.setWrapText(true);
        return label;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
