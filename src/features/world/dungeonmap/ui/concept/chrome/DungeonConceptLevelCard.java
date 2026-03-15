package features.world.dungeonmap.ui.concept.chrome;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.ui.concept.state.DungeonConceptLevelMetrics;
import features.world.dungeonmap.ui.shared.format.DungeonConceptTransitionText;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

final class DungeonConceptLevelCard extends VBox {

    private final long conceptLevelId;

    DungeonConceptLevelCard(
            DungeonConceptState state,
            DungeonConceptLevel level,
            boolean active,
            DungeonConceptLevelMetrics metrics,
            Consumer<Long> onActiveLevelSelected,
            Consumer<DungeonConceptStatePane.LevelPlanUpdate> onLevelPlanChanged,
            BiConsumer<Long, Long> onConnectionCreateRequested,
            Consumer<Long> onConnectionDeleteRequested
    ) {
        this.conceptLevelId = level.conceptLevelId();
        getStyleClass().addAll("dungeon-editor-card", "concept-level-card");
        setPadding(new Insets(8));
        setSpacing(5);

        Spinner<Integer> startLevelSpinner = DungeonConceptStateControls.createIntegerSpinner(1, 20, level.startLevel());
        Spinner<Integer> endLevelSpinner = DungeonConceptStateControls.createIntegerSpinner(1, 20, level.endLevel());
        TextField progressField = DungeonConceptStateControls.createDecimalField(DungeonConceptStateControls.formatDecimal(level.progressFraction()));
        TextField daysField = DungeonConceptStateControls.createDecimalField(DungeonConceptStateControls.formatDecimal(level.adventuringDaysTarget()));
        Spinner<Integer> entranceSpinner = DungeonConceptStateControls.createIntegerSpinner(0, 20, level.entranceCount());
        Spinner<Integer> exitSpinner = DungeonConceptStateControls.createIntegerSpinner(0, 20, level.exitCount());
        AtomicReference<DungeonConceptStatePane.LevelPlanUpdate> lastSubmitted = new AtomicReference<>();

        Runnable commit = () -> commitLevelPlan(
                level,
                startLevelSpinner,
                endLevelSpinner,
                progressField,
                daysField,
                entranceSpinner,
                exitSpinner,
                onLevelPlanChanged,
                lastSubmitted);

        startLevelSpinner.valueProperty().addListener((obs, oldValue, newValue) -> commit.run());
        endLevelSpinner.valueProperty().addListener((obs, oldValue, newValue) -> commit.run());
        entranceSpinner.valueProperty().addListener((obs, oldValue, newValue) -> commit.run());
        exitSpinner.valueProperty().addListener((obs, oldValue, newValue) -> commit.run());
        startLevelSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                DungeonConceptStateControls.commitSpinnerValue(startLevelSpinner);
            }
        });
        endLevelSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                DungeonConceptStateControls.commitSpinnerValue(endLevelSpinner);
            }
        });
        entranceSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                DungeonConceptStateControls.commitSpinnerValue(entranceSpinner);
            }
        });
        exitSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                DungeonConceptStateControls.commitSpinnerValue(exitSpinner);
            }
        });
        DungeonConceptStateControls.bindCommit(progressField, commit);
        DungeonConceptStateControls.bindCommit(daysField, commit);

        ComboBox<DungeonConceptLevel> addConnectionCombo = new ComboBox<>();
        addConnectionCombo.setConverter(levelLabelConverter());
        addConnectionCombo.setPrefWidth(110);
        addConnectionCombo.setMinWidth(110);
        addConnectionCombo.setMaxWidth(110);
        addConnectionCombo.setPromptText("Ebene...");
        addConnectionCombo.getStyleClass().add("concept-compact-combo");
        addConnectionCombo.getItems().setAll(availableTargets(state, level));
        addConnectionCombo.setDisable(addConnectionCombo.getItems().isEmpty());
        addConnectionCombo.setOnAction(event -> {
            DungeonConceptLevel selectedTarget = addConnectionCombo.getValue();
            if (selectedTarget == null) {
                return;
            }
            if (onConnectionCreateRequested != null) {
                onConnectionCreateRequested.accept(level.conceptLevelId(), selectedTarget.conceptLevelId());
            }
            addConnectionCombo.getSelectionModel().clearSelection();
        });

        FlowPane transitionRow = DungeonConceptStateControls.wrappingRow();
        for (DungeonConceptLevelConnection connection : connectionsForLevel(state, level.conceptLevelId())) {
            Long targetLevelId = connection.otherLevelId(level.conceptLevelId());
            DungeonConceptLevel targetLevel = state.findLevel(targetLevelId);
            if (targetLevel != null) {
                transitionRow.getChildren().add(buildConnectionToken(state, level, connection, targetLevel, onConnectionDeleteRequested));
            }
        }

        Label titleLabel = new Label(level.displayName());
        titleLabel.getStyleClass().add("dungeon-panel-title");
        HBox headerRow = new HBox(titleLabel);
        headerRow.setAlignment(Pos.CENTER_LEFT);
        FlowPane controlsRow = DungeonConceptStateControls.wrappingRow(
                DungeonConceptStateControls.labeledControl("Von", startLevelSpinner),
                DungeonConceptStateControls.labeledControl("Bis", endLevelSpinner),
                DungeonConceptStateControls.labeledControl("Fort", progressField),
                DungeonConceptStateControls.labeledControl("Tage", daysField),
                DungeonConceptStateControls.labeledControl("Ein", entranceSpinner),
                DungeonConceptStateControls.labeledControl("Aus", exitSpinner),
                DungeonConceptStateControls.metricValue("XP", metrics.progressTargetGroupXp() + " XP"),
                DungeonConceptStateControls.metricValue("Tage", DungeonConceptStateControls.formatDecimal(metrics.progressTargetDays())));

        Label transitionsLabel = new Label("Übergänge");
        transitionsLabel.getStyleClass().addAll("small", "text-muted");
        transitionRow.getChildren().add(0, addConnectionCombo);
        transitionRow.getChildren().add(0, transitionsLabel);
        VBox detailsBox = new VBox(5, controlsRow, transitionRow);
        detailsBox.setManaged(active);
        detailsBox.setVisible(active);

        getChildren().addAll(
                headerRow,
                detailsBox);

        setOnMouseClicked(event -> {
            if (onActiveLevelSelected != null) {
                onActiveLevelSelected.accept(level.conceptLevelId());
            }
        });
        if (active) {
            getStyleClass().add("selected");
        }
    }

    long conceptLevelId() {
        return conceptLevelId;
    }

    private static void commitLevelPlan(
            DungeonConceptLevel level,
            Spinner<Integer> startLevelSpinner,
            Spinner<Integer> endLevelSpinner,
            TextField progressField,
            TextField daysField,
            Spinner<Integer> entranceSpinner,
            Spinner<Integer> exitSpinner,
            Consumer<DungeonConceptStatePane.LevelPlanUpdate> onLevelPlanChanged,
            AtomicReference<DungeonConceptStatePane.LevelPlanUpdate> lastSubmitted
    ) {
        if (onLevelPlanChanged == null) {
            return;
        }
        DungeonConceptStateControls.commitSpinnerValue(startLevelSpinner);
        DungeonConceptStateControls.commitSpinnerValue(endLevelSpinner);
        DungeonConceptStateControls.commitSpinnerValue(entranceSpinner);
        DungeonConceptStateControls.commitSpinnerValue(exitSpinner);
        int startLevel = startLevelSpinner.getValue();
        int endLevel = Math.max(startLevel, endLevelSpinner.getValue());
        if (!Objects.equals(endLevel, endLevelSpinner.getValue())) {
            endLevelSpinner.getValueFactory().setValue(endLevel);
        }
        DungeonConceptStatePane.LevelPlanUpdate update = new DungeonConceptStatePane.LevelPlanUpdate(
                level.conceptLevelId(),
                startLevel,
                endLevel,
                DungeonConceptStateControls.parseDecimal(progressField.getText(), level.progressFraction()),
                DungeonConceptStateControls.parseDecimal(daysField.getText(), level.adventuringDaysTarget()),
                entranceSpinner.getValue(),
                exitSpinner.getValue());
        if (Objects.equals(lastSubmitted.get(), update)) {
            return;
        }
        lastSubmitted.set(update);
        onLevelPlanChanged.accept(update);
    }

    private static HBox buildConnectionToken(
            DungeonConceptState state,
            DungeonConceptLevel sourceLevel,
            DungeonConceptLevelConnection connection,
            DungeonConceptLevel targetLevel,
            Consumer<Long> onConnectionDeleteRequested
    ) {
        Label label = new Label(DungeonConceptTransitionText.targetChipLabel(
                state.connections(),
                state.levels(),
                sourceLevel.conceptLevelId(),
                connection));
        Button removeButton = new Button("×");
        removeButton.getStyleClass().add("compact");
        removeButton.setOnAction(event -> {
            event.consume();
            if (onConnectionDeleteRequested != null) {
                onConnectionDeleteRequested.accept(connection.connectionId());
            }
        });
        HBox token = new HBox(6, label, removeButton);
        token.setAlignment(Pos.CENTER_LEFT);
        token.getStyleClass().addAll("dungeon-editor-card", "compact", "concept-connection-token");
        token.setPadding(new Insets(2, 6, 2, 6));
        return token;
    }

    private static List<DungeonConceptLevel> availableTargets(DungeonConceptState state, DungeonConceptLevel sourceLevel) {
        List<DungeonConceptLevel> result = new java.util.ArrayList<>();
        for (DungeonConceptLevel level : state.levels()) {
            // Parallel transitions between the same pair of levels are intentional and must stay selectable.
            if (!Objects.equals(level.conceptLevelId(), sourceLevel.conceptLevelId())) {
                result.add(level);
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonConceptLevelConnection> connectionsForLevel(DungeonConceptState state, Long conceptLevelId) {
        if (state == null || conceptLevelId == null || state.connections() == null || state.connections().isEmpty()) {
            return List.of();
        }
        List<DungeonConceptLevelConnection> result = new java.util.ArrayList<>();
        for (DungeonConceptLevelConnection connection : state.connections()) {
            if (conceptLevelId.equals(connection.levelAId()) || conceptLevelId.equals(connection.levelBId())) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static StringConverter<DungeonConceptLevel> levelLabelConverter() {
        return new StringConverter<>() {
            @Override
            public String toString(DungeonConceptLevel level) {
                return level == null ? "" : level.displayName();
            }

            @Override
            public DungeonConceptLevel fromString(String string) {
                return null;
            }
        };
    }
}
