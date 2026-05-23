package src.view.leftbartabs.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.ObservableList;
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

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class SessionPlannerControlsView extends ScrollPane {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String XP_SUFFIX = " XP";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";

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
    private final Label milestonesLabel = label("", STYLE_TEXT_SECONDARY);
    private final Label summaryLabel = label("", "session-planner-budget-summary");
    private final ProgressBar budgetBar = budgetBar();
    private final Label restAdviceLabel = label("");
    private final Label goldHeadlineLabel = label("");
    private final Label goldDetailLabel = label("", STYLE_TEXT_SECONDARY);
    private final VBox plansBox = new VBox(6);
    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerControlsView() {
        setContent(content());
        style(this, "session-planner-controls-scroll");
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
        style(content, "session-planner-controls");
        content.getChildren().addAll(
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
        Button createButton = button("Neue Session", ignored -> publish(
                new SessionPlannerControlsViewInputEvent(true, 0L, 0L, "", 0L)), STYLE_COMPACT, "accent");
        Button applyDaysButton = button("Tage setzen", ignored -> publish(
                new SessionPlannerControlsViewInputEvent(
                        false,
                        0L,
                        0L,
                        encounterDaysField.getText(),
                        0L)), STYLE_COMPACT, "flat");
        encounterDaysField.setPromptText("1.0");
        HBox daysRow = new HBox(6,
                label("Encounter Days", "session-planner-card-title"),
                encounterDaysField,
                applyDaysButton);
        HBox.setHgrow(encounterDaysField, Priority.ALWAYS);
        return new VBox(10,
                headerRow(label("SESSION PLANNER", "section-header", "text-muted"), createButton),
                sectionCard("Session", sessionIdLabel, selectionLabel, daysRow));
    }

    private VBox budgetSection() {
        VBox root = sectionCard(
                "XP-Budget",
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                summaryLabel,
                milestonesLabel);
        return root;
    }

    private void show(SessionPlannerControlsContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        statusLabel.setText(projection.statusText());
        showSession(projection.session());
        partyHeadlineLabel.setText(projection.party().headline());
        partyDetailLabel.setText(projection.party().detail());
        showMembers(projection.activePartyMembers());
        showParticipants(projection.sessionParticipants());
        showBudget(projection.budget());
        restAdviceLabel.setText(projection.restAdvice().summaryText());
        goldHeadlineLabel.setText(projection.goldBudget().headline());
        goldDetailLabel.setText(projection.goldBudget().detail());
        showPlans(projection.availablePlans());
    }

    private void showSession(SessionPlannerControlsContentModel.Projection.SessionModel model) {
        sessionIdLabel.setText("Session #" + Math.max(0L, model.sessionId()));
        selectionLabel.setText(model.selectionText());
        encounterDaysField.setText(model.encounterDaysText());
    }

    private void showMembers(List<SessionPlannerControlsContentModel.Projection.PartyMemberModel> members) {
        if (members.isEmpty()) {
            activePartyRows.getChildren().setAll(label(
                    "Keine aktiven Party-Mitglieder verfuegbar.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        activePartyRows.getChildren().setAll(memberRows(members));
    }

    private List<Node> memberRows(List<SessionPlannerControlsContentModel.Projection.PartyMemberModel> members) {
        List<Node> rows = new ArrayList<>();
        for (SessionPlannerControlsContentModel.Projection.PartyMemberModel member : members) {
            rows.add(memberRow(member));
        }
        return rows;
    }

    private Node memberRow(SessionPlannerControlsContentModel.Projection.PartyMemberModel member) {
        Button addButton = button(
                member.alreadyInSession() ? "Schon in Session" : "Hinzufuegen",
                this::publishAddParticipant,
                STYLE_COMPACT,
                member.alreadyInSession() ? "flat" : "accent");
        addButton.setUserData(Long.valueOf(member.characterId()));
        addButton.setDisable(member.alreadyInSession());
        VBox labels = new VBox(
                label(member.name(), "session-planner-plan-name"),
                label("Level " + member.level(), STYLE_TEXT_SECONDARY));
        HBox row = new HBox(8, labels, spacer(), addButton);
        row.setAlignment(Pos.CENTER_LEFT);
        style(row, "session-planner-plan-card");
        return row;
    }

    private void showParticipants(
            List<SessionPlannerControlsContentModel.Projection.SessionParticipantModel> participants
    ) {
        if (participants.isEmpty()) {
            sessionParticipantsRows.getChildren().setAll(label(
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
        for (SessionPlannerControlsContentModel.Projection.SessionParticipantModel participant : participants) {
            rows.add(participantRow(participant));
        }
        return rows;
    }

    private Node participantRow(SessionPlannerControlsContentModel.Projection.SessionParticipantModel participant) {
        Button removeButton = button("Entfernen", this::publishRemoveParticipant, STYLE_COMPACT, "flat");
        removeButton.setUserData(Long.valueOf(participant.characterId()));
        removeButton.setDisable(!participant.removable());
        VBox labels = new VBox(
                label(participant.name(), "session-planner-plan-name"),
                label(participant.detail(), participant.available() ? STYLE_TEXT_SECONDARY : "session-planner-gap-active"));
        HBox row = new HBox(8, labels, spacer(), removeButton);
        row.setAlignment(Pos.CENTER_LEFT);
        style(row, "session-planner-plan-card");
        return row;
    }

    private void showBudget(SessionPlannerControlsContentModel.Projection.BudgetModel model) {
        totalBudgetLabel.setText("Budget " + model.totalBudgetText() + XP_SUFFIX);
        plannedXpLabel.setText("Geplant " + model.plannedXpText() + XP_SUFFIX);
        remainingXpLabel.setText(model.overBudget()
                ? model.overBudgetText() + XP_SUFFIX + " ueber"
                : model.remainingXpText() + XP_SUFFIX + " frei");
        summaryLabel.setText(model.summaryText());
        milestonesLabel.setText(model.milestonesText());
        budgetBar.setProgress(Math.max(0.0, Math.min(1.0, model.progressFraction())));
        ObservableList<String> styleClasses = budgetBar.getStyleClass();
        styleClasses.removeAll(STYLE_BUDGET_OK, STYLE_BUDGET_OVER);
        styleClasses.add(model.overBudget() ? STYLE_BUDGET_OVER : STYLE_BUDGET_OK);
    }

    private void showPlans(List<SessionPlannerControlsContentModel.Projection.AvailablePlanModel> plans) {
        if (plans.isEmpty()) {
            plansBox.getChildren().setAll(label(
                    "Keine gespeicherten Encounter-Plaene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        plansBox.getChildren().setAll(planCards(plans));
    }

    private List<Node> planCards(List<SessionPlannerControlsContentModel.Projection.AvailablePlanModel> plans) {
        List<Node> cards = new ArrayList<>();
        for (SessionPlannerControlsContentModel.Projection.AvailablePlanModel plan : plans) {
            cards.add(planCard(plan));
        }
        return cards;
    }

    private Node planCard(SessionPlannerControlsContentModel.Projection.AvailablePlanModel plan) {
        Button importButton = button("An Session anhaengen", this::publishAttachPlan, STYLE_COMPACT, "accent");
        importButton.setUserData(Long.valueOf(plan.planId()));
        importButton.setDisable(!plan.importEnabled());
        VBox card = new VBox(4,
                label(plan.name(), "session-planner-plan-name"),
                label(plan.summaryText(), STYLE_TEXT_SECONDARY),
                label(plan.statusText(), STYLE_TEXT_SECONDARY),
                importButton);
        style(card, "session-planner-plan-card");
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
        Label label = new Label(text);
        label.setWrapText(true);
        style(label, styleClasses);
        return label;
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
        Button button = new Button(text);
        style(button, styleClasses);
        button.setOnAction(action);
        return button;
    }

    private static ProgressBar budgetBar() {
        ProgressBar progressBar = new ProgressBar(0.0);
        style(progressBar, "session-planner-budget-bar");
        return progressBar;
    }

    private static HBox headerRow(Node titleLabel, Node... actionButtons) {
        HBox row = new HBox(8);
        row.getChildren().add(titleLabel);
        row.getChildren().add(spacer());
        row.getChildren().addAll(actionButtons);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private static VBox sectionCard(String title, Node... body) {
        VBox card = new VBox(4);
        card.getChildren().add(label(title, "session-planner-card-title"));
        card.getChildren().addAll(body);
        style(card, "session-planner-card");
        return card;
    }

    private static void style(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }
}
