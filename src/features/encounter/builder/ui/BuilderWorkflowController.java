package features.encounter.builder.ui;

import features.creatures.api.CreatureCatalogService;
import features.creatures.model.Creature;
import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.ui.CombatWorkflowController;
import features.encounter.combat.ui.InitiativePane;
import features.encounter.generation.service.EncounterDifficultyBand;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.builder.application.ports.EncounterTableProvider;
import features.encounter.internal.EncounterAsyncTaskSupport;
import features.encountertable.model.EncounterTable;
import features.encounter.partyanalysis.model.CreatureRoleProfile;
import features.party.api.PartyApi;
import javafx.concurrent.Task;
import javafx.scene.control.Alert;
import ui.shell.SceneHandle;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class BuilderWorkflowController {

    private final EncounterBuilderService encounterService;
    private final EncounterControls encounterControls;
    private final EncounterRosterPane rosterPane;
    private final SceneHandle encounterScene;
    private final Supplier<CreatureCatalogService.FilterCriteria> criteriaSupplier;
    private final Consumer<InitiativePane> onShowInitiativePane;
    private final CombatWorkflowController combatWorkflowController;

    private List<PartyApi.PartyMember> partyCache = new ArrayList<>();
    private int cachedAvgLevel = 1;
    private Task<EncounterBuilderService.PartySnapshot> partyLoadTask;
    private Task<EncounterTableProvider.TableCatalogResult> tableLoadTask;
    private Task<EncounterGenerator.GenerationResult> generationTask;

    public BuilderWorkflowController(
            EncounterBuilderService encounterService,
            EncounterControls encounterControls,
            EncounterRosterPane rosterPane,
            SceneHandle encounterScene,
            Supplier<CreatureCatalogService.FilterCriteria> criteriaSupplier,
            Consumer<InitiativePane> onShowInitiativePane,
            CombatWorkflowController combatWorkflowController
    ) {
        this.encounterService = Objects.requireNonNull(encounterService, "encounterService");
        this.encounterControls = Objects.requireNonNull(encounterControls, "encounterControls");
        this.rosterPane = Objects.requireNonNull(rosterPane, "rosterPane");
        this.encounterScene = Objects.requireNonNull(encounterScene, "encounterScene");
        this.criteriaSupplier = Objects.requireNonNull(criteriaSupplier, "criteriaSupplier");
        this.onShowInitiativePane = Objects.requireNonNull(onShowInitiativePane, "onShowInitiativePane");
        this.combatWorkflowController = Objects.requireNonNull(combatWorkflowController, "combatWorkflowController");
    }

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        encounterControls.setFilterData(data);
    }

    public void setTableList(List<EncounterTable> tables) {
        encounterControls.setTableList(tables);
    }

    public void refreshState() {
        refreshPartyState();
        refreshTableState();
    }

    public void cancelPendingTasks() {
        EncounterAsyncTaskSupport.cancel(partyLoadTask);
        EncounterAsyncTaskSupport.cancel(tableLoadTask);
        EncounterAsyncTaskSupport.cancel(generationTask);
    }

    public void addCreature(Creature creature, CreatureRoleProfile roleProfile) {
        rosterPane.addCreature(creature, roleProfile);
    }

    public void onGenerate() {
        if (!ensurePartyExists()) {
            return;
        }
        EncounterAsyncTaskSupport.cancel(generationTask);

        int partySize = partyCache.size();
        int avgLevel = cachedAvgLevel;
        CreatureCatalogService.FilterCriteria criteria = criteriaSupplier.get();
        EncounterDifficultyBand difficultyBand = encounterControls.getSelectedDifficultyBand();
        int balanceLevel = encounterControls.getSelectedBalanceLevel();
        double amountValue = encounterControls.getSelectedAmountValue();
        List<Long> tableIds = encounterControls.getSelectedTableIds();

        rosterPane.showGenerating();
        rosterPane.setGenerateEnabled(false);

        Task<EncounterGenerator.GenerationResult> task = new Task<>() {
            @Override
            protected EncounterGenerator.GenerationResult call() {
                return encounterService.generateEncounter(new EncounterBuilderService.GenerationRequest(
                        partySize,
                        avgLevel,
                        new EncounterBuilderService.EncounterFilter(
                                criteria.types(),
                                criteria.subtypes(),
                                criteria.biomes()
                        ),
                        difficultyBand,
                        balanceLevel,
                        amountValue,
                        tableIds
                ));
            }
        };
        generationTask = task;
        EncounterAsyncTaskSupport.submit(task, "EncounterView.onGenerate()", result -> {
            rosterPane.setGenerateEnabled(true);
            if (result == null) {
                rosterPane.showGenerationFailed();
                return;
            }
            switch (result.status()) {
                case SUCCESS -> {
                    rosterPane.setEncounter(result.encounter());
                    showGenerationAdvisory(result.advisory());
                }
                case BLOCKED_BY_USER_INPUT, NO_SOLUTION, TIMEOUT ->
                        rosterPane.showGenerationFailed(mapGenerationFailure(result.failureReason()));
            }
        }, () -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.showGenerationFailed();
        }, () -> generationTask == task);
    }

    public void onRequestCombat() {
        if (!rosterPane.hasSlots() || !ensurePartyExists()) {
            return;
        }

        Encounter encounter = rosterPane.buildEncounter();
        List<PartyApi.PartyMember> partyCopy = List.copyOf(partyCache);
        InitiativePane initiativePane = new InitiativePane(partyCopy, encounter.slots());
        initiativePane.setOnCancel(() -> encounterScene.setContent(rosterPane));
        initiativePane.setOnConfirm(result -> combatWorkflowController.prepareCombat(
                partyCopy,
                result.pcInitiatives(),
                encounter,
                result.monsterInitiatives(),
                this::getPartyCache,
                this::getCachedAvgLevel
        ));
        onShowInitiativePane.accept(initiativePane);
    }

    public void onRosterChanged() {
        List<EncounterSlot> slots = rosterPane.getSlots();
        boolean hasData = !slots.isEmpty() && !partyCache.isEmpty();
        if (hasData) {
            rosterPane.updateSummary(encounterService.computeRosterDifficultyStats(
                    slots, partyCache.size(), cachedAvgLevel));
        } else {
            rosterPane.updateSummary(null);
        }
        rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
    }

    List<PartyApi.PartyMember> getPartyCache() {
        return partyCache;
    }

    int getCachedAvgLevel() {
        return cachedAvgLevel;
    }

    private void refreshPartyState() {
        EncounterAsyncTaskSupport.cancel(partyLoadTask);
        rosterPane.setGenerateEnabled(false);
        rosterPane.setStartCombatEnabled(false);
        Task<EncounterBuilderService.PartySnapshot> task = new Task<>() {
            @Override
            protected EncounterBuilderService.PartySnapshot call() {
                return encounterService.loadPartySnapshot();
            }
        };
        partyLoadTask = task;
        EncounterAsyncTaskSupport.submit(task, "EncounterView.refreshPartyState()", snapshot -> {
            partyCache = snapshot.party();
            int size = partyCache.size();
            if (size > 0) {
                cachedAvgLevel = snapshot.avgLevel();
                rosterPane.setPartyInfo(size, cachedAvgLevel);
                encounterControls.setPartyContext(size, cachedAvgLevel);
            } else {
                cachedAvgLevel = 1;
                rosterPane.setPartyInfo(0, 1);
                encounterControls.setPartyContext(1, 1);
            }
            rosterPane.setGenerateEnabled(true);
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        }, () -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        }, () -> partyLoadTask == task);
    }

    private void refreshTableState() {
        EncounterAsyncTaskSupport.cancel(tableLoadTask);
        Task<EncounterTableProvider.TableCatalogResult> task = new Task<>() {
            @Override
            protected EncounterTableProvider.TableCatalogResult call() {
                return encounterService.loadEncounterTables();
            }
        };
        tableLoadTask = task;
        EncounterAsyncTaskSupport.submit(task, "EncounterView.refreshTableState()", result -> {
            if (result.status() == EncounterTableProvider.TableLoadStatus.SUCCESS) {
                encounterControls.setTableList(result.tables());
            } else {
                encounterControls.setTableList(List.of());
                Alert alert = new Alert(Alert.AlertType.ERROR,
                        "Encounter-Tabellen konnten nicht geladen werden.");
                alert.setTitle("Encounter Builder");
                alert.setHeaderText("Datenbankzugriff fehlgeschlagen");
                alert.showAndWait();
            }
        }, () -> tableLoadTask == task);
    }

    private boolean ensurePartyExists() {
        if (partyCache.isEmpty()) {
            new Alert(Alert.AlertType.WARNING,
                    "Die Party hat keine Mitglieder.\nBitte zuerst Charaktere hinzufügen.")
                    .showAndWait();
            return false;
        }
        return true;
    }

    private void showGenerationAdvisory(EncounterGenerator.GenerationAdvisory advisory) {
        if (advisory == null) {
            return;
        }
        Alert alert = new Alert(Alert.AlertType.INFORMATION, mapGenerationAdvisory(advisory));
        alert.setTitle("Encounter Builder");
        alert.setHeaderText("Encounter mit Fallback generiert");
        alert.show();
    }

    private String mapGenerationFailure(EncounterGenerator.GenerationFailureReason reason) {
        if (reason == null) {
            return "Generierung fehlgeschlagen. Nochmal versuchen.";
        }
        return switch (reason) {
            case TABLE_CANDIDATES_STORAGE_ERROR ->
                    "Datenbankfehler: Tabellen-Kandidaten konnten nicht geladen werden.";
            case AUTO_CONFIG_NO_SOLUTION ->
                    "Keine machbare Auto-Kombination gefunden.";
            case TIMEOUT ->
                    "Zeitlimit erreicht. Einstellungen lockern oder Auto verwenden.";
        };
    }

    private String mapGenerationAdvisory(EncounterGenerator.GenerationAdvisory advisory) {
        return switch (advisory) {
            case PARTY_ROLE_FALLBACK_CACHE_REBUILDING ->
                    "Party-abhängige Rollen waren noch nicht bereit. Das Encounter wurde mit statischen Rollen generiert; der Cache wird im Hintergrund neu aufgebaut.";
            case PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE ->
                    "Party-abhängige Rollen konnten wegen eines Speicherproblems nicht geladen werden. Das Encounter wurde mit statischen Rollen generiert.";
        };
    }
}
