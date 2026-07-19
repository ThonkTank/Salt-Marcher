package features.sessionplanner.adapter.javafx;

import java.text.NumberFormat;
import java.util.Locale;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

/** Compact selected-scene, budget and rest context for the shell state slot. */
public final class SessionPlannerStateView extends ScrollPane {

    private static final String SECONDARY = "text-secondary";
    private static final String BUDGET_OK = "session-planner-budget-ok";
    private static final String BUDGET_OVER = "session-planner-budget-over";

    private final Label selectedTitle = label("", "session-planner-plan-name");
    private final Label selectedDetail = label("", SECONDARY);
    private final Label selectedBudget = label("", SECONDARY);
    private final Label budgetHeadline = label("", "session-planner-budget-summary");
    private final Label budgetValues = label("", SECONDARY);
    private final ProgressBar budgetBar = new ProgressBar(0);
    private final Label rests = label("", SECONDARY);

    public SessionPlannerStateView() {
        budgetBar.setMaxWidth(Double.MAX_VALUE);
        budgetBar.getStyleClass().addAll("session-planner-budget-bar", BUDGET_OK);
        VBox content = new VBox(8,
                label("Ausgewählte Szene", "session-planner-card-title"),
                selectedTitle, selectedDetail, selectedBudget,
                label("Session-Budget", "session-planner-card-title"),
                budgetHeadline, budgetBar, budgetValues,
                label("Rasten", "session-planner-card-title"), rests);
        content.getStyleClass().addAll("session-planner-main", "session-planner-state-compact");
        setContent(content);
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollBarPolicy.NEVER);
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.summaryProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.summaryProjectionProperty().get());
    }

    private void show(SessionPlannerViewModel.SummaryProjection projection) {
        if (projection == null) {
            return;
        }
        if (projection.selectionAvailable()) {
            selectedTitle.setText(projection.selectedTitle());
            selectedDetail.setText(projection.selectedDetail());
            selectedBudget.setText(projection.selectedBudget());
        } else {
            selectedTitle.setText("Keine Szene ausgewählt.");
            selectedDetail.setText("Wähle eine Szene in der Timeline aus.");
            selectedBudget.setText("");
        }
        if (projection.budgetAvailable()) {
            budgetBar.setProgress(Math.min(1.0, projection.progressFraction()));
            budgetHeadline.setText(projection.overBudget()
                    ? formatXp(projection.overBudgetXp()) + " XP über Budget"
                    : formatXp(projection.remainingXp()) + " XP frei");
            budgetValues.setText(formatXp(projection.plannedEncounterXp()) + " / "
                    + formatXp(projection.totalBudgetXp()) + " XP");
        } else {
            budgetBar.setProgress(0);
            budgetHeadline.setText(projection.budgetSummary());
            budgetValues.setText("");
        }
        budgetBar.getStyleClass().removeAll(BUDGET_OK, BUDGET_OVER);
        budgetBar.getStyleClass().add(projection.overBudget() ? BUDGET_OVER : BUDGET_OK);
        rests.setText("Empfohlen " + projection.recommendedShortRests() + " kurz / "
                + projection.recommendedLongRests() + " lang · platziert "
                + projection.placedShortRests() + " kurz / " + projection.placedLongRests() + " lang");
    }

    private static String formatXp(int value) {
        return NumberFormat.getIntegerInstance(Locale.GERMANY).format(Math.max(0, value));
    }

    private static Label label(String text, String... styles) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styles);
        return label;
    }
}
