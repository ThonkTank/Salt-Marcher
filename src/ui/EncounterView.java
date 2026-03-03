package ui;

import entities.CombatantState;
import entities.PlayerCharacter;
import javafx.concurrent.Task;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextInputControl;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import repositories.PlayerCharacterRepository;
import services.CombatSetup;
import services.EncounterGenerator;
import services.EncounterGenerator.Encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Encounter workflow view: orchestrates builder, initiative, and combat modes.
 * Provides content for all three zones of the app shell.
 * A layout toggle button in the toolbar lets the user switch between
 * 3-column and stacked layouts (handled by AppShell).
 */
public class EncounterView implements AppView {

    enum Mode { BUILDER, INITIATIVE, COMBAT }

    private Runnable onRefreshToolbar;
    private Runnable onRefreshPanels;
    private Runnable onToggleLayout;
    private Consumer<Long> onRequestStatBlock;
    private Consumer<Long> onEnsureStatBlock;
    private final MonsterListPane monsterList;

    private final EncounterControls encounterControls;
    private final CombatControls combatControls;
    private final EncounterRosterPane rosterPane;
    private CombatTrackerPane trackerPane;
    private InitiativePane initiativePane;

    private final Button layoutToggle;
    private final Label partySummaryLabel;

    private List<PlayerCharacter> partyCache = new ArrayList<>();
    private int cachedAvgLevel = 1;
    private Mode currentMode = Mode.BUILDER;
    private Scene scene;
    private final EventHandler<KeyEvent> combatKeyHandler = this::handleSceneCombatKey;

    public EncounterView() {
        monsterList = new MonsterListPane();
        encounterControls = new EncounterControls();
        combatControls = new CombatControls();
        rosterPane = new EncounterRosterPane();

        // Layout toggle button (delegates to AppShell)
        layoutToggle = new Button("\u2194");
        layoutToggle.setTooltip(new Tooltip("Layout wechseln (Spalten / Gestapelt)"));
        layoutToggle.getStyleClass().add("compact");
        layoutToggle.setOnAction(e -> { if (onToggleLayout != null) onToggleLayout.run(); });
        layoutToggle.setAccessibleText("Layout wechseln");

        // Wiring (filter callback wired in setFilterData when FilterPane is ready)
        monsterList.setOnAddCreature(this::onAddCreature);
        monsterList.setOnRequestStatBlock(id -> { if (onRequestStatBlock != null) onRequestStatBlock.accept(id); });
        rosterPane.setOnGenerate(this::onGenerate);
        rosterPane.setOnStartCombat(this::onRequestCombat);
        rosterPane.setOnRosterChanged(() -> rosterPane.setStartCombatEnabled(rosterPane.hasSlots()));
        rosterPane.setOnRequestStatBlock(id -> { if (onRequestStatBlock != null) onRequestStatBlock.accept(id); });
        combatControls.getQuickSearch().setOnCreatureSelected(this::onAddReinforcement);

        partySummaryLabel = new Label("Keine Party-Mitglieder");
        partySummaryLabel.getStyleClass().add("text-secondary");
    }

    // ---- Callback setters (wired by SaltMarcherApp after construction) ----
    // Internal wiring (between panes owned by this view) happens in the constructor.
    // Cross-view callbacks (stat block, toolbar, layout) are injected here by SaltMarcherApp.

    public void setOnRefreshToolbar(Runnable callback) { this.onRefreshToolbar = callback; }
    public void setOnRefreshPanels(Runnable callback) { this.onRefreshPanels = callback; }
    public void setOnToggleLayout(Runnable callback) { this.onToggleLayout = callback; }
    public void setOnRequestStatBlock(Consumer<Long> callback) { this.onRequestStatBlock = callback; }
    public void setOnEnsureStatBlock(Consumer<Long> callback) { this.onEnsureStatBlock = callback; }
    // Scene must be set before combat starts so the scene-level key filter can be installed.
    public void setScene(Scene scene) { this.scene = scene; }

    public void setFilterData(FilterPane.FilterData data) {
        encounterControls.setFilterData(data);
        encounterControls.getFilterPane().setOnFilterChanged(monsterList::applyFilters);
    }

    // ---- AppView interface ----

    @Override public Node getRoot() { return monsterList; }

    @Override public String getTitle() {
        return switch (currentMode) {
            case BUILDER -> "Encounter Builder";
            case INITIATIVE -> "Initiative";
            case COMBAT -> "Encounter Runner";
        };
    }

    @Override public String getIconText() { return "\u2694"; }

    @Override
    public List<Node> getToolbarItems() {
        return List.of(layoutToggle, partySummaryLabel);
    }

    @Override
    public Node getControlPanel() {
        return switch (currentMode) {
            case COMBAT -> combatControls;
            case BUILDER, INITIATIVE -> encounterControls;
        };
    }

    @Override
    public Node getInspectorContent() {
        return switch (currentMode) {
            case BUILDER -> rosterPane;
            case INITIATIVE -> initiativePane;
            case COMBAT -> trackerPane;
        };
    }

    @Override
    public void onLayoutChanged(boolean stacked) {
        encounterControls.setHorizontal(stacked);
    }

    @Override
    public void onShow() {
        refreshPartyState();
        monsterList.loadInitial();
    }

    // ---- Mode switching ----

    private void switchMode(Mode mode) {
        Mode oldMode = currentMode;
        currentMode = mode;
        monsterList.setCombatMode(mode == Mode.COMBAT);

        // Install/remove scene-level combat shortcuts
        if (scene != null) {
            if (mode == Mode.COMBAT && oldMode != Mode.COMBAT) {
                scene.addEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            } else if (mode != Mode.COMBAT && oldMode == Mode.COMBAT) {
                scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            }
        }

        if (onRefreshToolbar != null) onRefreshToolbar.run();
        if (onRefreshPanels != null) onRefreshPanels.run();
    }

    private void handleSceneCombatKey(KeyEvent e) {
        if (currentMode != Mode.COMBAT) return;
        if (e.getTarget() instanceof TextInputControl) return;
        if (trackerPane != null && trackerPane.handleCombatKey(e)) {
            e.consume();
        }
    }

    // ---- Party ----

    public void refreshPartyState() {
        rosterPane.setGenerateEnabled(false);
        rosterPane.setStartCombatEnabled(false);
        Task<List<PlayerCharacter>> task = new Task<>() {
            @Override protected List<PlayerCharacter> call() {
                return PlayerCharacterRepository.getAllCharacters();
            }
        };
        task.setOnSucceeded(e -> {
            partyCache = task.getValue();
            int size = partyCache.size();
            if (size > 0) {
                cachedAvgLevel = (int) Math.round(
                        partyCache.stream().mapToInt(pc -> pc.Level).average().orElse(1));
                partySummaryLabel.setText("Party: " + size + " Chars, \u00D8 Lv " + cachedAvgLevel);
                rosterPane.setPartyInfo(size, cachedAvgLevel);
            } else {
                partySummaryLabel.setText("Keine Party-Mitglieder");
                rosterPane.setPartyInfo(0, 1);
            }
            rosterPane.setGenerateEnabled(true);
            // "Kampf starten" stays disabled until roster has slots
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        });
        task.setOnFailed(e ->
                System.err.println("Party laden fehlgeschlagen: " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-party-load");
        t.setDaemon(true);
        t.start();
    }

    // ---- Actions ----

    private void onAddCreature(entities.Creature creature) {
        if (currentMode == Mode.COMBAT && trackerPane != null) {
            trackerPane.addReinforcement(creature);
            updateCombatStatus();
        } else {
            rosterPane.addCreature(creature);
        }
    }

    private void onAddReinforcement(entities.Creature creature) {
        if (trackerPane != null) {
            trackerPane.addReinforcement(creature);
            updateCombatStatus();
        }
    }

    // ---- Encounter Generation ----

    private void onGenerate() {
        if (!ensurePartyExists()) return;

        int partySize = partyCache.size();
        int avgLevel = cachedAvgLevel;

        FilterPane filterPane = encounterControls.getFilterPane();
        FilterPane.FilterCriteria criteria = filterPane != null
                ? filterPane.buildCriteria() : new FilterPane.FilterCriteria();
        List<String> types    = nullIfEmpty(criteria.types);
        List<String> subtypes = nullIfEmpty(criteria.subtypes);
        List<String> biomes   = nullIfEmpty(criteria.biomes);

        double difficulty = encounterControls.getSelectedDifficulty();
        int groupCount = encounterControls.getSelectedGroupCount();
        double balance = encounterControls.getSelectedBalance();
        double strength = encounterControls.getSelectedStrength();

        rosterPane.showGenerating();
        rosterPane.setGenerateEnabled(false);

        Task<Encounter> task = new Task<>() {
            @Override protected Encounter call() {
                return EncounterGenerator.generateEncounter(
                        partySize, avgLevel, types, subtypes, biomes,
                        difficulty, groupCount, balance, strength);
            }
        };
        task.setOnSucceeded(e -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.setEncounter(task.getValue());
        });
        task.setOnFailed(e -> {
            System.err.println("Encounter generieren fehlgeschlagen: " + task.getException().getMessage());
            rosterPane.setGenerateEnabled(true);
            rosterPane.showGenerationFailed();
        });
        Thread t = new Thread(task, "sm-encounter-gen");
        t.setDaemon(true);
        t.start();
    }

    // ---- Combat start (via initiative phase) ----

    private void onRequestCombat() {
        if (!rosterPane.hasSlots()) return;
        if (!ensurePartyExists()) return;

        initiativePane = new InitiativePane(partyCache);
        initiativePane.setOnConfirm(initiatives -> {
            Encounter encounter = rosterPane.buildEncounter();
            List<CombatantState> combatants = CombatSetup.buildCombatants(
                    partyCache, initiatives, encounter);
            initiativePane = null;
            startCombat(combatants);
        });
        initiativePane.setOnCancel(() -> {
            initiativePane = null;
            switchMode(Mode.BUILDER);
        });

        switchMode(Mode.INITIATIVE);
    }

    private void startCombat(List<CombatantState> combatants) {
        trackerPane = new CombatTrackerPane();
        trackerPane.setOnRequestStatBlock(id -> { if (onRequestStatBlock != null) onRequestStatBlock.accept(id); });
        trackerPane.setOnEnsureStatBlock(id -> { if (onEnsureStatBlock != null) onEnsureStatBlock.accept(id); });
        trackerPane.setOnCombatStateChanged(this::updateCombatStatus);
        trackerPane.setOnEndCombat(this::onEndCombat);
        trackerPane.startCombat(combatants);

        switchMode(Mode.COMBAT);
        updateCombatStatus();
    }

    private void onEndCombat() {
        trackerPane = null;
        switchMode(Mode.BUILDER);
    }

    private void updateCombatStatus() {
        if (trackerPane == null) return;
        CombatTrackerPane.CombatStats stats = trackerPane.computeStats(
                Math.max(1, partyCache.size()), cachedAvgLevel);
        combatControls.updateStatus(stats, trackerPane.getRound(), trackerPane.getCurrentTurnName());
    }

    // ---- Helpers ----

    private static <T> List<T> nullIfEmpty(List<T> list) {
        return list.isEmpty() ? null : new ArrayList<>(list);
    }

    private boolean ensurePartyExists() {
        if (partyCache.isEmpty()) {
            new Alert(Alert.AlertType.WARNING,
                    "Die Party hat keine Mitglieder.\nBitte zuerst Charaktere hinzufuegen.")
                    .showAndWait();
            return false;
        }
        return true;
    }
}
