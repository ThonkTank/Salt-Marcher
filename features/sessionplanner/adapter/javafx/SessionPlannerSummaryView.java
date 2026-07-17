package features.sessionplanner.adapter.javafx;

import java.text.NumberFormat;
import java.util.Locale;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

/**
 * Rechte Übersichts-Spalte des Session Planners: Teilnehmer-Level-Spread, XP-Budget als
 * Fortschrittsbalken (mit Over-Budget-Zustand) und Rast-Empfehlung vs. platzierte Rasten. Rein
 * read-only; alle Werte stammen aus der {@link SessionPlannerViewModel.SummaryProjection}.
 */
public final class SessionPlannerSummaryView extends ScrollPane {

    private static final String STYLE_SECONDARY = "text-secondary";
    private static final String BUDGET_OK = "session-planner-budget-ok";
    private static final String BUDGET_OVER = "session-planner-budget-over";

    private final Label partyHeadline = label("", "session-planner-plan-name");
    private final Label partyLevels = label("", STYLE_SECONDARY);
    private final Label partyDetail = label("", STYLE_SECONDARY);

    private final ProgressBar budgetBar = new ProgressBar(0);
    private final Label budgetHeadline = label("", "session-planner-budget-summary");
    private final Label budgetPlanned = label("", STYLE_SECONDARY);
    private final Label budgetRemaining = label("", STYLE_SECONDARY);

    private final Label restRecommended = label("", STYLE_SECONDARY);
    private final Label restPlaced = label("", STYLE_SECONDARY);

    public SessionPlannerSummaryView() {
        budgetBar.getStyleClass().addAll("session-planner-budget-bar", BUDGET_OK);
        budgetBar.setMaxWidth(Double.MAX_VALUE);
        VBox content = new VBox(12,
                section("Teilnehmer", partyHeadline, partyLevels, partyDetail),
                section("XP-Budget", budgetHeadline, budgetBar, budgetPlanned, budgetRemaining),
                section("Rasten", restRecommended, restPlaced));
        content.getStyleClass().add("session-planner-main");
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        setContent(content);
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
        partyHeadline.setText(projection.partyHeadline());
        partyLevels.setText(projection.participantCount() == 0
                ? ""
                : projection.participantCount() + " Teilnehmer · " + levelText(projection));
        partyDetail.setText(projection.partyDetail());

        if (projection.budgetAvailable()) {
            budgetBar.setProgress(clamp(projection.progressFraction()));
            budgetHeadline.setText(projection.overBudget()
                    ? "Über Budget: " + formatXp(projection.overBudgetXp()) + " XP"
                    : formatXp(projection.remainingXp()) + " XP frei");
            budgetPlanned.setText("Geplant " + formatXp(projection.plannedEncounterXp())
                    + " / " + formatXp(projection.totalBudgetXp()) + " XP");
            budgetRemaining.setText(projection.overBudget()
                    ? "Budget überschritten"
                    : "Verbleibend " + formatXp(projection.remainingXp()) + " XP");
        } else {
            budgetBar.setProgress(0);
            budgetHeadline.setText(projection.budgetSummary());
            budgetPlanned.setText("");
            budgetRemaining.setText("");
        }
        applyBudgetStyle(projection.overBudget());

        restRecommended.setText("Empfohlen: " + projection.recommendedShortRests() + " kurz · "
                + projection.recommendedLongRests() + " lang");
        restPlaced.setText("Platziert: " + projection.placedShortRests() + " kurz · "
                + projection.placedLongRests() + " lang");
    }

    private void applyBudgetStyle(boolean overBudget) {
        budgetBar.getStyleClass().removeAll(BUDGET_OK, BUDGET_OVER);
        budgetBar.getStyleClass().add(overBudget ? BUDGET_OVER : BUDGET_OK);
    }

    private static String levelText(SessionPlannerViewModel.SummaryProjection projection) {
        return projection.levelSpreadText().isBlank()
                ? "Ø Level " + projection.averageLevel()
                : projection.levelSpreadText() + " · Ø " + projection.averageLevel();
    }

    private static double clamp(double value) {
        if (value < 0) {
            return 0;
        }
        return Math.min(value, 1.0);
    }

    private static String formatXp(int value) {
        return NumberFormat.getIntegerInstance(Locale.GERMANY).format(Math.max(0, value));
    }

    private static VBox section(String title, javafx.scene.Node... body) {
        VBox card = new VBox(6);
        card.getStyleClass().add("session-planner-card");
        card.getChildren().add(label(title, "session-planner-card-title"));
        card.getChildren().addAll(body);
        return card;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }
}
