package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.LongConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/**
 * Szenen-Board als Single-Open-Akkordeon. Zu jedem Zeitpunkt ist höchstens eine Szene aufgeklappt
 * und damit editierbar; alle anderen sind read-only Zeilen. Aktualisierungen der Projektion werden
 * per {@code sceneToken} reconziliert (kein {@code setAll}-Vollneubau bei jedem Readback), sodass die
 * geöffnete Editor-Karte inklusive Fokus/Cursor über Mutationen hinweg stabil bleibt.
 */
public final class SessionPlannerTimelineMainView extends ScrollPane {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_FLAT = "flat";
    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;

    private final VBox rows = new VBox(8);
    private final Label emptyLabel = styledLabel("Noch keine Szenen.", STYLE_TEXT_SECONDARY, "session-planner-empty");
    private final Button addSceneButton = compactButton("Szene hinzufuegen", STYLE_ACCENT);
    private final Map<Long, SceneCard> sceneCards = new LinkedHashMap<>();
    private final Map<Integer, RestSeparator> restSeparators = new LinkedHashMap<>();

    private long openSceneToken;
    private SceneCard openCard;

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
        VBox content = new VBox(12, rows);
        content.getStyleClass().add("session-planner-main");
        addSceneButton.setOnAction(event -> addSceneHandler.run());
        setContent(content);
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
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
        render(viewModel.timelineProjectionProperty().get());
    }

    // --- rendering / reconciliation --------------------------------------------------------

    private void render(SessionPlannerViewModel.TimelineProjection projection) {
        if (projection == null) {
            return;
        }
        boolean disabled = projection.sessionActionsDisabled();
        List<SessionPlannerViewModel.TimelineProjection.SceneModel> scenes = projection.scenes();
        List<SessionPlannerViewModel.TimelineProjection.RestGapModel> restGaps = projection.restGaps();

        Set<Long> presentTokens = new HashSet<>();
        for (var scene : scenes) {
            presentTokens.add(scene.sceneToken());
        }
        if (openSceneToken != 0L && !presentTokens.contains(openSceneToken)) {
            openSceneToken = 0L;
            openCard = null;
        }

        List<Node> desired = new ArrayList<>();
        if (scenes.isEmpty()) {
            desired.add(emptyLabel);
        } else {
            for (int index = 0; index < scenes.size(); index++) {
                var scene = scenes.get(index);
                SceneCard card = sceneCards.computeIfAbsent(scene.sceneToken(), SceneCard::new);
                card.update(scene, index + 1, scene.sceneToken() == openSceneToken, disabled);
                desired.add(card);
                if (index < restGaps.size()) {
                    var gap = restGaps.get(index);
                    RestSeparator separator = restSeparators.computeIfAbsent(gap.gapIndex(), ignored -> new RestSeparator());
                    separator.update(gap, disabled);
                    desired.add(separator);
                }
            }
        }
        addSceneButton.setDisable(disabled);
        desired.add(addSceneButton);

        sceneCards.keySet().removeIf(token -> !presentTokens.contains(token));
        restSeparators.keySet().removeIf(gapIndex -> gapIndex >= restGaps.size());

        if (!rows.getChildren().equals(desired)) {
            rows.getChildren().setAll(desired);
        }
    }

    private void toggle(SceneCard card) {
        if (openCard == card) {
            collapse(card);
            return;
        }
        if (openCard != null) {
            collapse(openCard);
        }
        expand(card);
    }

    private void expand(SceneCard card) {
        openCard = card;
        openSceneToken = card.sceneToken;
        card.setExpanded(true);
        card.loadEditorFromModel();
        selectSceneHandler.accept(card.sceneToken);
    }

    private void collapse(SceneCard card) {
        card.commitIfDirty();
        card.setExpanded(false);
        if (openCard == card) {
            openCard = null;
            openSceneToken = 0L;
        }
    }

    // --- scene card ------------------------------------------------------------------------

    private final class SceneCard extends VBox {

        private final long sceneToken;
        private final Button toggleButton = compactButton("▶", STYLE_FLAT);
        private final Label headerTitle = styledLabel("", "session-planner-encounter-title");
        private final Label headerBudget = styledLabel("", STYLE_TEXT_SECONDARY);
        private final ProgressBar headerBar = new ProgressBar(0);
        private final Label headerLocation = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Button removeButton = compactButton("X", STYLE_FLAT);

        private final Label encounterName = styledLabel("", "session-planner-plan-name");
        private final Label encounterDetail = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Label encounterBudget = styledLabel("", "session-planner-encounter-budget");
        private final Label encounterComparison = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Label encounterBase = styledLabel("", STYLE_TEXT_SECONDARY);
        private final VBox encounterSummary = new VBox(4);

        private final TextField titleField = new TextField();
        private final LocationComboBox locationBox = new LocationComboBox();
        private final TextArea notesField = new TextArea();
        private final Label allocationLabel = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Button decreaseAllocation = compactButton("-10%", STYLE_FLAT);
        private final Button increaseAllocation = compactButton("+10%", STYLE_FLAT);
        private final Button moveUp = compactButton("Hoch", STYLE_FLAT);
        private final Button moveDown = compactButton("Runter", STYLE_FLAT);
        private final VBox lootRows = new VBox(6);
        private final Button addLoot = compactButton("Beutenotiz", STYLE_ACCENT);
        private final VBox editor = new VBox(6);

        private SessionPlannerViewModel.TimelineProjection.SceneModel model;
        private String loadedTitle = "";
        private String loadedNotes = "";
        private long loadedLocationId;

        private SceneCard(long sceneToken) {
            this.sceneToken = sceneToken;
            getStyleClass().add("session-planner-encounter-card");
            setSpacing(6);

            headerBar.getStyleClass().addAll("session-planner-budget-bar", "session-planner-budget-ok");
            headerBar.setPrefWidth(80);
            headerBar.setMaxWidth(80);
            toggleButton.getStyleClass().add("session-planner-scene-toggle");
            toggleButton.setOnAction(event -> toggle(this));
            HBox header = new HBox(8, toggleButton, headerTitle, headerBar, headerBudget, spacer(), headerLocation, removeButton);
            header.setAlignment(Pos.CENTER_LEFT);
            header.getStyleClass().add("session-planner-encounter-header");
            header.setOnMouseClicked(event -> toggle(this));
            removeButton.setOnAction(event -> removeSceneHandler.accept(sceneToken));

            encounterSummary.getChildren().setAll(
                    encounterName, encounterDetail, encounterBudget, encounterComparison, encounterBase);
            encounterSummary.getStyleClass().add("session-planner-scene-encounter-summary");

            titleField.setPromptText("Szenentitel");
            titleField.getStyleClass().add(STYLE_COMPACT);
            notesField.setPromptText("Szenennotizen");
            notesField.setPrefRowCount(2);
            notesField.getStyleClass().add(STYLE_COMPACT);
            Button save = compactButton("Szene speichern", STYLE_ACCENT);
            save.setOnAction(event -> saveNow());

            decreaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP.negate()));
            increaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP));
            moveUp.setOnAction(event -> moveHandler.handle(sceneToken, true));
            moveDown.setOnAction(event -> moveHandler.handle(sceneToken, false));
            addLoot.setOnAction(event -> addLootHandler.accept(sceneToken));

            editor.getChildren().setAll(
                    encounterSummary,
                    titleField,
                    actionRow(locationBox, save),
                    notesField,
                    actionRow(allocationLabel, decreaseAllocation, increaseAllocation),
                    actionRow(moveUp, moveDown),
                    new VBox(6, new HBox(8, styledLabel("Loot", "session-planner-gap-title"), addLoot), lootRows));
            editor.setVisible(false);
            editor.setManaged(false);

            getChildren().setAll(header, editor);
        }

        private void update(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                int position,
                boolean expanded,
                boolean disabled
        ) {
            this.model = scene;
            headerTitle.setText("Szene " + position + ": " + scene.displayTitle());
            headerBudget.setText(scene.budgetPercentageText());
            headerBar.setProgress(clampFraction(scene.budgetFraction()));
            headerLocation.setText(scene.locationLabel());
            removeButton.setDisable(disabled);

            boolean linked = scene.linkedEncounterPlan();
            if (linked) {
                encounterName.setText(scene.linkedEncounterName());
                encounterDetail.setText(scene.linkedEncounterCreatureCount() + " Kreaturen" + generatedSuffix(scene));
                encounterBudget.setText(scene.budgetPercentageText() + " Budget · Ziel " + scene.targetXpText() + " XP");
                encounterComparison.setText(scene.comparisonText() + " · " + scene.linkedEncounterDifficultyLabel());
                encounterBase.setText("Base " + scene.linkedEncounterTotalBaseXp() + " XP · Multiplikator x"
                        + String.format(Locale.US, "%.2f", scene.linkedEncounterXpMultiplier()));
            } else {
                encounterName.setText("Keine Begegnung verknuepft.");
                encounterDetail.setText("");
                encounterBudget.setText("");
                encounterComparison.setText("");
                encounterBase.setText("");
            }
            show(encounterDetail, linked);
            show(encounterBudget, linked);
            show(encounterComparison, linked);
            show(encounterBase, linked);

            allocationLabel.setText("Budget " + scene.budgetPercentageText());
            decreaseAllocation.setDisable(disabled || !linked);
            increaseAllocation.setDisable(disabled || !linked);
            moveUp.setDisable(disabled || !scene.canMoveUp());
            moveDown.setDisable(disabled || !scene.canMoveDown());
            addLoot.setDisable(disabled);
            renderLoot(scene, disabled);
            setExpanded(expanded);
        }

        private void setExpanded(boolean expanded) {
            toggleButton.setText(expanded ? "▼" : "▶");
            editor.setVisible(expanded);
            editor.setManaged(expanded);
        }

        /** Lädt die Editor-Felder aus dem Modell. Nur beim Aufklappen aufrufen — nie bei jedem Readback,
         * damit unbestätigte Eingaben nicht überschrieben werden. */
        private void loadEditorFromModel() {
            if (model == null) {
                return;
            }
            titleField.setText(model.sceneTitle());
            notesField.setText(model.sceneNotes());
            locationBox.setChoices(model.locationChoices(), model.locationId());
            loadedTitle = model.sceneTitle();
            loadedNotes = model.sceneNotes();
            loadedLocationId = model.locationId();
        }

        private void saveNow() {
            loadedTitle = titleField.getText().trim();
            loadedNotes = notesField.getText().trim();
            loadedLocationId = locationBox.selectedLocationId();
            saveSceneHandler.handle(sceneToken, loadedTitle, loadedNotes, loadedLocationId);
        }

        private void commitIfDirty() {
            if (!editor.isVisible()) {
                return;
            }
            String title = titleField.getText().trim();
            String notes = notesField.getText().trim();
            long locationId = locationBox.selectedLocationId();
            if (!title.equals(loadedTitle) || !notes.equals(loadedNotes) || locationId != loadedLocationId) {
                saveSceneHandler.handle(sceneToken, title, notes, locationId);
                loadedTitle = title;
                loadedNotes = notes;
                loadedLocationId = locationId;
            }
        }

        private void adjustAllocation(BigDecimal delta) {
            if (model == null) {
                return;
            }
            allocationHandler.handle(sceneToken, model.budgetPercentage().add(delta));
        }

        private void renderLoot(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                boolean disabled
        ) {
            List<Node> cards = new ArrayList<>();
            if (scene.lootEntries().isEmpty()) {
                cards.add(styledLabel("Keine Beutenotizen oder generierten Belohnungen.",
                        STYLE_TEXT_SECONDARY, "session-planner-empty"));
            } else {
                for (var loot : scene.lootEntries()) {
                    Button remove = compactButton("Entfernen", STYLE_FLAT);
                    remove.setDisable(disabled || !loot.manualNote());
                    remove.setOnAction(event -> removeLootHandler.accept(loot.token()));
                    String prefix = loot.manualNote() ? "Notiz: " : "Generierte Belohnung: ";
                    HBox row = new HBox(8, styledLabel(prefix + loot.label()), spacer(), remove);
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
            label.setText(gap.hasAssignedRest() ? "Rast: " + gap.label() : "Keine Rast zwischen den Szenen");
            label.getStyleClass().removeAll("session-planner-gap-active");
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

    private static HBox actionRow(Node... actions) {
        HBox row = new HBox(6, actions);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
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
