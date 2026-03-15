package features.world.dungeonmap.ui.concept.chrome;

import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.ui.concept.state.DungeonConceptLevelMetrics;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonSidebarCards;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.layout.VBox;

import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonConceptStatePane extends VBox {

    public record LevelPlanUpdate(
            long conceptLevelId,
            int startLevel,
            int endLevel,
            double progressFraction,
            double adventuringDaysTarget,
            int entranceCount,
            int exitCount
    ) {}

    private final Spinner<Integer> levelCountSpinner = DungeonConceptStateControls.createIntegerSpinner(1, 20, 1);
    private final Spinner<Integer> partySizeSpinner = DungeonConceptStateControls.createIntegerSpinner(1, 12, 4);
    private final VBox levelsBox = new VBox(8);

    private boolean updating;

    private Consumer<Integer> onLevelCountChanged;
    private Consumer<Integer> onPartySizeChanged;
    private Consumer<Long> onActiveLevelSelected;
    private Consumer<LevelPlanUpdate> onLevelPlanChanged;
    private BiConsumer<Long, Long> onConnectionCreateRequested;
    private Consumer<Long> onConnectionDeleteRequested;
    private Integer lastEmittedLevelCount;
    private Integer lastEmittedPartySize;

    public DungeonConceptStatePane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-tool-settings-pane");
        setSpacing(8);
        setPadding(new Insets(8));

        levelCountSpinner.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!updating && onLevelCountChanged != null && newValue != null) {
                emitLevelCountChanged(levelCountSpinner.getValue());
            }
        });
        partySizeSpinner.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!updating && onPartySizeChanged != null && newValue != null) {
                emitPartySizeChanged(partySizeSpinner.getValue());
            }
        });
        levelCountSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused && !updating) {
                DungeonConceptStateControls.commitSpinnerValue(levelCountSpinner);
            }
        });
        partySizeSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused && !updating) {
                DungeonConceptStateControls.commitSpinnerValue(partySizeSpinner);
            }
        });

        VBox dungeonCard = DungeonSidebarCards.createCard(
                "Dungeon",
                DungeonConceptStateControls.compactRow(
                        DungeonConceptStateControls.labeledControl("Ebenen", levelCountSpinner),
                        DungeonConceptStateControls.labeledControl("Spieler", partySizeSpinner)));
        dungeonCard.getStyleClass().add("concept-level-card");

        getChildren().addAll(dungeonCard, levelsBox);
    }

    public void showState(
            DungeonConceptState state,
            Long activeLevelId,
            Map<Long, DungeonConceptLevelMetrics> metricsByLevelId
    ) {
        updating = true;
        try {
            boolean loaded = state != null && state.map() != null;
            int levelCount = loaded && state.levels() != null && !state.levels().isEmpty() ? state.levels().size() : 1;
            levelCountSpinner.getValueFactory().setValue(levelCount);
            partySizeSpinner.getValueFactory().setValue(
                    state != null && state.partyProfile() != null ? state.partyProfile().partySize() : 4);
            lastEmittedLevelCount = levelCountSpinner.getValue();
            lastEmittedPartySize = partySizeSpinner.getValue();
            levelCountSpinner.setDisable(!loaded);
            partySizeSpinner.setDisable(!loaded);

            levelsBox.getChildren().clear();
            if (!loaded || state.levels().isEmpty()) {
                levelsBox.getChildren().add(createEmptyCard());
                return;
            }

            for (var level : state.levels()) {
                levelsBox.getChildren().add(new DungeonConceptLevelCard(
                        state,
                        level,
                        Objects.equals(activeLevelId, level.conceptLevelId()),
                        metricsByLevelId == null ? DungeonConceptLevelMetrics.empty()
                                : metricsByLevelId.getOrDefault(level.conceptLevelId(), DungeonConceptLevelMetrics.empty()),
                        this::emitActiveLevelSelected,
                        this::emitLevelPlanChanged,
                        this::emitConnectionCreateRequested,
                        this::emitConnectionDeleteRequested));
            }
        } finally {
            updating = false;
        }
    }

    public void setOnLevelCountChanged(Consumer<Integer> onLevelCountChanged) {
        this.onLevelCountChanged = onLevelCountChanged;
    }

    public void setOnPartySizeChanged(Consumer<Integer> onPartySizeChanged) {
        this.onPartySizeChanged = onPartySizeChanged;
    }

    public void setOnActiveLevelSelected(Consumer<Long> onActiveLevelSelected) {
        this.onActiveLevelSelected = onActiveLevelSelected;
    }

    public void setOnLevelPlanChanged(Consumer<LevelPlanUpdate> onLevelPlanChanged) {
        this.onLevelPlanChanged = onLevelPlanChanged;
    }

    public void setOnConnectionCreateRequested(BiConsumer<Long, Long> onConnectionCreateRequested) {
        this.onConnectionCreateRequested = onConnectionCreateRequested;
    }

    public void setOnConnectionDeleteRequested(Consumer<Long> onConnectionDeleteRequested) {
        this.onConnectionDeleteRequested = onConnectionDeleteRequested;
    }

    private void emitActiveLevelSelected(Long conceptLevelId) {
        if (!updating && onActiveLevelSelected != null) {
            onActiveLevelSelected.accept(conceptLevelId);
        }
    }

    private void emitLevelPlanChanged(LevelPlanUpdate update) {
        if (!updating && onLevelPlanChanged != null) {
            onLevelPlanChanged.accept(update);
        }
    }

    private void emitConnectionCreateRequested(Long sourceLevelId, Long targetLevelId) {
        if (!updating && onConnectionCreateRequested != null) {
            onConnectionCreateRequested.accept(sourceLevelId, targetLevelId);
        }
    }

    private void emitConnectionDeleteRequested(Long connectionId) {
        if (!updating && onConnectionDeleteRequested != null) {
            onConnectionDeleteRequested.accept(connectionId);
        }
    }

    private void emitLevelCountChanged(int levelCount) {
        if (!updating && onLevelCountChanged != null && !Objects.equals(lastEmittedLevelCount, levelCount)) {
            lastEmittedLevelCount = levelCount;
            onLevelCountChanged.accept(levelCount);
        }
    }

    private void emitPartySizeChanged(int partySize) {
        if (!updating && onPartySizeChanged != null && !Objects.equals(lastEmittedPartySize, partySize)) {
            lastEmittedPartySize = partySize;
            onPartySizeChanged.accept(partySize);
        }
    }

    private static VBox createEmptyCard() {
        VBox box = DungeonSidebarCards.createCard("Ebenen");
        box.getStyleClass().add("concept-level-card");
        Label label = new Label("Kein Dungeon geladen");
        label.getStyleClass().add("text-muted");
        box.getChildren().add(label);
        return box;
    }
}
