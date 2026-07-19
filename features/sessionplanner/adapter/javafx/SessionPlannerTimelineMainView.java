package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
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

/** Header-only scene master with one reusable selected-scene inspector. */
public final class SessionPlannerTimelineMainView extends ScrollPane {

    private static final String SECONDARY = "text-secondary";
    private static final String COMPACT = "compact";
    private static final String ACCENT = "accent";
    private static final String FLAT = "flat";
    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;

    private final VBox rows = new VBox(8);
    private final Label emptyLabel = label("Noch keine Szenen.", SECONDARY, "session-planner-empty");
    private final Button addSceneButton = button("Szene hinzufügen", ACCENT);
    private final Map<Long, SceneCard> sceneCards = new LinkedHashMap<>();
    private final Map<Integer, RestSeparator> restSeparators = new LinkedHashMap<>();
    private final SelectedSceneInspector selectedInspector = new SelectedSceneInspector();
    private long currentSessionId;
    private int materializedUnitCount = 1;

    private Runnable addSceneHandler = () -> { };
    private LongConsumer selectSceneHandler = ignored -> { };
    private AllocationHandler allocationHandler = (token, percentage) -> { };
    private MoveHandler moveHandler = (token, up) -> { };
    private LongConsumer removeSceneHandler = ignored -> { };
    private SceneEditHandler saveSceneHandler = draft -> { };
    private RestHandler shortRestHandler = (left, right) -> { };
    private RestHandler longRestHandler = (left, right) -> { };
    private RestHandler clearRestHandler = (left, right) -> { };
    private ManualNoteAddHandler addLootHandler = draft -> { };
    private ManualNoteEditHandler updateLootHandler = draft -> { };
    private ManualNoteRemoveHandler removeLootHandler = draft -> { };
    private AttachPlanHandler attachPlanHandler = (sceneToken, planId) -> { };
    private LongConsumer detachPlanHandler = ignored -> { };
    private PlanSearchHandler planSearchHandler = (sceneToken, query) -> { };

    public SessionPlannerTimelineMainView() {
        VBox content = new VBox(12, rows);
        content.getStyleClass().add("session-planner-main");
        addSceneButton.setAccessibleText("Neue Session-Szene hinzufügen");
        addSceneButton.setOnAction(event -> addSceneHandler.run());
        setContent(content);
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollBarPolicy.NEVER);
    }

    public void onAddScene(Runnable handler) { addSceneHandler = handler == null ? () -> { } : handler; }
    public void onSelectScene(LongConsumer handler) { selectSceneHandler = handler == null ? ignored -> { } : handler; }
    public void onSetAllocation(AllocationHandler handler) { allocationHandler = handler == null ? (t, p) -> { } : handler; }
    public void onMoveScene(MoveHandler handler) { moveHandler = handler == null ? (t, u) -> { } : handler; }
    public void onRemoveScene(LongConsumer handler) { removeSceneHandler = handler == null ? ignored -> { } : handler; }
    public void onSaveScene(SceneEditHandler handler) { saveSceneHandler = handler == null ? draft -> { } : handler; }
    public void onShortRest(RestHandler handler) { shortRestHandler = handler == null ? (l, r) -> { } : handler; }
    public void onLongRest(RestHandler handler) { longRestHandler = handler == null ? (l, r) -> { } : handler; }
    public void onClearRest(RestHandler handler) { clearRestHandler = handler == null ? (l, r) -> { } : handler; }
    public void onAddLoot(ManualNoteAddHandler handler) { addLootHandler = handler == null ? draft -> { } : handler; }
    public void onUpdateLoot(ManualNoteEditHandler handler) { updateLootHandler = handler == null ? draft -> { } : handler; }
    public void onRemoveLoot(ManualNoteRemoveHandler handler) { removeLootHandler = handler == null ? draft -> { } : handler; }
    public void onAttachPlan(AttachPlanHandler handler) { attachPlanHandler = handler == null ? (s, p) -> { } : handler; }
    public void onDetachPlan(LongConsumer handler) { detachPlanHandler = handler == null ? ignored -> { } : handler; }
    public void onSearchPlans(PlanSearchHandler handler) { planSearchHandler = handler == null ? (s, q) -> { } : handler; }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.timelineProjectionProperty().addListener((ignored, before, after) -> render(after));
        render(viewModel.timelineProjectionProperty().get());
    }

    int materializedUnitCount() {
        return materializedUnitCount;
    }

    Optional<SceneEditDraft> pendingSceneEdit() {
        return selectedInspector.pendingSceneEdit();
    }

    private void render(SessionPlannerViewModel.TimelineProjection projection) {
        if (projection == null) {
            return;
        }
        boolean sessionChanged = projection.sessionId() != currentSessionId;
        selectedInspector.captureFocus();
        if (sessionChanged) {
            currentSessionId = projection.sessionId();
            sceneCards.clear();
            restSeparators.clear();
            selectedInspector.resetForSession();
        }
        Set<Long> present = new HashSet<>();
        List<Node> desired = new ArrayList<>();
        if (projection.scenes().isEmpty()) {
            desired.add(emptyLabel);
        } else {
            for (int index = 0; index < projection.scenes().size(); index++) {
                var scene = projection.scenes().get(index);
                present.add(scene.sceneToken());
                SceneCard card = sceneCards.computeIfAbsent(scene.sceneToken(), SceneCard::new);
                card.update(scene, index + 1, projection.sessionActionsDisabled());
                desired.add(card);
                if (scene.selected() && projection.selectedScene().available()
                        && projection.selectedScene().sceneToken() == scene.sceneToken()) {
                    selectedInspector.update(projection.sessionId(), projection.sourceSessionRevision(), projection.selectedScene(),
                            projection.sessionActionsDisabled());
                    desired.add(selectedInspector);
                }
                if (index < projection.restGaps().size()) {
                    var gap = projection.restGaps().get(index);
                    RestSeparator separator = restSeparators.computeIfAbsent(
                            gap.gapIndex(), ignored -> new RestSeparator());
                    separator.update(gap, projection.sessionActionsDisabled());
                    desired.add(separator);
                }
            }
        }
        addSceneButton.setDisable(projection.sessionActionsDisabled());
        desired.add(addSceneButton);
        sceneCards.keySet().removeIf(token -> !present.contains(token));
        restSeparators.keySet().removeIf(index -> index >= projection.restGaps().size());
        if (!rows.getChildren().equals(desired)) {
            rows.getChildren().setAll(desired);
        }
        selectedInspector.restoreFocus();
        materializedUnitCount = (int) rows.getChildren().stream().filter(SceneCard.class::isInstance).count()
                + (int) rows.getChildren().stream().filter(RestSeparator.class::isInstance).count()
                + (rows.getChildren().contains(addSceneButton) ? 1 : 0);
        if (rows.getChildren().contains(selectedInspector)) {
            materializedUnitCount += 1
                    + countStyle(selectedInspector, "session-planner-roster-line")
                    + countStyle(selectedInspector, "session-planner-manual-note")
                    + countStyle(selectedInspector, "session-planner-generated-reward")
                    + countStyle(selectedInspector, "session-planner-reward-item-row")
                    + countStyle(selectedInspector, "session-planner-reward-packing-row")
                    + countStyle(selectedInspector, "session-planner-encounter-search-result");
        }
    }

    private final class SceneCard extends VBox {
        private final long sceneToken;
        private final Button select = button("", FLAT);
        private final Label budget = label("", SECONDARY);
        private final ProgressBar budgetBar = new ProgressBar(0);
        private final Label encounter = label("", SECONDARY);
        private final Label location = label("", SECONDARY);
        private final Button remove = button("X", FLAT);
        private SessionPlannerViewModel.TimelineProjection.SceneModel model;

        private SceneCard(long sceneToken) {
            this.sceneToken = sceneToken;
            getStyleClass().addAll("session-planner-encounter-card", "session-planner-scene-header");
            budgetBar.getStyleClass().addAll("session-planner-budget-bar", "session-planner-budget-ok");
            budgetBar.setPrefWidth(80);
            budgetBar.setMaxWidth(80);
            select.getStyleClass().add("session-planner-scene-toggle");
            select.setOnAction(event -> {
                selectedInspector.commitIfDirty();
                selectSceneHandler.accept(sceneToken);
            });
            remove.setOnAction(event -> removeSceneHandler.accept(sceneToken));
            HBox header = new HBox(8, select, budgetBar, budget, encounter, spacer(), location, remove);
            header.setAlignment(Pos.CENTER_LEFT);
            header.getStyleClass().add("session-planner-encounter-header");
            getChildren().setAll(header);
        }

        private void update(
                SessionPlannerViewModel.TimelineProjection.SceneModel scene,
                int position,
                boolean disabled
        ) {
            model = scene;
            select.setText((scene.selected() ? "▼ " : "▶ ") + "Szene " + position + ": " + scene.displayTitle());
            select.setAccessibleText((scene.selected() ? "Ausgewählte " : "") + "Szene " + position
                    + " öffnen: " + scene.displayTitle());
            select.setDisable(disabled || scene.selected());
            budget.setText(scene.budgetPercentageText());
            budgetBar.setProgress(clamp(scene.budgetFraction()));
            encounter.setText(scene.linkedEncounterPlan()
                    ? scene.linkedEncounterCreatureCount() + " Kreaturen · "
                            + scene.linkedEncounterAdjustedXp() + " XP · " + scene.linkedEncounterDifficultyLabel()
                    : "Keine Begegnung");
            location.setText(scene.locationLabel());
            remove.setDisable(disabled);
            remove.setAccessibleText("Szene " + position + " entfernen");
        }
    }

    private final class SelectedSceneInspector extends VBox {
        private final Label encounterName = label("", "session-planner-plan-name");
        private final Label encounterDetail = label("", SECONDARY);
        private final Label encounterBudget = label("", "session-planner-encounter-budget");
        private final Label encounterComparison = label("", SECONDARY);
        private final Label encounterBase = label("", SECONDARY);
        private final Label encounterStatus = label("", "session-planner-gap-active");
        private final VBox rosterRows = new VBox(3);
        private final TextField planSearch = new TextField();
        private final VBox planResults = new VBox(5);
        private final Button detachPlan = button("Encounter lösen", FLAT);
        private final TextField titleField = new TextField();
        private final LocationComboBox locationBox = new LocationComboBox();
        private final TextArea notesField = new TextArea();
        private final Label allocationLabel = label("", SECONDARY);
        private final Button decreaseAllocation = button("-10%", FLAT);
        private final Button increaseAllocation = button("+10%", FLAT);
        private final Button moveUp = button("Hoch", FLAT);
        private final Button moveDown = button("Runter", FLAT);
        private final VBox manualLootRows = new VBox(5);
        private final VBox generatedRewardRows = new VBox(7);
        private final TextField newLootDraft = new TextField();
        private final Button addLoot = button("Hinzufügen", ACCENT);
        private final Map<Long, ManualNoteEditor> manualNoteEditors = new LinkedHashMap<>();
        private String pendingNewNoteText = "";
        private Set<Long> noteIdsBeforeAdd = Set.of();
        private long sessionId;
        private long sourceRevision;
        private long authoritativeRevision;
        private long sceneToken;
        private String loadedTitle = "";
        private String loadedNotes = "";
        private long loadedLocationId;
        private SessionPlannerViewModel.TimelineProjection.SelectedSceneModel model =
                SessionPlannerViewModel.TimelineProjection.SelectedSceneModel.empty();
        private boolean loadingSearch;
        private Node focusedNode;
        private int anchor;
        private int caret;

        private SelectedSceneInspector() {
            setSpacing(6);
            getStyleClass().addAll("session-planner-selected-scene-inspector", "session-planner-encounter-card");
            setAccessibleText("Inspector der ausgewählten Session-Szene");
            titleField.setPromptText("Szenentitel");
            titleField.setAccessibleText("Titel der ausgewählten Szene");
            notesField.setPromptText("Szenennotizen");
            notesField.setAccessibleText("Notizen der ausgewählten Szene");
            notesField.setPrefRowCount(2);
            planSearch.setPromptText("Encounter suchen");
            planSearch.setAccessibleText("Gespeicherten Encounter für ausgewählte Szene suchen");
            titleField.getStyleClass().add(COMPACT);
            notesField.getStyleClass().add(COMPACT);
            planSearch.getStyleClass().add(COMPACT);
            newLootDraft.setPromptText("Neue Beutenotiz");
            newLootDraft.setAccessibleText("Text einer neuen manuellen Beutenotiz");
            newLootDraft.getStyleClass().add(COMPACT);
            Button save = button("Szene speichern", ACCENT);
            save.setAccessibleText("Änderungen der ausgewählten Szene speichern");
            save.setOnAction(event -> saveNow());
            decreaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP.negate()));
            increaseAllocation.setOnAction(event -> adjustAllocation(ALLOCATION_STEP));
            moveUp.setOnAction(event -> moveHandler.handle(sceneToken, true));
            moveDown.setOnAction(event -> moveHandler.handle(sceneToken, false));
            addLoot.setAccessibleText("Manuelle Beutenotiz hinzufügen");
            addLoot.setOnAction(event -> addManualNote());
            detachPlan.setOnAction(event -> detachPlanHandler.accept(sceneToken));
            planSearch.textProperty().addListener((ignored, before, after) -> {
                if (!loadingSearch && sceneToken > 0L) {
                    planSearchHandler.handle(sceneToken, after == null ? "" : after);
                }
            });
            getChildren().setAll(
                    new VBox(4, encounterName, encounterDetail, encounterBudget, encounterComparison,
                            encounterBase, encounterStatus, rosterRows),
                    new VBox(5, label("Encounter verknüpfen", "session-planner-gap-title"),
                            actionRow(planSearch, detachPlan), planResults),
                    titleField, actionRow(locationBox, save), notesField,
                    actionRow(allocationLabel, decreaseAllocation, increaseAllocation),
                    actionRow(moveUp, moveDown),
                    new VBox(6, label("Manuelle Notizen", "session-planner-gap-title"),
                            actionRow(newLootDraft, addLoot),
                            manualLootRows),
                    new VBox(6, label("Generierte Belohnungen", "session-planner-gap-title"),
                            generatedRewardRows));
        }

        private void resetForSession() {
            sessionId = 0L;
            sourceRevision = 0L;
            authoritativeRevision = 0L;
            sceneToken = 0L;
            loadedTitle = "";
            loadedNotes = "";
            loadedLocationId = 0L;
            titleField.clear();
            notesField.clear();
            locationBox.getItems().clear();
            newLootDraft.clear();
            pendingNewNoteText = "";
            noteIdsBeforeAdd = Set.of();
            manualNoteEditors.clear();
            manualLootRows.getChildren().clear();
            loadingSearch = true;
            planSearch.clear();
            loadingSearch = false;
        }

        private void update(
                long nextSessionId,
                long nextSourceRevision,
                SessionPlannerViewModel.TimelineProjection.SelectedSceneModel next,
                boolean disabled
        ) {
            boolean identityChanged = nextSessionId != sessionId || next.sceneToken() != sceneToken;
            long previousRevision = sourceRevision;
            authoritativeRevision = nextSourceRevision;
            sessionId = nextSessionId;
            sceneToken = next.sceneToken();
            model = next;
            if (identityChanged) {
                resetSceneScopedNotes();
                titleField.setText(next.sceneTitle());
                notesField.setText(next.sceneNotes());
                locationBox.setChoices(next.locationChoices(), next.locationId());
                loadedTitle = next.sceneTitle();
                loadedNotes = next.sceneNotes();
                loadedLocationId = next.locationId();
                sourceRevision = nextSourceRevision;
                loadingSearch = true;
                planSearch.setText(next.planSearch().query());
                loadingSearch = false;
            } else {
                rebaseSceneEditor(nextSourceRevision, previousRevision, next);
            }
            boolean linked = next.linkedEncounterPlan();
            encounterName.setText(linked ? value(next.linkedEncounterName()) : "Keine Begegnung verknüpft.");
            encounterDetail.setText(linked ? next.linkedEncounterCreatureCount() + " Kreaturen"
                    + (next.linkedEncounterGeneratedLabel().isBlank() ? ""
                    : " · " + next.linkedEncounterGeneratedLabel()) : "");
            encounterBudget.setText(linked ? next.budgetPercentageText() + " Budget · Ziel "
                    + next.targetXpText() + " XP" : "");
            encounterComparison.setText(linked ? "Ist " + next.linkedEncounterAdjustedXp() + " XP · "
                    + next.linkedEncounterDifficultyLabel() : "");
            encounterBase.setText(linked ? "Base " + next.linkedEncounterTotalBaseXp()
                    + " XP · Multiplikator x" + String.format(Locale.US, "%.2f", next.linkedEncounterXpMultiplier()) : "");
            encounterStatus.setText(next.linkedEncounterStatus());
            show(encounterDetail, linked);
            show(encounterBudget, linked);
            show(encounterComparison, linked);
            show(encounterBase, linked);
            show(encounterStatus, linked && !next.linkedEncounterStatus().isBlank());
            renderRoster(next);
            renderSearch(next.planSearch());
            renderManualNotes(next, disabled);
            renderRewards(next);
            allocationLabel.setText("Budget " + next.budgetPercentageText());
            decreaseAllocation.setDisable(disabled || !linked);
            increaseAllocation.setDisable(disabled || !linked);
            moveUp.setDisable(disabled || !header(sceneToken).canMoveUp());
            moveDown.setDisable(disabled || !header(sceneToken).canMoveDown());
            addLoot.setDisable(disabled);
            detachPlan.setDisable(disabled || !linked);
            planSearch.setDisable(disabled);
        }

        private void resetSceneScopedNotes() {
            newLootDraft.clear();
            pendingNewNoteText = "";
            noteIdsBeforeAdd = Set.of();
            manualNoteEditors.clear();
            manualLootRows.getChildren().clear();
        }

        private SessionPlannerViewModel.TimelineProjection.SceneModel header(long token) {
            SceneCard card = sceneCards.get(token);
            if (card == null || card.model == null) {
                throw new IllegalStateException("selected header not materialized");
            }
            return card.model;
        }

        private void saveNow() {
            pendingSceneEdit().ifPresent(saveSceneHandler::handle);
        }

        private void commitIfDirty() {
            if (sceneToken <= 0L || getParent() == null) {
                return;
            }
            String title = titleField.getText().trim();
            String notes = notesField.getText().trim();
            long locationId = locationBox.selectedLocationId();
            if (!title.equals(loadedTitle) || !notes.equals(loadedNotes) || locationId != loadedLocationId) {
                saveSceneHandler.handle(new SceneEditDraft(
                        sessionId, sourceRevision, sceneToken, title, notes, locationId));
            }
        }

        private Optional<SceneEditDraft> pendingSceneEdit() {
            if (sessionId <= 0L || sourceRevision <= 0L || sceneToken <= 0L) {
                return Optional.empty();
            }
            String title = titleField.getText().trim();
            String notes = notesField.getText().trim();
            long locationId = locationBox.selectedLocationId();
            if (title.equals(loadedTitle) && notes.equals(loadedNotes) && locationId == loadedLocationId) {
                return Optional.empty();
            }
            return Optional.of(new SceneEditDraft(
                    sessionId, sourceRevision, sceneToken, title, notes, locationId));
        }

        private void rebaseSceneEditor(
                long nextRevision,
                long previousRevision,
                SessionPlannerViewModel.TimelineProjection.SelectedSceneModel authoritative
        ) {
            String currentTitle = titleField.getText().trim();
            String currentNotes = notesField.getText().trim();
            long currentLocation = locationBox.selectedLocationId();
            boolean dirty = !currentTitle.equals(loadedTitle) || !currentNotes.equals(loadedNotes)
                    || currentLocation != loadedLocationId;
            boolean authoritativeUnchanged = authoritative.sceneTitle().equals(loadedTitle)
                    && authoritative.sceneNotes().equals(loadedNotes)
                    && authoritative.locationId() == loadedLocationId;
            boolean matchingSuccess = authoritative.sceneTitle().equals(currentTitle)
                    && authoritative.sceneNotes().equals(currentNotes)
                    && authoritative.locationId() == currentLocation;
            if (!dirty || matchingSuccess) {
                titleField.setText(authoritative.sceneTitle());
                notesField.setText(authoritative.sceneNotes());
                locationBox.setChoices(authoritative.locationChoices(), authoritative.locationId());
                loadedTitle = authoritative.sceneTitle();
                loadedNotes = authoritative.sceneNotes();
                loadedLocationId = authoritative.locationId();
                sourceRevision = nextRevision;
            } else if (authoritativeUnchanged && nextRevision >= previousRevision) {
                locationBox.setChoices(authoritative.locationChoices(), currentLocation);
                sourceRevision = nextRevision;
            }
        }

        private void adjustAllocation(BigDecimal delta) {
            allocationHandler.handle(sceneToken, model.budgetPercentage().add(delta));
        }

        private void renderRoster(SessionPlannerViewModel.TimelineProjection.SelectedSceneModel selected) {
            List<Node> materialized = selected.linkedEncounterRoster().stream()
                    .map(line -> (Node) label(line.quantity() + " × " + line.displayName(),
                            "session-planner-roster-line")).toList();
            rosterRows.getChildren().setAll(materialized);
            show(rosterRows, selected.linkedEncounterPlan());
        }

        private void renderSearch(SessionPlannerViewModel.TimelineProjection.PlanSearchModel search) {
            List<Node> materialized = new ArrayList<>();
            switch (search.status()) {
                case IDLE -> materialized.add(label("Ab 2 Zeichen nach Name oder generiertem Label suchen.", SECONDARY));
                case TOO_SHORT, SEARCHING -> materialized.add(label(search.message(), SECONDARY));
                case FAILED -> materialized.add(label(search.message(), "session-planner-gap-active"));
                case READY -> {
                    if (search.results().isEmpty()) {
                        materialized.add(label(search.message().isBlank()
                                ? "Keine gespeicherten Encounter gefunden." : search.message(), SECONDARY));
                    }
                    for (var plan : search.results()) {
                        boolean alreadyLinked = model.linkedEncounterPlanId() == plan.planId();
                        Button action = button(alreadyLinked ? "Verknüpft"
                                : model.linkedEncounterPlan() ? "Ersetzen" : "Verknüpfen", ACCENT);
                        action.setDisable(alreadyLinked || !plan.enabled());
                        action.setAccessibleText("Encounter " + plan.name() + " mit ausgewählter Szene verknüpfen");
                        action.setOnAction(event -> attachPlanHandler.handle(sceneToken, plan.planId()));
                        VBox text = new VBox(2, label(plan.name(), "session-planner-plan-name"),
                                label(plan.difficulty() + (plan.summary().isBlank() ? "" : " · " + plan.summary()),
                                        SECONDARY));
                        HBox row = new HBox(8, text, spacer(), action);
                        row.setAlignment(Pos.CENTER_LEFT);
                        row.getStyleClass().add("session-planner-encounter-search-result");
                        materialized.add(row);
                    }
                    if (search.hasMore()) {
                        materialized.add(label("Weitere Treffer vorhanden. Suche genauer, um sie einzugrenzen.", SECONDARY));
                    }
                }
            }
            planResults.getChildren().setAll(materialized);
        }

        private void renderManualNotes(
                SessionPlannerViewModel.TimelineProjection.SelectedSceneModel selected,
                boolean disabled
        ) {
            Set<Long> authoritativeIds = selected.manualLootNotes().stream()
                    .map(SessionPlannerSelectedSceneSnapshot.ManualLootNote::noteId)
                    .collect(java.util.stream.Collectors.toSet());
            if (!pendingNewNoteText.isBlank()) {
                boolean added = selected.manualLootNotes().stream().anyMatch(note ->
                        !noteIdsBeforeAdd.contains(note.noteId())
                                && note.authoredText().equals(pendingNewNoteText));
                if (added) {
                    newLootDraft.clear();
                    pendingNewNoteText = "";
                    noteIdsBeforeAdd = Set.of();
                }
            }
            selected.manualLootNotes().forEach(note -> manualNoteEditors
                    .computeIfAbsent(note.noteId(), ManualNoteEditor::new)
                    .update(note.authoredText(), authoritativeRevision, disabled));
            manualNoteEditors.entrySet().removeIf(entry -> !authoritativeIds.contains(entry.getKey())
                    && (entry.getValue().pendingRemoval || !entry.getValue().isDirty()));
            List<Node> materialized = new ArrayList<>(manualNoteEditors.values());
            if (materialized.isEmpty()) {
                materialized.add(label("Keine manuellen Notizen.", SECONDARY, "session-planner-empty"));
            }
            manualLootRows.getChildren().setAll(materialized);
        }

        private void addManualNote() {
            String text = newLootDraft.getText().trim();
            if (text.isBlank() || sessionId <= 0L || authoritativeRevision <= 0L || sceneToken <= 0L) {
                return;
            }
            pendingNewNoteText = text;
            noteIdsBeforeAdd = Set.copyOf(manualNoteEditors.keySet());
            addLootHandler.handle(new ManualNoteAddDraft(sessionId, authoritativeRevision, sceneToken, text));
        }

        private final class ManualNoteEditor extends HBox {
            private final long noteId;
            private final TextField text = new TextField();
            private final Button save = button("Speichern", ACCENT);
            private final Button remove = button("Entfernen", FLAT);
            private String loadedText = "";
            private long guardRevision;
            private boolean pendingRemoval;

            private ManualNoteEditor(long noteId) {
                super(8);
                this.noteId = noteId;
                getStyleClass().add("session-planner-manual-note");
                text.getStyleClass().add(COMPACT);
                text.setAccessibleText("Text der manuellen Beutenotiz " + noteId);
                save.setAccessibleText("Manuelle Beutenotiz " + noteId + " speichern");
                remove.setAccessibleText("Manuelle Beutenotiz " + noteId + " entfernen");
                save.setOnAction(event -> save());
                remove.setOnAction(event -> remove());
                HBox.setHgrow(text, Priority.ALWAYS);
                setAlignment(Pos.CENTER_LEFT);
                getChildren().setAll(text, save, remove);
            }

            private void update(String authoritativeText, long nextRevision, boolean disabled) {
                String current = text.getText().trim();
                boolean dirty = !current.equals(loadedText);
                if (guardRevision == 0L || !dirty || authoritativeText.equals(current)) {
                    text.setText(authoritativeText);
                    loadedText = authoritativeText;
                    guardRevision = nextRevision;
                    pendingRemoval = false;
                } else if (authoritativeText.equals(loadedText)) {
                    guardRevision = nextRevision;
                }
                save.setDisable(disabled);
                remove.setDisable(disabled);
            }

            private boolean isDirty() {
                return !text.getText().trim().equals(loadedText);
            }

            private void save() {
                String authored = text.getText().trim();
                if (authored.isBlank() || guardRevision <= 0L) {
                    return;
                }
                updateLootHandler.handle(new ManualNoteEditDraft(
                        sessionId, guardRevision, sceneToken, noteId, authored));
            }

            private void remove() {
                if (guardRevision <= 0L) {
                    return;
                }
                pendingRemoval = true;
                removeLootHandler.handle(new ManualNoteRemoveDraft(
                        sessionId, guardRevision, sceneToken, noteId));
            }
        }

        private void renderRewards(SessionPlannerViewModel.TimelineProjection.SelectedSceneModel selected) {
            List<Node> materialized = new ArrayList<>();
            if (selected.generatedRewards().isEmpty()) {
                materialized.add(label("Keine generierten Belohnungen.", SECONDARY));
            }
            selected.generatedRewards().forEach(reward -> materialized.add(rewardCard(reward)));
            generatedRewardRows.getChildren().setAll(materialized);
        }

        private Node rewardCard(SessionPlannerSelectedSceneSnapshot.GeneratedReward reward) {
            VBox card = new VBox(4);
            card.getStyleClass().add("session-planner-generated-reward");
            card.setAccessibleText("Generierte Belohnung " + reward.displayLabel());
            if (reward.availability() == SessionPlannerSelectedSceneSnapshot.Availability.UNAVAILABLE) {
                card.getChildren().setAll(label("Nicht verfügbar", "session-planner-gap-active"),
                        label(reward.statusText().isBlank() ? reward.fallbackLabel() : reward.statusText(), SECONDARY));
                return card;
            }
            card.getChildren().addAll(
                    label("Verfügbar · " + reward.channel() + " · " + reward.stockClass(), "session-planner-plan-name"),
                    label("Thema " + value(reward.theme()) + " · Magie " + value(reward.magicType())
                            + " · Ziel " + reward.targetCp() + " cp", SECONDARY),
                    label("Slots " + reward.nonMagicSlots() + " nichtmagisch / "
                            + reward.magicSlots() + " magisch", SECONDARY));
            VBox items = new VBox(3);
            reward.itemLines().forEach(item -> items.getChildren().add(label(
                    item.quantity() + " × " + item.text() + " · " + item.actualCp() + " cp · "
                            + value(item.role()) + " / " + value(item.itemId())
                            + (item.magicRarity().isBlank() ? "" : " · " + item.magicRarity())
                            + (item.cursed() ? " · verflucht" : "") + " · Kapazität "
                            + item.totalCapacity() + " · Behälter " + value(item.allowedContainers()),
                    SECONDARY, "session-planner-reward-item-row")));
            VBox packing = new VBox(3);
            reward.packing().forEach(row -> packing.getChildren().add(label(
                    row.containerCount() + " × " + value(row.containerType()) + " · "
                            + value(row.containerId()) + " · " + (row.valid() ? "gültig" : "ungültig"),
                    SECONDARY, "session-planner-reward-packing-row")));
            card.getChildren().addAll(items, packing);
            return card;
        }

        private void captureFocus() {
            focusedNode = null;
            if (getScene() == null || getScene().getFocusOwner() == null
                    || !isDescendant(getScene().getFocusOwner(), this)) {
                return;
            }
            focusedNode = getScene().getFocusOwner();
            if (focusedNode instanceof TextField field) {
                anchor = field.getAnchor();
                caret = field.getCaretPosition();
            } else if (focusedNode instanceof TextArea area) {
                anchor = area.getAnchor();
                caret = area.getCaretPosition();
            }
        }

        private void restoreFocus() {
            if (focusedNode == null) {
                return;
            }
            focusedNode.requestFocus();
            if (focusedNode instanceof TextField field) {
                field.selectRange(anchor, caret);
            } else if (focusedNode instanceof TextArea area) {
                area.selectRange(anchor, caret);
            }
            focusedNode = null;
        }
    }

    private final class RestSeparator extends HBox {
        private final Label text = label("", SECONDARY);
        private final Button shortRest = button("Kurze Rast", FLAT);
        private final Button longRest = button("Lange Rast", FLAT);
        private final Button clear = button("Leeren", FLAT);
        private long left;
        private long right;

        private RestSeparator() {
            super(6);
            setAlignment(Pos.CENTER_LEFT);
            getStyleClass().add("session-planner-rest-separator");
            shortRest.setOnAction(event -> shortRestHandler.handle(left, right));
            longRest.setOnAction(event -> longRestHandler.handle(left, right));
            clear.setOnAction(event -> clearRestHandler.handle(left, right));
            getChildren().setAll(text, spacer(), shortRest, longRest, clear);
        }

        private void update(SessionPlannerViewModel.TimelineProjection.RestGapModel gap, boolean disabled) {
            left = gap.leftSceneToken();
            right = gap.rightSceneToken();
            String context = "zwischen „" + gap.leftSceneTitle() + "“ und „" + gap.rightSceneTitle() + "“";
            String status = gap.hasAssignedRest() ? gap.label() : "Keine Rast";
            String accessibleText = status + " " + context;
            text.setText(gap.hasAssignedRest() ? "Rast: " + gap.label() : "Keine Rast zwischen den Szenen");
            setAccessibleText(accessibleText);
            setAccessibleHelp("Rast-Auswahl " + context + ".");
            text.setAccessibleText(accessibleText);
            shortRest.setAccessibleText("Kurze Rast " + context);
            longRest.setAccessibleText("Lange Rast " + context);
            clear.setAccessibleText("Rast leeren " + context);
            shortRest.setDisable(disabled);
            longRest.setDisable(disabled);
            clear.setDisable(disabled || !gap.hasAssignedRest());
        }
    }

    private static final class LocationComboBox
            extends ComboBox<SessionPlannerViewModel.TimelineProjection.LocationChoice> {
        private LocationComboBox() {
            setPromptText("Location");
            setAccessibleText("Location der ausgewählten Szene");
            getStyleClass().add(COMPACT);
            setConverter(new StringConverter<>() {
                @Override public String toString(SessionPlannerViewModel.TimelineProjection.LocationChoice value) {
                    return value == null ? "" : value.toString();
                }
                @Override public SessionPlannerViewModel.TimelineProjection.LocationChoice fromString(String text) {
                    return getValue();
                }
            });
        }

        private void setChoices(List<SessionPlannerViewModel.TimelineProjection.LocationChoice> choices, long selected) {
            getItems().setAll(choices);
            getSelectionModel().select(getItems().stream().filter(choice -> choice.id() == selected)
                    .findFirst().orElse(getItems().isEmpty() ? null : getItems().getFirst()));
        }

        private long selectedLocationId() {
            return getValue() == null ? 0L : getValue().id();
        }
    }

    private static boolean isDescendant(Node node, Node ancestor) {
        Node current = node;
        while (current != null) {
            if (current == ancestor) {
                return true;
            }
            current = current.getParent();
        }
        return false;
    }

    private static int countStyle(Node node, String styleClass) {
        int count = node.getStyleClass().contains(styleClass) ? 1 : 0;
        if (node instanceof javafx.scene.Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                count += countStyle(child, styleClass);
            }
        }
        return count;
    }

    private static double clamp(double value) { return Math.max(0.0, Math.min(1.0, value)); }
    private static String value(String text) { return text == null || text.isBlank() ? "–" : text; }
    private static void show(Node node, boolean visible) { node.setVisible(visible); node.setManaged(visible); }
    private static HBox actionRow(Node... nodes) { HBox row = new HBox(6, nodes); row.setAlignment(Pos.CENTER_LEFT); return row; }
    private static Region spacer() { Region region = new Region(); HBox.setHgrow(region, Priority.ALWAYS); return region; }
    private static Label label(String text, String... styles) { Label label = new Label(text); label.getStyleClass().addAll(styles); return label; }
    private static Button button(String text, String... styles) { Button button = new Button(text); button.getStyleClass().add(COMPACT); button.getStyleClass().addAll(styles); return button; }

    @FunctionalInterface public interface AllocationHandler { void handle(long sceneToken, BigDecimal newPercentage); }
    @FunctionalInterface public interface MoveHandler { void handle(long sceneToken, boolean up); }
    record SceneEditDraft(
            long sessionId,
            long expectedRevision,
            long sceneToken,
            String title,
            String notes,
            long locationId
    ) { }

    record ManualNoteAddDraft(long sessionId, long expectedRevision, long sceneToken, String authoredText) { }
    record ManualNoteEditDraft(
            long sessionId, long expectedRevision, long sceneToken, long noteId, String authoredText
    ) { }
    record ManualNoteRemoveDraft(long sessionId, long expectedRevision, long sceneToken, long noteId) { }

    @FunctionalInterface public interface SceneEditHandler { void handle(SceneEditDraft draft); }
    @FunctionalInterface public interface ManualNoteAddHandler { void handle(ManualNoteAddDraft draft); }
    @FunctionalInterface public interface ManualNoteEditHandler { void handle(ManualNoteEditDraft draft); }
    @FunctionalInterface public interface ManualNoteRemoveHandler { void handle(ManualNoteRemoveDraft draft); }
    @FunctionalInterface public interface RestHandler { void handle(long leftSceneToken, long rightSceneToken); }
    @FunctionalInterface public interface AttachPlanHandler { void handle(long sceneToken, long planId); }
    @FunctionalInterface public interface PlanSearchHandler { void handle(long sceneToken, String query); }
}
