package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class AdventuringDayCalculatorTopBarView extends VBox {

    private enum PartySourceMode {
        ACTIVE_PARTY,
        CUSTOM
    }

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);
    private static final NumberFormat DAY_FORMAT = NumberFormat.getNumberInstance(Locale.GERMANY);

    private final VBox rowsBox = new VBox(6);
    private final Label emptyLabel = new Label("Keine Charaktere.");
    private final Label partySummaryLabel = new Label();
    private final Button useActivePartyButton = new Button("Aktive Party");
    private final Button addRowButton = new Button("Zeile");
    private final Button clearButton = new Button("Leeren");
    private final ToggleButton budgetModeButton = new ToggleButton("Budget");
    private final ToggleButton progressModeButton = new ToggleButton("XP -> Tage");
    private final TextField totalGroupXpField = createIntegerField();
    private final HBox progressInputRow;
    private final VBox summaryBox = new VBox(4);
    private final VBox timelineBox = new VBox(4);
    private final ScrollPane timelineScrollPane = new ScrollPane(timelineBox);
    private final Label totalXpLabel = new Label();
    private final Label perThirdLabel = new Label();
    private final Label firstRestLabel = new Label();
    private final Label secondRestLabel = new Label();
    private final Label awardedXpLabel = new Label();
    private final Label totalDaysLabel = new Label();
    private final Label longRestLabel = new Label();
    private final Label shortRestLabel = new Label();
    private final Label levelProgressLabel = new Label();
    private final Label timelineTitleLabel = new Label("Etappen");
    private final Label timelineEmptyLabel = new Label("Keine Etappen.");
    private final List<RowControls> rows = new ArrayList<>();

    private Consumer<AdventuringDayCalculatorTopBarViewInputEvent> viewInputEventHandler = ignored -> { };
    private Calculation calculation = Calculation.empty(0);
    private List<Integer> activePartyLevels = List.of();
    private PartySourceMode sourceMode = PartySourceMode.ACTIVE_PARTY;
    private boolean activePartyChangedSinceCustomEdit;
    private boolean activePartyRefreshFailed;
    private boolean rebuilding;
    private boolean suppressPublishedEvents;

    public AdventuringDayCalculatorTopBarView() {
        setSpacing(8);
        setPadding(new Insets(8, 0, 0, 0));
        DAY_FORMAT.setMinimumFractionDigits(0);
        DAY_FORMAT.setMaximumFractionDigits(2);
        partySummaryLabel.getStyleClass().add("text-secondary");

        ToggleGroup modeGroup = new ToggleGroup();
        budgetModeButton.setToggleGroup(modeGroup);
        progressModeButton.setToggleGroup(modeGroup);
        budgetModeButton.setSelected(true);
        budgetModeButton.getStyleClass().add("compact");
        progressModeButton.getStyleClass().add("compact");

        HBox modeRow = new HBox(6, budgetModeButton, progressModeButton);
        HBox headerActions = new HBox(6, useActivePartyButton, addRowButton, clearButton);
        useActivePartyButton.getStyleClass().add("compact");
        addRowButton.getStyleClass().add("compact");
        clearButton.getStyleClass().add("compact");

        HBox tableHeader = new HBox(8);
        tableHeader.setAlignment(Pos.CENTER_LEFT);
        Label levelHeader = new Label("Level");
        Label countHeader = new Label("Anzahl");
        levelHeader.getStyleClass().add("text-muted");
        countHeader.getStyleClass().add("text-muted");
        levelHeader.setMinWidth(78);
        countHeader.setMinWidth(70);
        Region tableSpacer = new Region();
        HBox.setHgrow(tableSpacer, Priority.ALWAYS);
        tableHeader.getChildren().addAll(levelHeader, countHeader, tableSpacer);

        totalGroupXpField.setPromptText("Gesamt-XP");
        totalGroupXpField.setPrefColumnCount(10);
        totalGroupXpField.textProperty().addListener((ignored, before, after) -> refreshSummary());
        Label totalGroupXpHint = new Label("Gesamt-XP f\u00fcr die Gruppe");
        totalGroupXpHint.getStyleClass().add("text-muted");
        progressInputRow = new HBox(8, totalGroupXpHint, totalGroupXpField);
        progressInputRow.setAlignment(Pos.CENTER_LEFT);

        emptyLabel.getStyleClass().add("text-muted");
        rowsBox.getChildren().add(emptyLabel);
        summaryBox.getStyleClass().add("entity-card");
        timelineBox.getStyleClass().add("entity-card");
        timelineTitleLabel.getStyleClass().addAll("small", "text-secondary");
        timelineEmptyLabel.getStyleClass().add("text-muted");
        levelProgressLabel.setWrapText(true);
        timelineScrollPane.setFitToWidth(true);
        timelineScrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        timelineScrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        timelineScrollPane.setPrefViewportHeight(240);
        timelineScrollPane.getStyleClass().add("adventuring-day-timeline-scroll");

        useActivePartyButton.setOnAction(event -> useActiveParty());
        addRowButton.setOnAction(event -> addCustomRow());
        clearButton.setOnAction(event -> clearCustomRows());
        modeGroup.selectedToggleProperty().addListener((ignored, before, after) -> {
            updateModeVisibility();
            refreshSummary();
        });

        getChildren().addAll(
                partySummaryLabel,
                modeRow,
                headerActions,
                progressInputRow,
                tableHeader,
                rowsBox,
                summaryBox,
                timelineScrollPane);
        updateModeVisibility();
        refreshSummary();
        updateActionState();
    }

    public void onViewInputEvent(Consumer<AdventuringDayCalculatorTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showCalculation(Calculation value) {
        int totalGroupXp = parseNonNegativeInt(totalGroupXpField.getText());
        calculation = value == null ? Calculation.empty(totalGroupXp) : value;
        suppressPublishedEvents = true;
        try {
            refreshSummary();
        } finally {
            suppressPublishedEvents = false;
        }
    }

    public void setActivePartySnapshot(List<Integer> levels) {
        List<Integer> sanitizedLevels = sanitizeLevels(levels);
        boolean changed = !sanitizedLevels.equals(activePartyLevels);
        activePartyRefreshFailed = false;
        activePartyLevels = sanitizedLevels;
        if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
            activePartyChangedSinceCustomEdit = false;
            populateFromLevels(activePartyLevels);
            return;
        }
        activePartyChangedSinceCustomEdit = activePartyChangedSinceCustomEdit || changed;
        updateActionState();
        refreshSummary();
    }

    public void markActivePartyRefreshFailed() {
        activePartyRefreshFailed = true;
        updateActionState();
        refreshSummary();
    }

    private void useActiveParty() {
        sourceMode = PartySourceMode.ACTIVE_PARTY;
        activePartyChangedSinceCustomEdit = false;
        populateFromLevels(activePartyLevels);
    }

    private void addCustomRow() {
        activateCustomMode();
        addRow(1, 1);
        refreshSummary();
    }

    private void clearCustomRows() {
        activateCustomMode();
        populateFromLevels(List.of());
    }

    private void updateModeVisibility() {
        boolean progressMode = progressModeButton.isSelected();
        progressInputRow.setVisible(progressMode);
        progressInputRow.setManaged(progressMode);
    }

    private void populateFromLevels(List<Integer> levels) {
        rebuilding = true;
        rows.clear();
        rowsBox.getChildren().clear();
        Map<Integer, Integer> countsByLevel = new TreeMap<>();
        for (Integer level : sanitizeLevels(levels)) {
            countsByLevel.merge(level, 1, Integer::sum);
        }
        for (Map.Entry<Integer, Integer> entry : countsByLevel.entrySet()) {
            addRow(entry.getKey(), entry.getValue());
        }
        rebuilding = false;
        updateEmptyState();
        refreshSummary();
        updateActionState();
    }

    private void addRow(int level, int count) {
        RowControls row = new RowControls(level, count);
        rows.add(row);
        rowsBox.getChildren().add(row.root());
        updateEmptyState();
    }

    private void removeRow(RowControls row) {
        rows.remove(row);
        rowsBox.getChildren().remove(row.root());
        updateEmptyState();
        refreshSummary();
        updateActionState();
    }

    private void updateEmptyState() {
        if (rows.isEmpty() && !rowsBox.getChildren().contains(emptyLabel)) {
            rowsBox.getChildren().setAll(emptyLabel);
        } else if (!rows.isEmpty()) {
            rowsBox.getChildren().remove(emptyLabel);
        }
    }

    private void refreshSummary() {
        List<Integer> levels = collectLevels();
        String sourceLabel = sourceMode == PartySourceMode.CUSTOM ? "Eigene Gruppe" : "Aktive Party";
        if (sourceMode == PartySourceMode.ACTIVE_PARTY && activePartyRefreshFailed) {
            sourceLabel += activePartyLevels.isEmpty() ? " · Laden fehlgeschlagen" : " · Letzter Stand";
        }
        if (sourceMode == PartySourceMode.CUSTOM && activePartyChangedSinceCustomEdit) {
            sourceLabel += " · Aktive Party ge\u00e4ndert";
        }
        if (levels.isEmpty()) {
            partySummaryLabel.setText(sourceLabel);
            calculation = Calculation.empty(parseNonNegativeInt(totalGroupXpField.getText()));
            renderEmptyState();
            updateActionState();
            return;
        }
        partySummaryLabel.setText(sourceLabel + ": " + levels.size() + " Charaktere");
        requestCalculation(levels, parseNonNegativeInt(totalGroupXpField.getText()));
        if (progressModeButton.isSelected()) {
            renderProgressSummary(levels, parseNonNegativeInt(totalGroupXpField.getText()));
        } else {
            renderBudgetSummary(levels);
        }
        updateActionState();
    }

    private void renderBudgetSummary(List<Integer> levels) {
        Budget budget = safeCalculation(0).budget();
        summaryBox.getChildren().setAll(totalXpLabel, perThirdLabel, firstRestLabel, secondRestLabel);
        totalXpLabel.setText("Tag gesamt: " + formatInt(budget.totalXp()) + " XP");
        perThirdLabel.setText("Pro Drittel: ca. " + formatInt(budget.perThirdXp()) + " XP");
        firstRestLabel.setText("Short Rest 1: nach " + formatInt(budget.firstShortRestXp()) + " XP");
        secondRestLabel.setText("Short Rest 2: nach " + formatInt(budget.secondShortRestXp()) + " XP");
        timelineBox.getChildren().setAll(
                timelineTitleLabel,
                eventLabel("Short Rest 1", budget.firstShortRestXp()),
                eventLabel("Short Rest 2", budget.secondShortRestXp()),
                eventLabel("Long Rest", budget.totalXp()));
    }

    private void renderProgressSummary(List<Integer> levels, int totalGroupXp) {
        Progress progress = safeCalculation(totalGroupXp).progress();
        summaryBox.getChildren().setAll(
                totalXpLabel,
                awardedXpLabel,
                totalDaysLabel,
                shortRestLabel,
                longRestLabel,
                levelProgressLabel);
        totalXpLabel.setText("Gesamt-XP: " + formatInt(progress.totalGroupXp()) + " XP");
        awardedXpLabel.setText("XP pro Charakter: " + formatInt(progress.perCharacterAwardedXp()));
        totalDaysLabel.setText("Adventuring Days: " + formatDays(progress.totalDays())
                + " (" + progress.fullDays() + " voll)");
        shortRestLabel.setText("Short Rests: " + progress.shortRests());
        longRestLabel.setText("Long Rests: " + progress.longRests());
        levelProgressLabel.setText("Level-ups: " + formatLevelProgress(progress.levelProgressions()));

        timelineBox.getChildren().setAll(timelineTitleLabel);
        if (progress.events().isEmpty()) {
            timelineBox.getChildren().add(timelineEmptyLabel);
            return;
        }
        for (ProgressEvent event : progress.events()) {
            timelineBox.getChildren().add(buildEventLabel(event));
        }
    }

    private Calculation safeCalculation(int totalGroupXp) {
        return calculation == null ? Calculation.empty(totalGroupXp) : calculation;
    }

    private void requestCalculation(List<Integer> levels, int totalGroupXp) {
        if (suppressPublishedEvents) {
            return;
        }
        calculation = Calculation.empty(totalGroupXp);
        viewInputEventHandler.accept(new AdventuringDayCalculatorTopBarViewInputEvent(levels, totalGroupXp));
    }

    private void renderEmptyState() {
        summaryBox.getChildren().setAll(totalXpLabel);
        totalXpLabel.setText(progressModeButton.isSelected() ? "Gesamt-XP: 0 XP" : "Tag gesamt: 0 XP");
        timelineBox.getChildren().setAll(timelineTitleLabel, timelineEmptyLabel);
    }

    private Label buildEventLabel(ProgressEvent event) {
        String prefix = "Tag " + event.dayNumber() + ", " + formatInt(event.groupXp()) + " XP: ";
        String suffix = event.partialDay() ? " (teilweiser Tag)" : "";
        String text = switch (event.type()) {
            case LEVEL_UP -> prefix + "Level-up auf " + event.newLevel()
                    + " f\u00fcr " + event.affectedCharacters() + " Charakter"
                    + (event.affectedCharacters() == 1 ? "" : "e") + suffix;
            case SHORT_REST -> prefix + "Short Rest" + suffix;
            case LONG_REST -> prefix + "Long Rest" + suffix;
        };
        Label label = new Label(text);
        label.setWrapText(true);
        return label;
    }

    private Label eventLabel(String name, int groupXp) {
        Label label = new Label(name + ": " + formatInt(groupXp) + " XP");
        label.setWrapText(true);
        return label;
    }

    private void updateActionState() {
        useActivePartyButton.setDisable(activePartyLevels.isEmpty());
        clearButton.setDisable(rows.isEmpty());
    }

    private void activateCustomMode() {
        sourceMode = PartySourceMode.CUSTOM;
    }

    private List<Integer> collectLevels() {
        List<Integer> levels = new ArrayList<>();
        for (RowControls row : rows) {
            for (int i = 0; i < row.count(); i++) {
                levels.add(row.level());
            }
        }
        return levels;
    }

    private static List<Integer> sanitizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(Math.max(1, Math.min(20, level)));
            }
        }
        return List.copyOf(normalized);
    }

    private static String formatLevelProgress(List<LevelProgress> progressions) {
        if (progressions == null || progressions.isEmpty()) {
            return "keine";
        }
        List<String> parts = new ArrayList<>();
        for (LevelProgress progression : progressions) {
            StringBuilder builder = new StringBuilder();
            builder.append(progression.characterCount()).append("x L").append(progression.startLevel());
            builder.append(progression.levelUps() > 0 ? " -> L" + progression.endLevel() : " bleibt");
            parts.add(builder.toString());
        }
        return String.join(", ", parts);
    }

    private static int parseNonNegativeInt(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(raw));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static String formatInt(int value) {
        return INTEGER_FORMAT.format(value);
    }

    private static String formatDays(double value) {
        return DAY_FORMAT.format(value);
    }

    public record Calculation(Budget budget, Progress progress) {

        public static Calculation empty(int totalGroupXp) {
            return new Calculation(
                    new Budget(0, 0, 0, 0, 0),
                    new Progress(totalGroupXp, 0, 0, 0, 0.0, 0, 0, List.of(), List.of()));
        }
    }

    public record Budget(
            int totalXp,
            int perThirdXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int characterCount) {
    }

    public record Progress(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            int fullDays,
            double totalDays,
            int shortRests,
            int longRests,
            List<LevelProgress> levelProgressions,
            List<ProgressEvent> events) {

        public Progress {
            levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
            events = events == null ? List.of() : List.copyOf(events);
        }
    }

    public record LevelProgress(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps) {
    }

    public record ProgressEvent(
            int groupXp,
            ProgressEventType type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay) {
    }

    public enum ProgressEventType {
        LEVEL_UP,
        SHORT_REST,
        LONG_REST
    }

    private final class RowControls {
        private final HBox root;
        private final ComboBox<Integer> levelCombo = new ComboBox<>();
        private final TextField countField = createIntegerField();
        private final Button removeButton = new Button("Entfernen");

        private RowControls(int level, int count) {
            levelCombo.getItems().addAll(levelOptions());
            levelCombo.setValue(Math.max(1, Math.min(20, level)));
            levelCombo.setMinWidth(78);
            levelCombo.valueProperty().addListener((ignored, before, after) -> onChanged());

            countField.setText(Integer.toString(Math.max(1, count)));
            countField.setPromptText("1");
            countField.setPrefColumnCount(4);
            countField.textProperty().addListener((ignored, before, after) -> {
                if (!rebuilding) {
                    activateCustomMode();
                    refreshSummary();
                }
            });
            countField.focusedProperty().addListener((ignored, before, focused) -> {
                if (!focused) {
                    normalizeCountField();
                }
            });
            countField.setOnAction(event -> normalizeCountField());

            removeButton.getStyleClass().add("compact");
            removeButton.setOnAction(event -> {
                activateCustomMode();
                removeRow(this);
            });

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            root = new HBox(8, levelCombo, countField, spacer, removeButton);
            root.setAlignment(Pos.CENTER_LEFT);
        }

        private HBox root() {
            return root;
        }

        private int level() {
            Integer value = levelCombo.getValue();
            return value == null ? 1 : value;
        }

        private int count() {
            String raw = countField.getText();
            if (raw == null || raw.isBlank()) {
                return 0;
            }
            try {
                return Math.max(0, Integer.parseInt(raw));
            } catch (NumberFormatException exception) {
                return 0;
            }
        }

        private void onChanged() {
            if (!rebuilding) {
                activateCustomMode();
                refreshSummary();
            }
        }

        private void normalizeCountField() {
            int value = count();
            countField.setText(Integer.toString(value <= 0 ? 1 : value));
            if (!rebuilding) {
                activateCustomMode();
                refreshSummary();
            }
        }
    }

    private static TextField createIntegerField() {
        TextField field = new TextField();
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static List<Integer> levelOptions() {
        List<Integer> values = new ArrayList<>(20);
        for (int level = 1; level <= 20; level++) {
            values.add(level);
        }
        return values;
    }
}
