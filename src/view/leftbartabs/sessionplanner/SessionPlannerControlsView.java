package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerControlsView extends ScrollPane {

    private final VBox content = new VBox(12);
    private final Label statusLabel = new Label();
    private final Label partyHeadlineLabel = new Label();
    private final Label partyDetailLabel = new Label();
    private final Label totalBudgetLabel = new Label();
    private final Label plannedXpLabel = new Label();
    private final Label remainingXpLabel = new Label();
    private final Label budgetSummaryLabel = new Label();
    private final Label milestonesLabel = new Label();
    private final ProgressBar budgetBar = new ProgressBar(0.0);
    private final Label restAdviceLabel = new Label();
    private final Label goldHeadlineLabel = new Label();
    private final Label goldDetailLabel = new Label();
    private final VBox availablePlansBox = new VBox(6);
    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerControlsView() {
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setContent(content);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);

        content.getStyleClass().add("session-planner-controls");
        content.setPadding(new Insets(8));

        Button refreshButton = new Button("Aktualisieren");
        refreshButton.getStyleClass().addAll("compact", "flat");
        refreshButton.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        false,
                        0L)));

        Label titleLabel = new Label("SESSION PLANNER");
        titleLabel.getStyleClass().addAll("section-header", "text-muted");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, titleLabel, spacer, refreshButton);
        header.setAlignment(Pos.CENTER_LEFT);

        statusLabel.getStyleClass().addAll("text-secondary", "session-planner-status");
        statusLabel.setWrapText(true);

        content.getChildren().addAll(
                header,
                statusLabel,
                card("Aktive Party", partyHeadlineLabel, partyDetailLabel),
                budgetCard(),
                card("Rastempfehlung", restAdviceLabel),
                card("Gold & Loot", goldHeadlineLabel, goldDetailLabel),
                plansCard());

        budgetBar.getStyleClass().add("session-planner-budget-bar");
        budgetSummaryLabel.getStyleClass().add("session-planner-budget-summary");
        milestonesLabel.getStyleClass().add("text-secondary");
        partyDetailLabel.getStyleClass().add("text-secondary");
        goldDetailLabel.getStyleClass().add("text-secondary");
        restAdviceLabel.setWrapText(true);
        budgetSummaryLabel.setWrapText(true);
        goldDetailLabel.setWrapText(true);
        statusLabel.setVisible(false);
        statusLabel.textProperty().addListener((ignored, before, after) -> statusLabel.setVisible(after != null && !after.isBlank()));
        statusLabel.managedProperty().bind(statusLabel.visibleProperty());
    }

    public StringProperty statusTextProperty() {
        return statusLabel.textProperty();
    }

    public void showParty(SessionPlannerContributionModel.PartyModel model) {
        SessionPlannerContributionModel.PartyModel safe = model == null
                ? SessionPlannerContributionModel.PartyModel.empty()
                : model;
        partyHeadlineLabel.setText(safe.headline());
        partyDetailLabel.setText(safe.detail());
    }

    public void showBudget(SessionPlannerContributionModel.BudgetModel model) {
        SessionPlannerContributionModel.BudgetModel safe = model == null
                ? SessionPlannerContributionModel.BudgetModel.empty()
                : model;
        totalBudgetLabel.setText("Budget " + safe.totalBudgetText() + " XP");
        plannedXpLabel.setText("Geplant " + safe.plannedXpText() + " XP");
        remainingXpLabel.setText(safe.overBudget()
                ? safe.overBudgetText() + " XP ueber"
                : safe.remainingXpText() + " XP frei");
        budgetSummaryLabel.setText(safe.summaryText());
        milestonesLabel.setText(safe.milestonesText());
        budgetBar.setProgress(Math.max(0.0, Math.min(1.0, safe.progressFraction())));
        budgetBar.getStyleClass().removeAll("session-planner-budget-ok", "session-planner-budget-over");
        budgetBar.getStyleClass().add(safe.overBudget() ? "session-planner-budget-over" : "session-planner-budget-ok");
    }

    public void showRestAdvice(SessionPlannerContributionModel.RestAdviceModel model) {
        SessionPlannerContributionModel.RestAdviceModel safe = model == null
                ? SessionPlannerContributionModel.RestAdviceModel.empty()
                : model;
        restAdviceLabel.setText(safe.summaryText());
    }

    public void showGoldBudget(SessionPlannerContributionModel.GoldModel model) {
        SessionPlannerContributionModel.GoldModel safe = model == null
                ? SessionPlannerContributionModel.GoldModel.placeholder()
                : model;
        goldHeadlineLabel.setText(safe.headline());
        goldDetailLabel.setText(safe.detail());
    }

    public void showAvailablePlans(List<SessionPlannerContributionModel.AvailablePlanModel> plans) {
        availablePlansBox.getChildren().clear();
        List<SessionPlannerContributionModel.AvailablePlanModel> safePlans = plans == null ? List.of() : List.copyOf(plans);
        if (safePlans.isEmpty()) {
            Label empty = new Label("Keine gespeicherten Encounter-Plaene.");
            empty.getStyleClass().addAll("text-secondary", "session-planner-empty");
            availablePlansBox.getChildren().add(empty);
            return;
        }
        for (SessionPlannerContributionModel.AvailablePlanModel plan : safePlans) {
            availablePlansBox.getChildren().add(planCard(plan));
        }
    }

    public void onViewInputEvent(Consumer<SessionPlannerControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox card(String title, Label... body) {
        Label header = new Label(title);
        header.getStyleClass().add("session-planner-card-title");
        VBox box = new VBox(4);
        box.getStyleClass().add("session-planner-card");
        box.setPadding(new Insets(10));
        box.getChildren().add(header);
        for (Label label : body) {
            label.setWrapText(true);
            box.getChildren().add(label);
        }
        return box;
    }

    private VBox budgetCard() {
        Label header = new Label("XP-Budget");
        header.getStyleClass().add("session-planner-card-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("session-planner-card");
        box.setPadding(new Insets(10));
        box.getChildren().addAll(
                header,
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                budgetSummaryLabel,
                milestonesLabel);
        return box;
    }

    private VBox plansCard() {
        Label header = new Label("Gespeicherte Encounter");
        header.getStyleClass().add("session-planner-card-title");
        VBox box = new VBox(8);
        box.getStyleClass().add("session-planner-card");
        box.setPadding(new Insets(10));
        box.getChildren().addAll(header, availablePlansBox);
        return box;
    }

    private VBox planCard(SessionPlannerContributionModel.AvailablePlanModel plan) {
        Label nameLabel = new Label(plan.name());
        nameLabel.getStyleClass().add("session-planner-plan-name");
        Label metaLabel = new Label(plan.creatureCount() + " Kreaturen"
                + (plan.generatedLabel().isBlank() ? "" : " · " + plan.generatedLabel()));
        metaLabel.getStyleClass().add("text-secondary");
        Label status = new Label(plan.statusText());
        status.getStyleClass().add("text-secondary");
        Button importButton = new Button("Importieren");
        importButton.getStyleClass().addAll("compact", "accent");
        importButton.setDisable(!plan.importEnabled());
        importButton.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        true,
                        plan.planId())));
        VBox card = new VBox(4, nameLabel, metaLabel, status, importButton);
        card.getStyleClass().add("session-planner-plan-card");
        return card;
    }
}
