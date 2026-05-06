package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
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

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class SessionPlannerControlsView extends ScrollPane {

    private static final long NO_PLAN_SELECTED = 0L;
    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String XP_SUFFIX = " XP";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";

    private final Label statusLabel = Factory.createStatusLabel();
    private final Label partyHeadlineLabel = Factory.createLabel("", true);
    private final Label partyDetailLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
    private final Label restAdviceLabel = Factory.createLabel("", true);
    private final Label goldHeadlineLabel = Factory.createLabel("", true);
    private final Label goldDetailLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
    private final BudgetSection budgetSection = new BudgetSection();
    private final PlansSection plansSection = new PlansSection();
    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    public SessionPlannerControlsView() {
        plansSection.onImportRequested(planId -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        true,
                        planId)));
        Label headerLabel = Factory.createLabel("SESSION PLANNER", false, "section-header", "text-muted");
        Button refreshButton = Factory.createButton(
                "Aktualisieren",
                event -> viewInputEventHandler.accept(new SessionPlannerControlsViewInputEvent(false, NO_PLAN_SELECTED)),
                "compact",
                "flat");
        VBox content = new VBox(12);
        ObservableList<Node> contentChildren = content.getChildren();
        Factory.addStyles(content, "session-planner-controls");
        content.setPadding(new Insets(8));
        contentChildren.addAll(
                Factory.createHeaderRow(headerLabel, refreshButton),
                statusLabel,
                Factory.createSectionCard("Aktive Party", partyHeadlineLabel, partyDetailLabel),
                budgetSection.root,
                Factory.createSectionCard("Rastempfehlung", restAdviceLabel),
                Factory.createSectionCard("Gold & Loot", goldHeadlineLabel, goldDetailLabel),
                plansSection.root);
        setContent(content);
        Factory.addStyles(this, "session-planner-controls-scroll");
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
        budgetSection.show(safe);
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
        plansSection.showPlans(safePlans);
    }

    public void onViewInputEvent(Consumer<SessionPlannerControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private static final class BudgetSection {

        private final Label totalBudgetLabel = Factory.createLabel("", true);
        private final Label plannedXpLabel = Factory.createLabel("", true);
        private final Label remainingXpLabel = Factory.createLabel("", true);
        private final Label milestonesLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
        private final Label summaryLabel = Factory.createLabel("", true, "session-planner-budget-summary");
        private final ProgressBar budgetBar = createBudgetBar();
        private final VBox root = Factory.createSectionCard(
                "XP-Budget",
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                summaryLabel,
                milestonesLabel);

        private BudgetSection() {
            root.setSpacing(6);
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private void show(SessionPlannerContributionModel.BudgetModel model) {
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

        private static ProgressBar createBudgetBar() {
            ProgressBar progressBar = new ProgressBar(0.0);
            Factory.addStyles(progressBar, "session-planner-budget-bar");
            return progressBar;
        }
    }

    private static final class PlansSection {

        private final VBox plansBox = new VBox(6);
        private final VBox root = Factory.createSectionCard("Gespeicherte Encounter", plansBox);
        private Consumer<Long> importHandler = ignored -> { };

        private PlansSection() {
            root.setSpacing(8);
        }

        private void onImportRequested(Consumer<Long> handler) {
            importHandler = handler == null ? ignored -> { } : handler;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private void showPlans(List<SessionPlannerContributionModel.AvailablePlanModel> plans) {
            ObservableList<Node> children = plansBox.getChildren();
            children.setAll(planNodes(plans));
        }

        private List<Node> planNodes(List<SessionPlannerContributionModel.AvailablePlanModel> plans) {
            if (plans.isEmpty()) {
                return List.of(Factory.createLabel(
                        "Keine gespeicherten Encounter-Plaene.",
                        true,
                        STYLE_TEXT_SECONDARY,
                        "session-planner-empty"));
            }
            return plans.stream()
                    .map(this::planCard)
                    .toList();
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private Node planCard(SessionPlannerContributionModel.AvailablePlanModel plan) {
            VBox card = new VBox(4);
            ObservableList<Node> children = card.getChildren();
            Button importButton = Factory.createButton(
                    "Importieren",
                    event -> importHandler.accept(plan.planId()),
                    "compact",
                    "accent");
            importButton.setDisable(!plan.importEnabled());
            Factory.addStyles(card, "session-planner-plan-card");
            children.addAll(
                    Factory.createLabel(plan.name(), false, "session-planner-plan-name"),
                    Factory.createLabel(
                            plan.creatureCount() + " Kreaturen"
                                    + (plan.generatedLabel().isBlank() ? "" : " · " + plan.generatedLabel()),
                            true,
                            STYLE_TEXT_SECONDARY),
                    Factory.createLabel(plan.statusText(), true, STYLE_TEXT_SECONDARY),
                    importButton);
            return card;
        }
    }

    private static final class Factory {

        private static Label createLabel(String text, boolean wrap, String... styleClasses) {
            Label label = new Label(text);
            label.setWrapText(wrap);
            addStyles(label, styleClasses);
            return label;
        }

        private static Button createButton(String text, EventHandler<ActionEvent> action, String... styleClasses) {
            Button button = new Button(text);
            addStyles(button, styleClasses);
            button.setOnAction(action);
            return button;
        }

        private static Label createStatusLabel() {
            Label label = createLabel("", true, STYLE_TEXT_SECONDARY, "session-planner-status");
            StringProperty text = label.textProperty();
            BooleanProperty managed = label.managedProperty();
            label.setVisible(false);
            text.addListener((ignored, before, after) -> label.setVisible(after != null && !after.isBlank()));
            managed.bind(label.visibleProperty());
            return label;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static HBox createHeaderRow(Node titleLabel, Node actionButton) {
            HBox row = new HBox(8);
            ObservableList<Node> children = row.getChildren();
            children.addAll(titleLabel, spacer(), actionButton);
            row.setAlignment(Pos.CENTER_LEFT);
            return row;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static VBox createSectionCard(String title, Node... body) {
            VBox card = new VBox(4);
            ObservableList<Node> children = card.getChildren();
            children.add(createLabel(title, false, "session-planner-card-title"));
            children.addAll(body);
            addStyles(card, "session-planner-card");
            card.setPadding(new Insets(10));
            return card;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static void addStyles(Node node, String... styleClasses) {
            ObservableList<String> appliedStyles = node.getStyleClass();
            appliedStyles.addAll(styleClasses);
        }

        private static Region spacer() {
            Region region = new Region();
            HBox.setHgrow(region, Priority.ALWAYS);
            return region;
        }
    }

}
