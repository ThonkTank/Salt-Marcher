package ui;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.*;
import ui.components.DifficultyMeter;
import ui.components.QuickSearchBar;

/**
 * Left control panel content for combat mode.
 * Contains quick-add search, combat status, and keyboard shortcuts reference.
 */
public class CombatControls extends VBox {

    private final QuickSearchBar quickSearch;
    private final Label roundLabel;
    private final Label turnLabel;
    private final Label aliveLabel;
    private final Label difficultyLabel;
    private final DifficultyMeter difficultyMeter;
    private final Label xpLabel;

    public CombatControls() {
        setSpacing(6);
        setPadding(new Insets(8));
        getStyleClass().add("combat-controls");

        // ---- Quick-add search ----
        quickSearch = new QuickSearchBar();

        // ---- Separator ----
        Region sep1 = ThemeColors.controlSeparator();

        // ---- Combat status ----
        Label statusTitle = new Label("Kampf-Status");
        statusTitle.getStyleClass().add("bold");

        roundLabel = new Label("Runde: 1");
        turnLabel = new Label("Zug: -");
        aliveLabel = new Label("Lebend: 0/0");
        difficultyLabel = new Label("");
        difficultyLabel.getStyleClass().add("bold");
        xpLabel = new Label("Adj. XP: 0");
        xpLabel.getStyleClass().add("text-secondary");

        difficultyMeter = new DifficultyMeter();

        VBox statusSection = new VBox(2, statusTitle, roundLabel, turnLabel, aliveLabel,
                difficultyLabel, difficultyMeter, xpLabel);
        statusSection.setPadding(new Insets(0, 0, 4, 0));

        // ---- Separator ----
        Region sep2 = ThemeColors.controlSeparator();

        // ---- Keyboard shortcuts ----
        Label shortcutsTitle = new Label("Tastenkuerzel");
        shortcutsTitle.getStyleClass().add("bold");

        VBox shortcuts = new VBox(1,
                shortcutsTitle,
                shortcutRow("Space", "Naechster Zug"),
                shortcutRow("F2", "HP bearbeiten"),
                shortcutRow("Enter", "Stat Block"),
                shortcutRow("Ctrl+N", "Monster suchen"),
                shortcutRow("Ctrl+D", "Duplizieren"),
                shortcutRow("Del", "Entfernen")
        );

        getChildren().addAll(quickSearch, sep1, statusSection, sep2, shortcuts);
    }

    // ---- Public API ----

    public QuickSearchBar getQuickSearch() { return quickSearch; }

    public void updateStatus(CombatTrackerPane.CombatStats stats, int round, String currentTurnName) {
        roundLabel.setText("Runde: " + round);
        turnLabel.setText("Zug: " + (currentTurnName != null ? currentTurnName : "-"));
        aliveLabel.setText("Lebend: " + stats.alive() + "/" + stats.total());
        difficultyLabel.setText(stats.difficulty());
        xpLabel.setText("Adj. XP: " + stats.adjXp());
        difficultyMeter.update(stats.easyTh(), stats.mediumTh(), stats.hardTh(), stats.deadlyTh(), stats.adjXp(), stats.difficulty());
    }

    // ---- Helpers ----

    private static HBox shortcutRow(String key, String action) {
        Label keyLabel = new Label(key);
        keyLabel.getStyleClass().add("bold");
        keyLabel.setMinWidth(60);
        Label actionLabel = new Label(action);
        actionLabel.getStyleClass().add("text-secondary");
        return new HBox(8, keyLabel, actionLabel);
    }
}
