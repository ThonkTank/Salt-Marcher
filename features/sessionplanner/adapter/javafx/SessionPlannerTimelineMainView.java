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
    private static final int MIN_PLAN_QUERY_LENGTH = 2;
    private static final int MAX_PLAN_RESULTS = 8;

    private final VBox rows = new VBox(8);
    private final Label emptyLabel = styledLabel("Noch keine Szenen.", STYLE_TEXT_SECONDARY, "session-planner-empty");
    private final Label noSelectionLabel = styledLabel(
            "Wähle eine Szene für den Inspector.", STYLE_TEXT_SECONDARY, "session-planner-empty");
    private final Button addSceneButton = compactButton("Szene hinzufügen", STYLE_ACCENT);
    private final Map<Long, SceneCard> sceneCards = new LinkedHashMap<>();
    private final Map<Integer, RestSeparator> restSeparators = new LinkedHashMap<>();

    private long openSceneToken;
    private long currentSessionId;
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
    private AttachPlanHandler attachPlanHandler = (sceneToken, planId) -> { };
    private LongConsumer detachPlanHandler = ignored -> { };

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

    public void onAttachPlan(AttachPlanHandler handler) {
        attachPlanHandler = handler == null ? (sceneToken, planId) -> { } : handler;
    }

    public void onDetachPlan(LongConsumer handler) {
        detachPlanHandler = handler == null ? ignored -> { } : handler;
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

        if (projection.sessionId() != currentSessionId) {
            currentSessionId = projection.sessionId();
            sceneCards.clear();
            restSeparators.clear();
            openSceneToken = 0L;
            openCard = null;
        }

        Set<Long> presentTokens = new HashSet<>();
        for (var scene : scenes) {
            presentTokens.add(scene.sceneToken());
        }
        if (openSceneToken != 0L && !presentTokens.contains(openSceneToken)) {
            openSceneToken = 0L;
            openCard = null;
        }
        if (openSceneToken == 0L) {
            scenes.stream().filter(SessionPlannerViewModel.TimelineProjection.SceneModel::selected)
                    .findFirst().ifPresent(scene -> openSceneToken = scene.sceneToken());
        }

        List<Node> desired = new ArrayList<>();
        if (scenes.isEmpty()) {
            desired.add(emptyLabel);
        } else {
            for (int index = 0; index < scenes.size(); index++) {
                var scene = scenes.get(index);
                SceneCard card = sceneCards.computeIfAbsent(scene.sceneToken(), SceneCard::new);
                card.update(scene, index + 1, scene.sceneToken() == openSceneToken, disabled,
                        projection.availablePlans());
                if (scene.sceneToken() == openSceneToken) {
                    openCard = card;
                }
                desired.add(card);
                if (index < restGaps.size()) {
                    var gap = restGaps.get(index);
                    RestSeparator separator = restSeparators.computeIfAbsent(gap.gapIndex(), ignored -> new RestSeparator());
                    separator.update(gap, disabled);
                    desired.add(separator);
                }
            }
            if (openSceneToken == 0L) {
                desired.add(noSelectionLabel);
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
        private final Label encounterStatus = styledLabel("", "session-planner-gap-active");
        private final VBox rosterRows = new VBox(3);
        private final VBox encounterSummary = new VBox(4);

        private final TextField titleField = new TextField();
        private final LocationComboBox locationBox = new LocationComboBox();
        private final TextArea notesField = new TextArea();
        private final Label allocationLabel = styledLabel("", STYLE_TEXT_SECONDARY);
        private final Button decreaseAllocation = compactButton("-10%", STYLE_FLAT);
        private final Button increaseAllocation = compactButton("+10%", STYLE_FLAT);
        private final Button moveUp = compactButton("Hoch", STYLE_FLAT);
        private final Button moveDown = compactButton("Runter", STYLE_FLAT);
        private final VBox manualLootRows = new VBox(5);
        private final VBox generatedRewardRows = new VBox(7);
        private final Button addLoot = compactButton("Beutenotiz", STYLE_ACCENT);
        private final TextField planSearch = new TextField();
        private final VBox planResults = new VBox(5);
        private final Button detachPlan = compactButton("Encounter lösen", STYLE_FLAT);
        private final VBox editor = new VBox(6);

        private SessionPlannerViewModel.TimelineProjection.SceneModel model;
        private String loadedTitle = "";
        private String loadedNotes = "";
        private long loadedLocationId;
        private List<SessionPlannerViewModel.TimelineProjection.AvailablePlanModel> availablePlans = List.of();

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
            removeButton.setOnAction(event -> removeSceneHandler.accept(sceneToken));

            encounterSummary.getChildren().setAll(
                    encounterName, encounterDetail, encounterBudget, encounterComparison, encounterBase,
                    encounterStatus, rosterRows);
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
            planSearch.setPromptText("Encounter suchen");
            planSearch.getStyleClass().add(STYLE_COMPACT);
            planSearch.textProperty().addListener((ignored, before, after) -> {
                if (editor.isVisible()) {
                    renderPlanResults();
                }
            });
            detachPlan.setOnAction(event -> detachPlanHandler.accept(sceneToken));

            editor.getChildren().setAll(
                    encounterSummary,
                    new VBox(5,
                            styledLabel("Encounter verknüpfen", "session-planner-gap-title"),
                            actionRow(planSearch, detachPlan), planResults),
                    titleField,
                    actionRow(locationBox, save),
                    notesField,
                    actionRow(allocationLabel, decreaseAllocation, increaseAllocation),
                    actionRow(moveUp, moveDown),
                    new VBox(6,
                            new HBox(8, styledLabel("Manuelle Notizen", "session-planner-gap-title"), addLoot),
                            manualLootRows),
                    new VBox(6,
                            styledLabel("Generierte Belohnungen", "session-planner-gap-title"),
                            generatedRewardRows));
            editor.setVisible(false);
            editor.setManaged(false);

            getChildren().setAll(header, editor);
        }

        private void update(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                int position,
                boolean expanded,
                boolean disabled,
                List<SessionPlannerViewModel.TimelineProjection.AvailablePlanModel> availablePlans
        ) {
            this.model = scene;
            this.availablePlans = availablePlans == null ? List.of() : List.copyOf(availablePlans);
            headerTitle.setText("Szene " + position + ": " + scene.displayTitle());
            headerBudget.setText(scene.budgetPercentageText());
            headerBar.setProgress(clampFraction(scene.budgetFraction()));
            headerLocation.setText(scene.locationLabel());
            removeButton.setDisable(disabled);

            boolean linked = scene.linkedEncounterPlan();
            if (linked) {
                encounterName.setText(scene.linkedEncounterName().isBlank()
                        ? "Encounter-Referenz #" + scene.linkedEncounterPlanId()
                        : scene.linkedEncounterName());
                encounterDetail.setText(scene.linkedEncounterCreatureCount() + " Kreaturen" + generatedSuffix(scene));
                encounterBudget.setText(scene.budgetPercentageText() + " Budget · Ziel " + scene.targetXpText() + " XP");
                encounterComparison.setText(scene.comparisonText() + " · " + scene.linkedEncounterDifficultyLabel());
                encounterBase.setText("Base " + scene.linkedEncounterTotalBaseXp() + " XP · Multiplikator x"
                        + String.format(Locale.US, "%.2f", scene.linkedEncounterXpMultiplier()));
                encounterStatus.setText(scene.linkedEncounterStatus());
            } else {
                encounterName.setText("Keine Begegnung verknüpft.");
                encounterDetail.setText("");
                encounterBudget.setText("");
                encounterComparison.setText("");
                encounterBase.setText("");
                encounterStatus.setText("");
            }
            show(encounterDetail, linked);
            show(encounterBudget, linked);
            show(encounterComparison, linked);
            show(encounterBase, linked);
            show(encounterStatus, linked && !scene.linkedEncounterStatus().isBlank());
            renderRoster(scene);

            allocationLabel.setText("Budget " + scene.budgetPercentageText());
            decreaseAllocation.setDisable(disabled || !linked);
            increaseAllocation.setDisable(disabled || !linked);
            moveUp.setDisable(disabled || !scene.canMoveUp());
            moveDown.setDisable(disabled || !scene.canMoveDown());
            addLoot.setDisable(disabled);
            planSearch.setDisable(disabled);
            detachPlan.setDisable(disabled || !linked);
            renderManualLoot(scene, disabled);
            renderGeneratedRewards(scene);
            setExpanded(expanded);
        }

        private void setExpanded(boolean expanded) {
            boolean wasExpanded = editor.isVisible();
            toggleButton.setText(expanded ? "▼" : "▶");
            editor.setVisible(expanded);
            editor.setManaged(expanded);
            if (expanded && !wasExpanded) {
                loadEditorFromModel();
            }
            if (expanded) {
                renderPlanResults();
            } else {
                planResults.getChildren().clear();
            }
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

        private void renderRoster(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
            List<Node> rows = new ArrayList<>();
            for (var line : scene.linkedEncounterRoster()) {
                rows.add(styledLabel(line.quantity() + " × " + line.displayName(),
                        "session-planner-roster-line"));
            }
            if (scene.linkedEncounterPlan() && rows.isEmpty()) {
                rows.add(styledLabel(scene.linkedEncounterStatus().isBlank()
                        ? "Roster nicht verfügbar." : scene.linkedEncounterStatus(), STYLE_TEXT_SECONDARY));
            }
            rosterRows.getChildren().setAll(rows);
            show(rosterRows, scene.linkedEncounterPlan());
        }

        private void renderPlanResults() {
            if (model == null) {
                return;
            }
            String query = planSearch.getText() == null ? "" : planSearch.getText().trim();
            List<Node> rows = new ArrayList<>();
            if (query.length() < MIN_PLAN_QUERY_LENGTH) {
                planResults.getChildren().setAll(styledLabel(
                        "Ab 2 Zeichen nach Name, Schwierigkeit oder Zusammenfassung suchen.",
                        STYLE_TEXT_SECONDARY));
                return;
            }
            List<SessionPlannerViewModel.TimelineProjection.AvailablePlanModel> matches = availablePlans.stream()
                    .filter(plan -> plan.matches(query))
                    .limit(MAX_PLAN_RESULTS + 1L)
                    .toList();
            if (availablePlans.isEmpty()) {
                rows.add(styledLabel("Keine gespeicherten Encounter-Pläne.", STYLE_TEXT_SECONDARY));
            } else if (matches.isEmpty()) {
                rows.add(styledLabel("Kein Treffer. Suche nach Name, Schwierigkeit oder Zusammenfassung.",
                        STYLE_TEXT_SECONDARY));
            } else {
                boolean moreResults = matches.size() > MAX_PLAN_RESULTS;
                for (var plan : matches.stream().limit(MAX_PLAN_RESULTS).toList()) {
                    boolean alreadyLinked = model.linkedEncounterPlanId() == plan.planId();
                    String actionText = alreadyLinked
                            ? "Verknüpft" : model.linkedEncounterPlan() ? "Ersetzen" : "Verknüpfen";
                    Button action = compactButton(actionText, STYLE_ACCENT);
                    action.setDisable(alreadyLinked || !plan.enabled());
                    action.setOnAction(event -> attachPlanHandler.handle(sceneToken, plan.planId()));
                    Label status = styledLabel(plan.status(), STYLE_TEXT_SECONDARY);
                    show(status, !plan.status().isBlank());
                    VBox text = new VBox(2,
                            styledLabel(plan.name(), "session-planner-plan-name"),
                            styledLabel(plan.difficulty() + (plan.summary().isBlank() ? "" : " · " + plan.summary()),
                                    STYLE_TEXT_SECONDARY), status);
                    HBox row = new HBox(8, text, spacer(), action);
                    row.setAlignment(Pos.CENTER_LEFT);
                    row.getStyleClass().add("session-planner-encounter-search-result");
                    rows.add(row);
                }
                if (moreResults) {
                    rows.add(styledLabel(
                            "Weitere Treffer vorhanden. Suche genauer, um sie einzugrenzen.",
                            STYLE_TEXT_SECONDARY));
                }
            }
            planResults.getChildren().setAll(rows);
        }

        private void renderManualLoot(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                boolean disabled
        ) {
            List<Node> cards = new ArrayList<>();
            if (scene.manualLootNotes().isEmpty()) {
                cards.add(styledLabel("Keine manuellen Notizen.", STYLE_TEXT_SECONDARY, "session-planner-empty"));
            } else {
                for (var note : scene.manualLootNotes()) {
                    Button remove = compactButton("Entfernen", STYLE_FLAT);
                    remove.setDisable(disabled);
                    remove.setOnAction(event -> removeLootHandler.accept(note.noteId()));
                    HBox row = new HBox(8, styledLabel(note.authoredText()), spacer(), remove);
                    row.setAlignment(Pos.CENTER_LEFT);
                    row.getStyleClass().add("session-planner-manual-note");
                    cards.add(row);
                }
            }
            manualLootRows.getChildren().setAll(cards);
        }

        private void renderGeneratedRewards(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
            List<Node> cards = new ArrayList<>();
            if (scene.generatedRewards().isEmpty()) {
                cards.add(styledLabel("Keine generierten Belohnungen.", STYLE_TEXT_SECONDARY));
            } else {
                for (var reward : scene.generatedRewards()) {
                    cards.add(generatedRewardCard(reward));
                }
            }
            generatedRewardRows.getChildren().setAll(cards);
        }

        private Node generatedRewardCard(
                features.sessionplanner.api.SessionPlannerSceneTimelineProjection.GeneratedReward reward
        ) {
            VBox card = new VBox(4);
            card.getStyleClass().add("session-planner-generated-reward");
            if (reward.availability()
                    == features.sessionplanner.api.SessionPlannerSceneTimelineProjection.Availability.UNAVAILABLE) {
                card.getChildren().setAll(
                        styledLabel("Nicht verfügbar", "session-planner-gap-active"),
                        styledLabel(reward.statusText().isBlank() ? reward.fallbackLabel() : reward.statusText(),
                                STYLE_TEXT_SECONDARY));
                return card;
            }
            card.getChildren().addAll(
                    styledLabel("Verfügbar · " + reward.channel() + " · " + reward.stockClass(),
                            "session-planner-plan-name"),
                    styledLabel("Thema " + value(reward.theme()) + " · Magie " + value(reward.magicType())
                            + " · Ziel " + reward.targetCp() + " cp", STYLE_TEXT_SECONDARY),
                    styledLabel("Slots " + reward.nonMagicSlots() + " nichtmagisch / "
                            + reward.magicSlots() + " magisch", STYLE_TEXT_SECONDARY));
            VBox items = new VBox(3);
            for (var item : reward.itemLines()) {
                String magic = item.magicRarity().isBlank() ? "" : " · " + item.magicRarity();
                String curse = item.cursed() ? " · verflucht" : "";
                items.getChildren().add(styledLabel(
                        item.quantity() + " × " + item.text() + " · " + item.actualCp() + " cp"
                                + " · " + value(item.role()) + " / " + value(item.itemId()) + magic + curse
                                + " · Kapazität " + item.totalCapacity() + " · Behälter "
                                + value(item.allowedContainers()), STYLE_TEXT_SECONDARY));
            }
            VBox packing = new VBox(3);
            for (var row : reward.packing()) {
                packing.getChildren().add(styledLabel(
                        row.containerCount() + " × " + value(row.containerType()) + " · "
                                + value(row.containerId()) + " · " + (row.valid() ? "gültig" : "ungültig"),
                        STYLE_TEXT_SECONDARY));
            }
            card.getChildren().addAll(items, packing);
            return card;
        }

        private String value(String text) {
            return text == null || text.isBlank() ? "–" : text;
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

    @FunctionalInterface
    public interface AttachPlanHandler {
        void handle(long sceneToken, long planId);
    }
}
