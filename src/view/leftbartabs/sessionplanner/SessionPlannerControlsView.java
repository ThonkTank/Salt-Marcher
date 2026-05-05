package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerControlsView extends ScrollPane {

    private static final long NO_PLAN_SELECTED = 0L;
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String XP_SUFFIX = " XP";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";

    private final StatusLabel statusLabel = new StatusLabel();
    private final Label partyHeadlineLabel = new WrappingLabel();
    private final Label partyDetailLabel = new SecondaryWrappingLabel();
    private final Label totalBudgetLabel = new WrappingLabel();
    private final Label plannedXpLabel = new WrappingLabel();
    private final Label remainingXpLabel = new WrappingLabel();
    private final Label milestonesLabel = new SecondaryWrappingLabel();
    private final Label restAdviceLabel = new WrappingLabel();
    private final Label goldHeadlineLabel = new WrappingLabel();
    private final Label goldDetailLabel = new SecondaryWrappingLabel();
    private final BudgetCard budgetCard;
    private final AvailablePlansBox availablePlansBox = new AvailablePlansBox();
    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerControlsView() {
        budgetCard = new BudgetCard(
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                milestonesLabel);
        availablePlansBox.setImportHandler(planId -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        true,
                        planId)));

        setContent(new ContentColumn(
                new HeaderRow(
                        new StyledLabel("SESSION PLANNER", "section-header", "text-muted"),
                        new StyledButton("Aktualisieren", "compact", "flat", event -> viewInputEventHandler.accept(
                                new SessionPlannerControlsViewInputEvent(
                                        false,
                                        NO_PLAN_SELECTED)))),
                statusLabel,
                new SectionCard("Aktive Party", partyHeadlineLabel, partyDetailLabel),
                budgetCard,
                new SectionCard("Rastempfehlung", restAdviceLabel),
                new SectionCard("Gold & Loot", goldHeadlineLabel, goldDetailLabel),
                new PlansCard(availablePlansBox)));
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
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
        totalBudgetLabel.setText("Budget " + safe.totalBudgetText() + XP_SUFFIX);
        plannedXpLabel.setText("Geplant " + safe.plannedXpText() + XP_SUFFIX);
        remainingXpLabel.setText(safe.overBudget()
                ? safe.overBudgetText() + XP_SUFFIX + " ueber"
                : safe.remainingXpText() + XP_SUFFIX + " frei");
        budgetCard.setSummaryText(safe.summaryText());
        milestonesLabel.setText(safe.milestonesText());
        budgetCard.setProgress(Math.max(0.0, Math.min(1.0, safe.progressFraction())));
        budgetCard.setOverBudget(safe.overBudget());
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
        List<SessionPlannerContributionModel.AvailablePlanModel> safePlans = plans == null ? List.of() : List.copyOf(plans);
        availablePlansBox.setPlans(safePlans);
    }

    public void onViewInputEvent(Consumer<SessionPlannerControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private static final class ContentColumn extends VBox {

        private ContentColumn(Node... children) {
            super(12, children);
            getStyleClass().add("session-planner-controls");
            setPadding(new Insets(8));
        }
    }

    private static final class HeaderRow extends HBox {

        private HeaderRow(Node titleLabel, Node actionButton) {
            super(8, titleLabel, spacer(), actionButton);
            setAlignment(Pos.CENTER_LEFT);
        }

        private static Region spacer() {
            Region spacer = new Region();
            setHgrow(spacer, Priority.ALWAYS);
            return spacer;
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static class WrappingLabel extends Label {

        private WrappingLabel() {
            setWrapText(true);
        }
    }

    private static class SecondaryWrappingLabel extends WrappingLabel {

        private SecondaryWrappingLabel() {
            getStyleClass().add(STYLE_TEXT_SECONDARY);
        }

        private SecondaryWrappingLabel(String text) {
            this();
            setText(text);
        }
    }

    private static final class StatusLabel extends SecondaryWrappingLabel {

        private StatusLabel() {
            getStyleClass().add("session-planner-status");
            setVisible(false);
            textProperty().addListener((ignored, before, after) -> setVisible(after != null && !after.isBlank()));
            managedProperty().bind(visibleProperty());
        }
    }

    private static final class CardTitleLabel extends Label {

        private CardTitleLabel(String text) {
            super(text);
            getStyleClass().add("session-planner-card-title");
        }
    }

    private static final class SectionCard extends VBox {

        private SectionCard(String title, Label... body) {
            super(4, sectionNodes(title, body));
            getStyleClass().add("session-planner-card");
            setPadding(new Insets(10));
        }

        private static Node[] sectionNodes(String title, Label[] body) {
            Node[] nodes = new Node[body.length + 1];
            nodes[0] = new CardTitleLabel(title);
            for (int index = 0; index < body.length; index++) {
                Label label = body[index];
                label.setWrapText(true);
                nodes[index + 1] = label;
            }
            return nodes;
        }
    }

    private static final class BudgetSummaryLabel extends WrappingLabel {

        private BudgetSummaryLabel() {
            getStyleClass().add("session-planner-budget-summary");
        }
    }

    private static final class BudgetProgressBar extends ProgressBar {

        private BudgetProgressBar() {
            super(0.0);
            getStyleClass().add("session-planner-budget-bar");
        }

        private void setOverBudget(boolean overBudget) {
            getStyleClass().removeAll(STYLE_BUDGET_OK, STYLE_BUDGET_OVER);
            getStyleClass().add(overBudget ? STYLE_BUDGET_OVER : STYLE_BUDGET_OK);
        }
    }

    private static final class BudgetCard extends VBox {

        private final Label summaryLabel = new BudgetSummaryLabel();
        private final BudgetProgressBar budgetBar = new BudgetProgressBar();

        private BudgetCard(
                Label totalBudgetLabel,
                Label plannedXpLabel,
                Label remainingXpLabel,
                Label milestonesLabel
        ) {
            super(6);
            getStyleClass().add("session-planner-card");
            setPadding(new Insets(10));
            getChildren().addAll(
                    new CardTitleLabel("XP-Budget"),
                    totalBudgetLabel,
                    plannedXpLabel,
                    remainingXpLabel,
                    budgetBar,
                    summaryLabel,
                    milestonesLabel);
        }

        private void setSummaryText(String text) {
            summaryLabel.setText(text);
        }

        private void setProgress(double progress) {
            budgetBar.setProgress(progress);
        }

        private void setOverBudget(boolean overBudget) {
            budgetBar.setOverBudget(overBudget);
        }
    }

    private static final class PlansCard extends VBox {

        private PlansCard(AvailablePlansBox availablePlansBox) {
            super(8, new CardTitleLabel("Gespeicherte Encounter"), availablePlansBox);
            getStyleClass().add("session-planner-card");
            setPadding(new Insets(10));
        }
    }

    private static final class AvailablePlansBox extends VBox {

        private Consumer<Long> importHandler = ignored -> { };

        private AvailablePlansBox() {
            super(6);
        }

        private void setImportHandler(Consumer<Long> handler) {
            importHandler = handler == null ? ignored -> { } : handler;
        }

        private void setPlans(List<SessionPlannerContributionModel.AvailablePlanModel> plans) {
            getChildren().setAll(planNodes(plans));
        }

        private List<Node> planNodes(List<SessionPlannerContributionModel.AvailablePlanModel> plans) {
            if (plans.isEmpty()) {
                return List.of(new EmptyPlansLabel());
            }
            return plans.stream()
                    .map(plan -> (Node) new PlanCard(plan, importHandler))
                    .toList();
        }
    }

    private static final class EmptyPlansLabel extends SecondaryWrappingLabel {

        private EmptyPlansLabel() {
            super();
            setText("Keine gespeicherten Encounter-Plaene.");
            getStyleClass().add("session-planner-empty");
        }
    }

    private static final class PlanNameLabel extends Label {

        private PlanNameLabel(String text) {
            super(text);
            getStyleClass().add("session-planner-plan-name");
        }
    }

    private static class StyledButton extends Button {

        private StyledButton(
                String text,
                String primaryStyle,
                String secondaryStyle,
                javafx.event.EventHandler<javafx.event.ActionEvent> action
        ) {
            super(text);
            getStyleClass().addAll(primaryStyle, secondaryStyle);
            setOnAction(action);
        }
    }

    private static final class ImportButton extends StyledButton {

        private ImportButton(
                SessionPlannerContributionModel.AvailablePlanModel plan,
                Consumer<Long> importHandler
        ) {
            super("Importieren", "compact", "accent", event -> importHandler.accept(plan.planId()));
            setDisable(!plan.importEnabled());
        }
    }

    private static final class PlanCard extends VBox {

        private PlanCard(
                SessionPlannerContributionModel.AvailablePlanModel plan,
                Consumer<Long> importHandler
        ) {
            super(4,
                    new PlanNameLabel(plan.name()),
                    new SecondaryWrappingLabel(plan.creatureCount() + " Kreaturen"
                            + (plan.generatedLabel().isBlank() ? "" : " · " + plan.generatedLabel())),
                    new SecondaryWrappingLabel(plan.statusText()),
                    new ImportButton(plan, importHandler));
            getStyleClass().add("session-planner-plan-card");
        }
    }

}
