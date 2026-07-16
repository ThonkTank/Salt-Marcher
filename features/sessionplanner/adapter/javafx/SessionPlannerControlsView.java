package features.sessionplanner.adapter.javafx;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class SessionPlannerControlsView extends ScrollPane {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private Consumer<Long> attachPlanHandler = ignored -> { };
    private final Label statusLabel = statusLabel();
    private final VBox plansBox = new VBox(6);

    public SessionPlannerControlsView() {
        this(null);
    }

    SessionPlannerControlsView(Node generationPanel) {
        setContent(content(generationPanel));
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void onAttachPlan(Consumer<Long> handler) {
        attachPlanHandler = handler == null ? ignored -> { } : handler;
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.controlsProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.controlsProjectionProperty().get());
    }

    private VBox content(Node generationPanel) {
        VBox content = new VBox(12);
        addStyles(content, "session-planner-controls");
        addNodes(content, statusLabel);
        if (generationPanel != null) {
            addNodes(content, generationPanel);
        }
        addNodes(content, sectionCard("Gespeicherte Encounter", plansBox));
        return content;
    }

    private void show(SessionPlannerViewModel.ControlsProjection projection) {
        if (projection == null) {
            return;
        }
        statusLabel.setText(projection.statusText());
        showPlans(projection.availablePlans());
    }

    private void showPlans(List<SessionPlannerViewModel.ControlsProjection.AvailablePlanModel> plans) {
        if (plans.isEmpty()) {
            plansBox.getChildren().setAll(label(
                    "Keine gespeicherten Encounter-Plaene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        plansBox.getChildren().setAll(planCards(plans));
    }

    private List<Node> planCards(List<SessionPlannerViewModel.ControlsProjection.AvailablePlanModel> plans) {
        List<Node> cards = new ArrayList<>();
        for (var plan : plans) {
            cards.add(planCard(plan));
        }
        return cards;
    }

    private Node planCard(SessionPlannerViewModel.ControlsProjection.AvailablePlanModel plan) {
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

    private void publishAttachPlan(ActionEvent event) {
        long planId = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number id) {
            planId = id.longValue();
        }
        attachPlanHandler.accept(Math.max(0L, planId));
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

    private static VBox sectionCard(String title, Node... body) {
        VBox card = new VBox(4);
        addNodes(card, label(title, "session-planner-card-title"));
        addNodes(card, body);
        addStyles(card, "session-planner-card");
        return card;
    }

    private static void addNodes(VBox box, Node... children) {
        box.getChildren().addAll(children);
    }

    private static void addStyles(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
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
