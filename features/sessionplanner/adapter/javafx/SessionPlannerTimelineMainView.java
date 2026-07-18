package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.LongConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.SplitPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.input.ClipboardContent;
import javafx.scene.input.Dragboard;
import javafx.scene.input.TransferMode;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/**
 * Master-Detail-Ansicht des Session Planners im {@code COCKPIT_MAIN}-Slot. Links eine kompakte,
 * per Drag&amp;Drop umsortierbare Szenenliste (Master) mit Rast-Verbindern; rechts der
 * mechanik-zentrierte Szenen-Inspector (Detail) für die aktuell gewählte Szene. Auswahl (nicht
 * Aufklappen) treibt den Inspector. Aktualisierungen werden per {@code sceneToken} reconziliert,
 * sodass Fokus/Cursor und unbestätigte Eingaben über Mutationen hinweg stabil bleiben. Es gibt nur
 * ein Speichermodell: Editorfelder committen automatisch bei Fokusverlust bzw. Szenenwechsel.
 */
public final class SessionPlannerTimelineMainView extends SplitPane {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_FLAT = "flat";
    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final VBox rows = new VBox(6);
    private final Label emptyLabel = styledLabel(
            "Noch keine Szenen. Lege eine Szene an oder generiere eine Session.",
            STYLE_TEXT_SECONDARY, "session-planner-empty");
    private final Button addSceneButton = compactButton("+ Szene", STYLE_ACCENT);
    private final ProgressBar overallBudgetBar = new ProgressBar(0);
    private final Label overallBudgetLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Map<Long, SceneRow> sceneRows = new LinkedHashMap<>();
    private final Map<Integer, RestSeparator> restSeparators = new LinkedHashMap<>();
    private final SceneInspector inspector = new SceneInspector();

    private List<SessionPlannerViewModel.TimelineProjection.SceneModel> currentScenes = List.of();
    private boolean sessionActive;

    private Runnable addSceneHandler = () -> { };
    private LongConsumer selectSceneHandler = ignored -> { };
    private AllocationHandler allocationHandler = (token, percentage) -> { };
    private MoveHandler moveHandler = (token, up) -> { };
    private LongConsumer removeSceneHandler = ignored -> { };
    private SceneEditHandler saveSceneHandler = (token, title, notes, locationId) -> { };
    private RestHandler shortRestHandler = (left, right) -> { };
    private RestHandler longRestHandler = (left, right) -> { };
    private RestHandler clearRestHandler = (left, right) -> { };
    private LongConsumer addLootHandler = ignored -> { };
    private LongConsumer removeLootHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        addSceneButton.setOnAction(event -> addSceneHandler.run());

        VBox listContent = new VBox(6, rows);
        listContent.getStyleClass().add("session-planner-scene-list");
        ScrollPane listScroll = new ScrollPane(listContent);
        listScroll.getStyleClass().add("session-planner-main-scroll");
        listScroll.setFitToWidth(true);
        listScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);

        overallBudgetBar.getStyleClass().addAll("session-planner-budget-bar", "session-planner-budget-ok");
        overallBudgetBar.setMaxWidth(Double.MAX_VALUE);
        VBox footer = new VBox(3, overallBudgetLabel, overallBudgetBar);
        footer.getStyleClass().add("session-planner-budget-footer");

        BorderPane masterPane = new BorderPane(listScroll);
        masterPane.setBottom(footer);
        masterPane.getStyleClass().add("session-planner-master");

        getStyleClass().add("session-planner-master-detail");
        getItems().setAll(masterPane, inspector);
        setDividerPositions(0.54);
        SplitPane.setResizableWithParent(inspector, Boolean.TRUE);
    }

    // --- typed callbacks -------------------------------------------------------------------

    public void onAddScene(Runnable handler) {
        addSceneHandler = handler == null ? () -> { } : handler;
    }

    public void onSelectScene(LongConsumer handler) {
        selectSceneHandler = handler == null ? ignored -> { } : handler;
    }

    public void onSetAllocation(AllocationHandler handler) {
        allocationHandler = handler == null ? (token, percentage) -> { } : handler;
    }

    public void onMoveScene(MoveHandler handler) {
        moveHandler = handler == null ? (token, up) -> { } : handler;
    }

    public void onRemoveScene(LongConsumer handler) {
        removeSceneHandler = handler == null ? ignored -> { } : handler;
    }

    public void onSaveScene(SceneEditHandler handler) {
        saveSceneHandler = handler == null ? (token, title, notes, locationId) -> { } : handler;
    }

    public void onShortRest(RestHandler handler) {
        shortRestHandler = handler == null ? (left, right) -> { } : handler;
    }

    public void onLongRest(RestHandler handler) {
        longRestHandler = handler == null ? (left, right) -> { } : handler;
    }

    public void onClearRest(RestHandler handler) {
        clearRestHandler = handler == null ? (left, right) -> { } : handler;
    }

    public void onAddLoot(LongConsumer handler) {
        addLootHandler = handler == null ? ignored -> { } : handler;
    }

    public void onRemoveLoot(LongConsumer handler) {
        removeLootHandler = handler == null ? ignored -> { } : handler;
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.timelineProjectionProperty().addListener((ignored, before, after) -> render(after));
        viewModel.summaryProjectionProperty().addListener((ignored, before, after) -> renderSummary(after));
        render(viewModel.timelineProjectionProperty().get());
        renderSummary(viewModel.summaryProjectionProperty().get());
    }

    // --- rendering / reconciliation --------------------------------------------------------

    private void render(SessionPlannerViewModel.TimelineProjection projection) {
        if (projection == null) {
            return;
        }
        boolean disabled = projection.sessionActionsDisabled();
        sessionActive = !disabled;
        List<SessionPlannerViewModel.TimelineProjection.SceneModel> scenes = projection.scenes();
        List<SessionPlannerViewModel.TimelineProjection.RestGapModel> restGaps = projection.restGaps();
        currentScenes = scenes;

        List<Node> desired = new ArrayList<>();
        if (scenes.isEmpty()) {
            desired.add(disabled ? sessionPrompt() : emptyLabel);
        } else {
            for (int index = 0; index < scenes.size(); index++) {
                var scene = scenes.get(index);
                SceneRow row = sceneRows.computeIfAbsent(scene.sceneToken(), SceneRow::new);
                row.update(scene, index + 1, scene.selected(), disabled);
                desired.add(row);
                if (index < restGaps.size()) {
                    var gap = restGaps.get(index);
                    RestSeparator separator = restSeparators.computeIfAbsent(gap.gapIndex(), ignored -> new RestSeparator());
                    separator.update(gap, disabled);
                    desired.add(separator);
                }
            }
        }
        addSceneButton.setDisable(disabled);
        if (!disabled) {
            desired.add(addSceneButton);
        }

        java.util.Set<Long> presentTokens = new java.util.HashSet<>();
        scenes.forEach(scene -> presentTokens.add(scene.sceneToken()));
        sceneRows.keySet().removeIf(token -> !presentTokens.contains(token));
        restSeparators.keySet().removeIf(gapIndex -> gapIndex >= restGaps.size());

        if (!rows.getChildren().equals(desired)) {
            rows.getChildren().setAll(desired);
        }

        inspector.showSelection(selectedScene(scenes), disabled);
    }

    private void renderSummary(SessionPlannerViewModel.SummaryProjection summary) {
        if (summary == null || !summary.budgetAvailable()) {
            overallBudgetLabel.setText("");
            overallBudgetBar.setProgress(0);
            overallBudgetBar.setVisible(false);
            overallBudgetBar.setManaged(false);
            return;
        }
        overallBudgetBar.setVisible(true);
        overallBudgetBar.setManaged(true);
        overallBudgetBar.setProgress(clampFraction(summary.progressFraction()));
        overallBudgetBar.getStyleClass().removeAll("session-planner-budget-ok", "session-planner-budget-over");
        overallBudgetBar.getStyleClass().add(summary.overBudget()
                ? "session-planner-budget-over" : "session-planner-budget-ok");
        overallBudgetLabel.setText(summary.overBudget()
                ? "Budget: " + formatXp(summary.plannedEncounterXp()) + " / " + formatXp(summary.totalBudgetXp())
                        + " XP · " + formatXp(summary.overBudgetXp()) + " XP über Budget"
                : "Budget: " + formatXp(summary.plannedEncounterXp()) + " / " + formatXp(summary.totalBudgetXp())
                        + " XP · " + formatXp(summary.remainingXp()) + " XP frei");
    }

    private static SessionPlannerViewModel.TimelineProjection.SceneModel selectedScene(
            List<SessionPlannerViewModel.TimelineProjection.SceneModel> scenes
    ) {
        for (var scene : scenes) {
            if (scene.selected()) {
                return scene;
            }
        }
        return null;
    }

    private Node sessionPrompt() {
        Label headline = styledLabel("Keine Session gewählt.", "session-planner-plan-name");
        Label hint = styledLabel(
                "Wähle links oben eine Session oder lege eine neue an.",
                STYLE_TEXT_SECONDARY, "session-planner-empty");
        VBox box = new VBox(6, headline, hint);
        box.setAlignment(Pos.TOP_LEFT);
        return box;
    }

    private int indexOfToken(long sceneToken) {
        for (int index = 0; index < currentScenes.size(); index++) {
            if (currentScenes.get(index).sceneToken() == sceneToken) {
                return index;
            }
        }
        return -1;
    }

    /** Übersetzt eine Drop-Reihenfolge in eine Folge von Ein-Schritt-Moves (die API kennt nur
     * hoch/runter). Jeder Move re-published synchron; das {@code sceneToken} bleibt stabil. */
    private void reorderScene(long sourceToken, int targetIndex) {
        int sourceIndex = indexOfToken(sourceToken);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex == targetIndex) {
            return;
        }
        boolean up = targetIndex < sourceIndex;
        int steps = Math.abs(targetIndex - sourceIndex);
        for (int step = 0; step < steps; step++) {
            moveHandler.handle(sourceToken, up);
        }
    }

    // --- master row ------------------------------------------------------------------------

    private final class SceneRow extends HBox {

        private final long sceneToken;
        private final Label dragHandle = styledLabel("⠿", STYLE_TEXT_SECONDARY, "session-planner-drag-handle");
        private final Label positionLabel = styledLabel("", "session-planner-scene-position");
        private final Label titleLabel = styledLabel("", "session-planner-encounter-title");
        private final ProgressBar miniBar = new ProgressBar(0);
        private final Label budgetLabel = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Label locationChip = styledLabel("", STYLE_TEXT_SECONDARY, "session-planner-location-chip");

        private SceneRow(long sceneToken) {
            super(8);
            this.sceneToken = sceneToken;
            setAlignment(Pos.CENTER_LEFT);
            getStyleClass().add("session-planner-scene-row");
            miniBar.getStyleClass().addAll("session-planner-budget-bar", "session-planner-budget-ok");
            miniBar.setPrefWidth(56);
            miniBar.setMaxWidth(56);
            getChildren().setAll(dragHandle, positionLabel, titleLabel, spacer(), miniBar, budgetLabel, locationChip);
            setOnMouseClicked(event -> select());
            configureDragAndDrop();
        }

        private void update(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                int position,
                boolean selected,
                boolean disabled
        ) {
            positionLabel.setText(position + ".");
            titleLabel.setText(scene.displayTitle());
            boolean linked = scene.linkedEncounterPlan();
            miniBar.setProgress(clampFraction(scene.budgetFraction()));
            show(miniBar, linked);
            budgetLabel.setText(linked ? scene.budgetPercentageText() : "—");
            String location = scene.locationLabel();
            boolean hasLocation = location != null && !location.isBlank() && !"Keine Location".equals(location);
            locationChip.setText(hasLocation ? location : "");
            show(locationChip, hasLocation);
            getStyleClass().remove("session-planner-scene-row-selected");
            if (selected) {
                getStyleClass().add("session-planner-scene-row-selected");
            }
            dragHandle.setDisable(disabled);
        }

        private void select() {
            inspector.commitIfDirty();
            selectSceneHandler.accept(sceneToken);
        }

        private void configureDragAndDrop() {
            setOnDragDetected(event -> {
                if (!sessionActive) {
                    return;
                }
                Dragboard dragboard = startDragAndDrop(TransferMode.MOVE);
                ClipboardContent content = new ClipboardContent();
                content.putString(Long.toString(sceneToken));
                dragboard.setContent(content);
                event.consume();
            });
            setOnDragOver(event -> {
                if (event.getGestureSource() != this && event.getDragboard().hasString()) {
                    event.acceptTransferModes(TransferMode.MOVE);
                }
                event.consume();
            });
            setOnDragEntered(event -> {
                if (event.getGestureSource() != this && event.getDragboard().hasString()) {
                    getStyleClass().add("session-planner-scene-row-drop");
                }
                event.consume();
            });
            setOnDragExited(event -> {
                getStyleClass().remove("session-planner-scene-row-drop");
                event.consume();
            });
            setOnDragDropped(event -> {
                boolean completed = false;
                if (event.getDragboard().hasString()) {
                    long sourceToken = parseToken(event.getDragboard().getString());
                    if (sourceToken > 0L && sourceToken != sceneToken) {
                        reorderScene(sourceToken, indexOfToken(sceneToken));
                        completed = true;
                    }
                }
                getStyleClass().remove("session-planner-scene-row-drop");
                event.setDropCompleted(completed);
                event.consume();
            });
        }
    }

    // --- scene inspector (detail) ----------------------------------------------------------

    private final class SceneInspector extends ScrollPane {

        private final Label headerTitle = styledLabel("", "session-planner-inspector-title");
        private final Button removeButton = iconButton("✕", "Szene entfernen", "Szene entfernen");

        private final Label encounterName = styledLabel("", "session-planner-plan-name");
        private final Label encounterDetail = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Label encounterComparison = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Label encounterBase = styledLabel("", STYLE_TEXT_SECONDARY);
        private final VBox encounterSummary = new VBox(3, encounterName, encounterDetail, encounterComparison, encounterBase);

        private final TextField budgetField = new TextField();
        private final Button decreaseAllocation = compactButton("-10", STYLE_FLAT);
        private final Button increaseAllocation = compactButton("+10", STYLE_FLAT);
        private final ProgressBar budgetBar = new ProgressBar(0);
        private final VBox budgetSection = new VBox(4);

        private final TextField titleField = new TextField();
        private final LocationComboBox locationBox = new LocationComboBox();
        private final TextArea notesField = new TextArea();

        private final VBox lootRows = new VBox(4);
        private final Button addLoot = compactButton("+ Loot-Platzhalter", STYLE_FLAT);

        private final VBox editor = new VBox(12);
        private final Label placeholder = styledLabel(
                "Wähle links eine Szene, um sie zu bearbeiten.",
                STYLE_TEXT_SECONDARY, "session-planner-empty");
        private final VBox content = new VBox(12);

        private SessionPlannerViewModel.TimelineProjection.SceneModel model;
        private long loadedToken;
        private String loadedTitle = "";
        private String loadedNotes = "";
        private long loadedLocationId;

        private SceneInspector() {
            getStyleClass().add("session-planner-inspector-scroll");
            setFitToWidth(true);
            setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);

            HBox header = new HBox(8, headerTitle, spacer(), removeButton);
            header.setAlignment(Pos.CENTER_LEFT);
            header.getStyleClass().add("session-planner-inspector-header");
            removeButton.setOnAction(event -> {
                if (loadedToken > 0L) {
                    removeSceneHandler.accept(loadedToken);
                }
            });

            encounterSummary.getStyleClass().add("session-planner-scene-encounter-summary");

            budgetField.setPromptText("%");
            budgetField.setPrefColumnCount(4);
            budgetField.getStyleClass().add(STYLE_COMPACT);
            budgetField.setOnAction(event -> commitBudgetFromField());
            budgetField.focusedProperty().addListener((observable, was, focused) -> {
                if (!focused) {
                    commitBudgetFromField();
                }
            });
            decreaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP.negate()));
            increaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP));
            budgetBar.getStyleClass().addAll("session-planner-budget-bar", "session-planner-budget-ok");
            budgetBar.setMaxWidth(Double.MAX_VALUE);
            HBox budgetRow = new HBox(6,
                    styledLabel("Budget", "session-planner-card-title"), budgetField,
                    styledLabel("%", STYLE_TEXT_SECONDARY), decreaseAllocation, increaseAllocation);
            budgetRow.setAlignment(Pos.CENTER_LEFT);
            budgetSection.getChildren().setAll(budgetRow, budgetBar);

            titleField.setPromptText("Szenentitel");
            titleField.getStyleClass().add(STYLE_COMPACT);
            titleField.setOnAction(event -> commitIfDirty());
            titleField.focusedProperty().addListener((observable, was, focused) -> {
                if (!focused) {
                    commitIfDirty();
                }
            });
            locationBox.getSelectionModel().selectedItemProperty().addListener((observable, before, after) -> commitIfDirty());
            notesField.setPromptText("Szenennotizen");
            notesField.setPrefRowCount(3);
            notesField.setWrapText(true);
            notesField.getStyleClass().add(STYLE_COMPACT);
            notesField.focusedProperty().addListener((observable, was, focused) -> {
                if (!focused) {
                    commitIfDirty();
                }
            });
            VBox detailsSection = new VBox(6,
                    styledLabel("Details", "session-planner-card-title"),
                    titleField, locationBox, notesField);

            addLoot.setOnAction(event -> {
                if (loadedToken > 0L) {
                    addLootHandler.accept(loadedToken);
                }
            });
            VBox lootSection = new VBox(6,
                    new HBox(8, styledLabel("Loot", "session-planner-card-title"), spacer(), addLoot),
                    lootRows);

            editor.getChildren().setAll(header, card(encounterSummary), card(budgetSection),
                    card(detailsSection), card(lootSection));
            content.getChildren().setAll(placeholder);
            content.getStyleClass().add("session-planner-inspector");
            setContent(content);
        }

        private void showSelection(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                boolean disabled
        ) {
            if (scene == null) {
                if (loadedToken != 0L) {
                    loadedToken = 0L;
                }
                if (!content.getChildren().equals(List.of(placeholder))) {
                    content.getChildren().setAll(placeholder);
                }
                return;
            }
            boolean tokenChanged = scene.sceneToken() != loadedToken;
            this.model = scene;
            if (!content.getChildren().equals(List.of(editor))) {
                content.getChildren().setAll(editor);
            }
            if (tokenChanged) {
                loadEditorFromModel(scene);
            }
            updateReadOnly(scene, disabled);
        }

        private void loadEditorFromModel(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
            loadedToken = scene.sceneToken();
            titleField.setText(scene.sceneTitle());
            notesField.setText(scene.sceneNotes());
            locationBox.setChoices(scene.locationChoices(), scene.locationId());
            loadedTitle = scene.sceneTitle();
            loadedNotes = scene.sceneNotes();
            loadedLocationId = scene.locationId();
        }

        private void updateReadOnly(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                boolean disabled
        ) {
            headerTitle.setText("Szene: " + scene.displayTitle());
            removeButton.setDisable(disabled);
            boolean linked = scene.linkedEncounterPlan();
            if (linked) {
                encounterName.setText(scene.linkedEncounterName());
                encounterDetail.setText(scene.linkedEncounterCreatureCount() + " Kreaturen · "
                        + scene.linkedEncounterDifficultyLabel() + generatedSuffix(scene));
                encounterComparison.setText(scene.comparisonText());
                encounterBase.setText("Base " + scene.linkedEncounterTotalBaseXp() + " XP · Multiplikator x"
                        + String.format(Locale.US, "%.2f", scene.linkedEncounterXpMultiplier()));
            } else {
                encounterName.setText("Keine Begegnung verknüpft.");
                encounterDetail.setText("Hänge links eine gespeicherte Begegnung an, um XP zu verplanen.");
                encounterComparison.setText("");
                encounterBase.setText("");
            }
            show(encounterComparison, linked);
            show(encounterBase, linked);

            if (!budgetField.isFocused()) {
                budgetField.setText(plainPercent(scene.budgetPercentage()));
            }
            budgetBar.setProgress(clampFraction(scene.budgetFraction()));
            budgetField.setDisable(disabled || !linked);
            decreaseAllocation.setDisable(disabled || !linked);
            increaseAllocation.setDisable(disabled || !linked);

            titleField.setDisable(disabled);
            locationBox.setDisable(disabled);
            notesField.setDisable(disabled);
            addLoot.setDisable(disabled);
            renderLoot(scene, disabled);
        }

        private void commitIfDirty() {
            if (loadedToken <= 0L) {
                return;
            }
            String title = titleField.getText().trim();
            String notes = notesField.getText().trim();
            long locationId = locationBox.selectedLocationId();
            if (!title.equals(loadedTitle) || !notes.equals(loadedNotes) || locationId != loadedLocationId) {
                saveSceneHandler.handle(loadedToken, title, notes, locationId);
                loadedTitle = title;
                loadedNotes = notes;
                loadedLocationId = locationId;
            }
        }

        private void commitBudgetFromField() {
            if (model == null || loadedToken <= 0L || !model.linkedEncounterPlan()) {
                return;
            }
            BigDecimal parsed = SessionPlannerVocabulary.parsePositiveDecimal(budgetField.getText());
            if (parsed == null) {
                budgetField.setText(plainPercent(model.budgetPercentage()));
                return;
            }
            BigDecimal clamped = parsed.min(HUNDRED).max(BigDecimal.ZERO);
            if (clamped.compareTo(model.budgetPercentage()) != 0) {
                allocationHandler.handle(loadedToken, clamped);
            }
        }

        private void adjustAllocation(BigDecimal delta) {
            if (model == null || loadedToken <= 0L) {
                return;
            }
            BigDecimal next = model.budgetPercentage().add(delta).min(HUNDRED).max(BigDecimal.ZERO);
            allocationHandler.handle(loadedToken, next);
        }

        private void renderLoot(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                boolean disabled
        ) {
            List<Node> cards = new ArrayList<>();
            if (scene.lootPlaceholders().isEmpty()) {
                cards.add(styledLabel("Keine Loot-Platzhalter für diese Szene.",
                        STYLE_TEXT_SECONDARY, "session-planner-empty"));
            } else {
                for (var loot : scene.lootPlaceholders()) {
                    Button remove = iconButton("✕", "Loot-Platzhalter entfernen", "Entfernen");
                    remove.setDisable(disabled);
                    remove.setOnAction(event -> removeLootHandler.accept(loot.token()));
                    HBox row = new HBox(8, styledLabel(loot.label()), spacer(), remove);
                    row.setAlignment(Pos.CENTER_LEFT);
                    row.getStyleClass().add("session-planner-loot-card");
                    cards.add(row);
                }
            }
            lootRows.getChildren().setAll(cards);
        }

        private static String generatedSuffix(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene
        ) {
            return scene.linkedEncounterGeneratedLabel().isBlank()
                    ? ""
                    : " · " + scene.linkedEncounterGeneratedLabel();
        }
    }

    // --- rest separator --------------------------------------------------------------------

    private final class RestSeparator extends HBox {

        private final Label label = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Button shortRest = compactButton("Kurze Rast", STYLE_FLAT);
        private final Button longRest = compactButton("Lange Rast", STYLE_FLAT);
        private final Button clear = compactButton("Leeren", STYLE_FLAT);
        private long leftSceneToken;
        private long rightSceneToken;

        private RestSeparator() {
            super(6);
            setAlignment(Pos.CENTER_LEFT);
            getStyleClass().add("session-planner-rest-separator");
            shortRest.setOnAction(event -> shortRestHandler.handle(leftSceneToken, rightSceneToken));
            longRest.setOnAction(event -> longRestHandler.handle(leftSceneToken, rightSceneToken));
            clear.setOnAction(event -> clearRestHandler.handle(leftSceneToken, rightSceneToken));
            getChildren().setAll(label, spacer(), shortRest, longRest, clear);
        }

        private void update(
                SessionPlannerViewModel.TimelineProjection.RestGapModel gap,
                boolean disabled
        ) {
            this.leftSceneToken = gap.leftSceneToken();
            this.rightSceneToken = gap.rightSceneToken();
            label.setText(gap.hasAssignedRest() ? "Rast: " + gap.label() : "Keine Rast");
            label.getStyleClass().remove("session-planner-gap-active");
            if (gap.hasAssignedRest()) {
                label.getStyleClass().add("session-planner-gap-active");
            }
            shortRest.setDisable(disabled);
            longRest.setDisable(disabled);
            clear.setDisable(disabled || !gap.hasAssignedRest());
        }
    }

    // --- location combo box ----------------------------------------------------------------

    private static final class LocationComboBox
            extends ComboBox<SessionPlannerViewModel.TimelineProjection.LocationChoice> {

        private LocationComboBox() {
            setPromptText("Location");
            setMaxWidth(Double.MAX_VALUE);
            getStyleClass().add(STYLE_COMPACT);
            setConverter(new StringConverter<>() {
                @Override
                public String toString(SessionPlannerViewModel.TimelineProjection.LocationChoice value) {
                    return value == null ? "" : value.toString();
                }

                @Override
                public SessionPlannerViewModel.TimelineProjection.LocationChoice fromString(String text) {
                    return getValue();
                }
            });
        }

        private void setChoices(
                List<SessionPlannerViewModel.TimelineProjection.LocationChoice> choices,
                long selectedLocationId
        ) {
            getItems().setAll(choices == null ? List.of() : choices);
            getSelectionModel().select(choiceForLocationId(selectedLocationId));
        }

        private long selectedLocationId() {
            var selected = getValue();
            return selected == null ? 0L : selected.id();
        }

        private SessionPlannerViewModel.TimelineProjection.LocationChoice choiceForLocationId(long locationId) {
            for (var choice : getItems()) {
                if (choice.id() == locationId) {
                    return choice;
                }
            }
            return getItems().isEmpty() ? null : getItems().getFirst();
        }
    }

    // --- shared helpers --------------------------------------------------------------------

    private static long parseToken(String value) {
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    private static String plainPercent(BigDecimal percentage) {
        BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
        return safe.toPlainString();
    }

    private static String formatXp(int value) {
        return java.text.NumberFormat.getIntegerInstance(Locale.GERMANY).format(Math.max(0, value));
    }

    private static double clampFraction(double value) {
        if (value < 0) {
            return 0;
        }
        return Math.min(value, 1.0);
    }

    private static void show(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }

    private static VBox card(Node body) {
        VBox card = new VBox(6, body);
        card.getStyleClass().add("session-planner-card");
        return card;
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }

    private static Label styledLabel(String text, String... styleClasses) {
        Label label = new Label(text);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }

    private static Button compactButton(String text, String... emphasisStyles) {
        Button button = new Button(text);
        button.getStyleClass().add(STYLE_COMPACT);
        button.getStyleClass().addAll(emphasisStyles);
        return button;
    }

    private static Button iconButton(String glyph, String tooltip, String accessibleText) {
        Button button = new Button(glyph);
        button.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT, "session-planner-icon-button");
        button.setTooltip(new Tooltip(tooltip));
        button.setAccessibleText(accessibleText);
        return button;
    }

    // --- callback types --------------------------------------------------------------------

    @FunctionalInterface
    public interface AllocationHandler {
        void handle(long sceneToken, BigDecimal newPercentage);
    }

    @FunctionalInterface
    public interface MoveHandler {
        void handle(long sceneToken, boolean up);
    }

    @FunctionalInterface
    public interface SceneEditHandler {
        void handle(long sceneToken, String title, String notes, long locationId);
    }

    @FunctionalInterface
    public interface RestHandler {
        void handle(long leftSceneToken, long rightSceneToken);
    }
}
