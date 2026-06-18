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
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

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
    private final Button applyDaysButton = button(
            "Tage setzen",
            ignored -> publishEncounterDays(),
            STYLE_COMPACT,
            "flat");
    private final Label partyHeadlineLabel = label("");
    private final Label partyDetailLabel = label("", STYLE_TEXT_SECONDARY);
    private final ComboBox<String> partyMemberSelector = new ComboBox<>();
    private final Button addPartyMemberButton = button(
            "Hinzufuegen",
            this::publishSelectedParticipant,
            STYLE_COMPACT,
            "accent");
    private final VBox sessionParticipantsRows = new VBox(6);
    private final Label totalBudgetLabel = label("");
    private final Label plannedXpLabel = label("");
    private final Label remainingXpLabel = label("");
    private final ProgressBar budgetBar = budgetBar();
    private final Label summaryLabel = label("", "session-planner-budget-summary");
    private final Label milestonesLabel = label("", STYLE_TEXT_SECONDARY);
    private final Label restAdviceLabel = label("");
    private final VBox plansBox = new VBox(6);

    public SessionPlannerControlsView() {
        configurePartyMemberSelector();
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
                sectionCard("Gespeicherte Encounter", plansBox));
        return content;
    }

    private VBox sessionSection() {
        encounterDaysField.setPromptText("1.0");
        return new VBox(
                10,
                headerRow(label("SESSION PLANNER", "section-header", "text-muted")),
                sectionCard(
                        "Session-Setup",
                        sessionIdLabel,
                        selectionLabel,
                        new GrowingFieldRow(
                                label("Encounter Days", "session-planner-card-title"),
                                encounterDaysField,
                                applyDaysButton),
                        partyHeadlineLabel,
                        partyDetailLabel,
                        partySelectorRow(),
                        sessionParticipantsRows,
                        budgetSection(),
                        restAdviceLabel));
    }

    private VBox budgetSection() {
        VBox budget = new VBox(
                4,
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                summaryLabel,
                milestonesLabel);
        addStyles(budget, "session-planner-budget-summary");
        return budget;
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
        showMembers(projection.partyMemberSelectorValues(), projection.session().sessionActionsDisabled());
        showBudget(projection.budget());
        restAdviceLabel.setText(projection.restAdvice().summaryText());
        showPlans(projection.availablePlans());
    }

    private void showSession(SessionPlannerControlsContentModel.Projection.SessionModel model) {
        sessionIdLabel.setText(model.sessionIdText());
        selectionLabel.setText(model.selectionText());
        encounterDaysField.setText(model.encounterDaysText());
        encounterDaysField.setDisable(model.sessionActionsDisabled());
        applyDaysButton.setDisable(model.sessionActionsDisabled());
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

    private void showMembers(
            List<String> selectableMembers,
            boolean sessionActionsDisabled
    ) {
        String selected = partyMemberSelector.getValue();
        partyMemberSelector.getItems().setAll(selectableMembers);
        restoreSelection(selected, selectableMembers);
        boolean disabled = sessionActionsDisabled || selectableMembers.isEmpty();
        partyMemberSelector.setDisable(disabled);
        addPartyMemberButton.setDisable(disabled || partyMemberSelector.getValue() == null);
    }

    private void configurePartyMemberSelector() {
        partyMemberSelector.setMaxWidth(Double.MAX_VALUE);
        partyMemberSelector.setPromptText("Spieler auswaehlen");
        partyMemberSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(String value) {
                return partyMemberLabel(value);
            }

            @Override
            public String fromString(String text) {
                return text == null ? "" : text;
            }
        });
        partyMemberSelector.setButtonCell(new PartyMemberCell());
        partyMemberSelector.setCellFactory(ignored -> new PartyMemberCell());
        partyMemberSelector.valueProperty().addListener((ignored, before, after) ->
                addPartyMemberButton.setDisable(after == null || partyMemberSelector.isDisabled()));
    }

    private Node partySelectorRow() {
        ActionRow row = new ActionRow(6);
        HBox.setHgrow(partyMemberSelector, Priority.ALWAYS);
        row.addAllNodes(label("Party", "session-planner-card-title"), partyMemberSelector, addPartyMemberButton);
        return row;
    }

    private void restoreSelection(
            String selected,
            List<String> selectableMembers
    ) {
        if (selectableMembers.isEmpty()) {
            partyMemberSelector.setValue(null);
            return;
        }
        if (selected != null && selectableMembers.contains(selected)) {
            partyMemberSelector.setValue(selected);
            return;
        }
        partyMemberSelector.setValue(selectableMembers.getFirst());
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

    private void publishSelectedParticipant(ActionEvent event) {
        publish(new SessionPlannerControlsViewInputEvent(partyMemberSelector.getValue(), 0L, "", 0L));
    }

    private void publishRemoveParticipant(ActionEvent event) {
        long participantId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            participantId = id.longValue();
        }
        publish(new SessionPlannerControlsViewInputEvent("", participantId, "", 0L));
    }

    private void publishAttachPlan(ActionEvent event) {
        long planId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            planId = id.longValue();
        }
        publish(new SessionPlannerControlsViewInputEvent("", 0L, "", planId));
    }

    private void publishEncounterDays() {
        if (applyDaysButton.isDisabled()) {
            return;
        }
        publish(new SessionPlannerControlsViewInputEvent(
                "",
                0L,
                encounterDaysField.getText(),
                0L));
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

    private static String partyMemberLabel(String value) {
        if (value == null) {
            return "";
        }
        int separator = value.indexOf('\t');
        return separator < 0 ? value : value.substring(0, separator);
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

    private static final class PartyMemberCell extends ListCell<String> {

        @Override
        protected void updateItem(String item, boolean empty) {
            super.updateItem(item, empty);
            setText(empty ? "" : partyMemberLabel(item));
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
