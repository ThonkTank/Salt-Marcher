package src.view.leftbartabs.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerControlsView extends ScrollPane {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";

    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private final Label statusLabel = statusLabel();
    private final Label sessionIdLabel = label("");
    private final Label selectionLabel = label("", STYLE_TEXT_SECONDARY);
    private final TextField encounterDaysField = new TextField();
    private final Label partyHeadlineLabel = label("");
    private final Label partyDetailLabel = label("", STYLE_TEXT_SECONDARY);
    private final VBox sessionParticipantsRows = new VBox(6);
    private final VBox activePartyRows = new VBox(6);
    private final Label totalBudgetLabel = label("");
    private final Label plannedXpLabel = label("");
    private final Label remainingXpLabel = label("");
    private final ProgressBar budgetBar = budgetBar();
    private final Label summaryLabel = label("", "session-planner-budget-summary");
    private final Label milestonesLabel = label("", STYLE_TEXT_SECONDARY);
    private final Label restAdviceLabel = label("");
    private final Label goldHeadlineLabel = label("");
    private final Label goldDetailLabel = label("", STYLE_TEXT_SECONDARY);
    private final VBox plansBox = new VBox(6);

    public SessionPlannerControlsView() {
        setContent(content());
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void onViewInputEvent(Consumer<SessionPlannerControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(SessionPlannerControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
        show(contentModel.projectionProperty().get());
    }

    private VBox content() {
        VBox content = new VBox(12);
        addStyles(content, "session-planner-controls");
        addNodes(
                content,
                sessionSection(),
                statusLabel,
                sectionCard("Session-Ueberblick", partyHeadlineLabel, partyDetailLabel),
                sectionCard("Session-Teilnehmer", sessionParticipantsRows),
                sectionCard("Aktive Party", activePartyRows),
                budgetSection(),
                sectionCard("Rastempfehlung", restAdviceLabel),
                sectionCard("Gold & Loot", goldHeadlineLabel, goldDetailLabel),
                sectionCard("Gespeicherte Encounter", plansBox));
        return content;
    }

    private VBox sessionSection() {
        Button createButton = button(
                "Neue Session",
                ignored -> publish(new SessionPlannerControlsViewInputEvent(true, 0L, 0L, "", 0L)),
                STYLE_COMPACT,
                "accent");
        Button applyDaysButton = button(
                "Tage setzen",
                ignored -> publish(new SessionPlannerControlsViewInputEvent(
                        false,
                        0L,
                        0L,
                        encounterDaysField.getText(),
                        0L)),
                STYLE_COMPACT,
                "flat");
        encounterDaysField.setPromptText("1.0");
        return new VBox(
                10,
                headerRow(label("SESSION PLANNER", "section-header", "text-muted"), createButton),
                sectionCard(
                        "Session",
                        sessionIdLabel,
                        selectionLabel,
                        new GrowingFieldRow(
                                label("Encounter Days", "session-planner-card-title"),
                                encounterDaysField,
                                applyDaysButton)));
    }

    private VBox budgetSection() {
        return sectionCard(
                "XP-Budget",
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                summaryLabel,
                milestonesLabel);
    }

    private void show(SessionPlannerControlsContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        statusLabel.setText(projection.statusText());
        showSession(projection.session());
        var party = projection.party();
        partyHeadlineLabel.setText(party.headline());
        partyDetailLabel.setText(party.detail());
        showParticipants(projection.sessionParticipants());
        showMembers(projection.activePartyMembers());
        showBudget(projection.budget());
        restAdviceLabel.setText(projection.restAdvice().summaryText());
        var gold = projection.goldBudget();
        goldHeadlineLabel.setText(gold.headline());
        goldDetailLabel.setText(gold.detail());
        showPlans(projection.availablePlans());
    }

    private void showSession(SessionPlannerControlsContentModel.Projection.SessionModel model) {
        sessionIdLabel.setText(model.sessionIdText());
        selectionLabel.setText(model.selectionText());
        encounterDaysField.setText(model.encounterDaysText());
    }

    private void showParticipants(
            List<SessionPlannerControlsContentModel.Projection.SessionParticipantModel> participants
    ) {
        if (participants.isEmpty()) {
            setNodes(sessionParticipantsRows, label(
                    "Noch keine Teilnehmer in dieser Session.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        sessionParticipantsRows.getChildren().setAll(participantRows(participants));
    }

    private List<Node> participantRows(
            List<SessionPlannerControlsContentModel.Projection.SessionParticipantModel> participants
    ) {
        List<Node> rows = new ArrayList<>();
        for (var participant : participants) {
            rows.add(participantRow(participant));
        }
        return rows;
    }

    private Node participantRow(SessionPlannerControlsContentModel.Projection.SessionParticipantModel participant) {
        Button removeButton = button(
                participant.actionText(),
                this::publishRemoveParticipant,
                STYLE_COMPACT,
                "flat");
        removeButton.setUserData(Long.valueOf(participant.characterId()));
        removeButton.setDisable(participant.actionDisabled());
        VBox labels = new VBox(
                label(participant.name(), "session-planner-plan-name"),
                label(participant.detail(), participant.detailStyleClass()));
        ActionRow row = new ActionRow(8);
        row.addAllNodes(labels, spacer(), removeButton);
        row.addStyles("session-planner-plan-card");
        return row;
    }

    private void showMembers(List<SessionPlannerControlsContentModel.Projection.PartyMemberModel> members) {
        if (members.isEmpty()) {
            setNodes(activePartyRows, label(
                    "Keine aktiven Party-Mitglieder verfuegbar.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        activePartyRows.getChildren().setAll(memberRows(members));
    }

    private List<Node> memberRows(List<SessionPlannerControlsContentModel.Projection.PartyMemberModel> members) {
        List<Node> rows = new ArrayList<>();
        for (var member : members) {
            rows.add(memberRow(member));
        }
        return rows;
    }

    private Node memberRow(SessionPlannerControlsContentModel.Projection.PartyMemberModel member) {
        Button addButton = button(
                member.actionText(),
                this::publishAddParticipant,
                STYLE_COMPACT,
                member.actionStyleClass());
        addButton.setUserData(Long.valueOf(member.characterId()));
        addButton.setDisable(member.actionDisabled());
        VBox labels = new VBox(
                label(member.name(), "session-planner-plan-name"),
                label(member.detailText(), STYLE_TEXT_SECONDARY));
        ActionRow row = new ActionRow(8);
        row.addAllNodes(labels, spacer(), addButton);
        row.addStyles("session-planner-plan-card");
        return row;
    }

    private void showBudget(SessionPlannerControlsContentModel.Projection.BudgetModel model) {
        totalBudgetLabel.setText(model.totalBudgetLine());
        plannedXpLabel.setText(model.plannedXpLine());
        remainingXpLabel.setText(model.remainingXpLine());
        summaryLabel.setText(model.summaryText());
        milestonesLabel.setText(model.milestonesText());
        budgetBar.setProgress(Math.max(0.0, Math.min(1.0, model.progressFraction())));
        showBudgetStyle(model.budgetStyleClass());
    }

    private void showPlans(List<SessionPlannerControlsContentModel.Projection.AvailablePlanModel> plans) {
        if (plans.isEmpty()) {
            setNodes(plansBox, label(
                    "Keine gespeicherten Encounter-Plaene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        plansBox.getChildren().setAll(planCards(plans));
    }

    private List<Node> planCards(List<SessionPlannerControlsContentModel.Projection.AvailablePlanModel> plans) {
        List<Node> cards = new ArrayList<>();
        for (var plan : plans) {
            cards.add(planCard(plan));
        }
        return cards;
    }

    private Node planCard(SessionPlannerControlsContentModel.Projection.AvailablePlanModel plan) {
        Button importButton = button(
                plan.actionText(),
                this::publishAttachPlan,
                STYLE_COMPACT,
                plan.actionStyleClass());
        importButton.setUserData(Long.valueOf(plan.planId()));
        importButton.setDisable(plan.actionDisabled());
        VBox card = new VBox(
                4,
                label(plan.name(), "session-planner-plan-name"),
                label(plan.summaryText(), STYLE_TEXT_SECONDARY),
                label(plan.statusText(), STYLE_TEXT_SECONDARY),
                importButton);
        addStyles(card, "session-planner-plan-card");
        return card;
    }

    private void publishAddParticipant(ActionEvent event) {
        long participantId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            participantId = id.longValue();
        }
        publish(new SessionPlannerControlsViewInputEvent(false, participantId, 0L, "", 0L));
    }

    private void publishRemoveParticipant(ActionEvent event) {
        long participantId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            participantId = id.longValue();
        }
        publish(new SessionPlannerControlsViewInputEvent(false, 0L, participantId, "", 0L));
    }

    private void publishAttachPlan(ActionEvent event) {
        long planId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            planId = id.longValue();
        }
        publish(new SessionPlannerControlsViewInputEvent(false, 0L, 0L, "", planId));
    }

    private void publish(SessionPlannerControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static Label label(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private static Label statusLabel() {
        Label label = label("", STYLE_TEXT_SECONDARY, "session-planner-status");
        StringProperty text = label.textProperty();
        BooleanProperty managed = label.managedProperty();
        label.setVisible(false);
        text.addListener((ignored, before, after) -> label.setVisible(after != null && !after.isBlank()));
        managed.bind(label.visibleProperty());
        return label;
    }

    private static Button button(String text, EventHandler<ActionEvent> action, String... styleClasses) {
        Button button = new StyledButton(text, styleClasses);
        button.setOnAction(action);
        return button;
    }

    private static ProgressBar budgetBar() {
        ProgressBar progressBar = new ProgressBar(0.0);
        addStyles(progressBar, "session-planner-budget-bar");
        return progressBar;
    }

    private static ActionRow headerRow(Node titleLabel, Node... actionButtons) {
        ActionRow row = new ActionRow(8);
        row.addAllNodes(titleLabel, spacer());
        row.addAllNodes(actionButtons);
        return row;
    }

    private static VBox sectionCard(String title, Node... body) {
        VBox card = new VBox(4);
        addNodes(card, label(title, "session-planner-card-title"));
        addNodes(card, body);
        addStyles(card, "session-planner-card");
        return card;
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }

    private static void addNodes(VBox box, Node... children) {
        box.getChildren().addAll(children);
    }

    private static void setNodes(VBox box, Node child) {
        box.getChildren().setAll(child);
    }

    private static void addStyles(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    private void showBudgetStyle(String styleClass) {
        budgetBar.getStyleClass().removeAll(STYLE_BUDGET_OK, STYLE_BUDGET_OVER);
        budgetBar.getStyleClass().add(styleClass);
    }

    private static final class ActionRow extends HBox {

        private ActionRow(double spacing) {
            super(spacing);
            setAlignment(Pos.CENTER_LEFT);
        }

        private void addAllNodes(Node... children) {
            getChildren().addAll(children);
        }

        private void addStyles(String... styleClasses) {
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class GrowingFieldRow extends HBox {

        private GrowingFieldRow(Node label, TextField field, Button button) {
            super(6, label, field, button);
            setHgrow(field, Priority.ALWAYS);
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            setWrapText(true);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }
}
