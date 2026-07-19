package features.catalog.application;

import features.catalog.application.WorldReferenceCatalogState.FactionRow;
import features.catalog.application.WorldReferenceCatalogState.LocationRow;
import features.catalog.application.WorldReferenceCatalogState.NpcRow;
import features.catalog.application.WorldReferenceCatalogState.ReferenceSectionState;
import features.creatures.api.CreatureCatalogRow;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanSummary;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import platform.ui.UiDispatcher;

/** Owns seven retained BrowseSessions and activates exactly the selected one. */
public final class CatalogWorkspaceController implements CatalogLifecycle {

    private final UiDispatcher dispatcher;
    private final ScheduledExecutorService debounceScheduler;
    private final MonsterCatalogDefinition monsterDefinition;
    private final ItemsCatalogDefinition itemsDefinition;
    private final SavedEncounterCatalogDefinition savedEncounterDefinition;
    private final NpcCatalogDefinition npcDefinition;
    private final FactionCatalogDefinition factionDefinition;
    private final LocationCatalogDefinition locationDefinition;
    private final EncounterTableCatalogDefinition encounterTableDefinition;
    private final BrowseSession<MonsterCatalogQuery, CreatureCatalogRow, Long> monsters;
    private final BrowseSession<ItemsCatalogQuery, ItemsCatalogApi.ItemRow, String> items;
    private final BrowseSession<NoCatalogQuery, SavedEncounterPlanSummary, Long> savedEncounters;
    private final BrowseSession<TextCatalogQuery, NpcRow, Long> npcs;
    private final BrowseSession<TextCatalogQuery, FactionRow, Long> factions;
    private final BrowseSession<TextCatalogQuery, LocationRow, Long> locations;
    private final BrowseSession<TextCatalogQuery, EncounterTableCatalogState.EncounterTableRow, Long>
            encounterTables;
    private final List<CatalogLifecycle> sessions;
    private final CatalogWorkspacePublication publication;
    private CatalogSectionId activeSection = CatalogSectionId.MONSTERS;
    private SavedEncounterCatalogState.Confirmation savedConfirmation =
            SavedEncounterCatalogState.Confirmation.none();
    private String savedActionMessage = "";
    private String itemsActionMessage = "";
    private long savedActionEpoch;
    private long itemsActionEpoch;
    private long revision;
    private boolean active;
    private boolean transitioning;
    private boolean closed;

    public CatalogWorkspaceController(
            CatalogSectionDefinitions definitions,
            UiDispatcher publicationDispatcher
    ) {
        dispatcher = Objects.requireNonNull(publicationDispatcher, "publicationDispatcher");
        CatalogSectionDefinitions requiredDefinitions = Objects.requireNonNull(definitions, "definitions");
        debounceScheduler = Executors.newSingleThreadScheduledExecutor(new DebounceThreadFactory());
        monsterDefinition = requiredDefinitions.monsters();
        itemsDefinition = requiredDefinitions.items();
        savedEncounterDefinition = requiredDefinitions.savedEncounters();
        npcDefinition = requiredDefinitions.npcs();
        factionDefinition = requiredDefinitions.factions();
        locationDefinition = requiredDefinitions.locations();
        encounterTableDefinition = requiredDefinitions.encounterTables();
        monsters = session(monsterDefinition);
        items = session(itemsDefinition);
        savedEncounters = session(savedEncounterDefinition);
        npcs = session(npcDefinition);
        factions = session(factionDefinition);
        locations = session(locationDefinition);
        encounterTables = session(encounterTableDefinition);
        sessions = List.of(monsters, items, savedEncounters, npcs, factions, locations, encounterTables);
        publication = new CatalogWorkspacePublication(snapshot(), dispatcher);
    }

    public CatalogWorkspacePublication publication() {
        return publication;
    }

    public void selectSection(CatalogSectionId section) {
        CatalogSectionId next = Objects.requireNonNull(section, "section");
        if (closed || next == activeSection) {
            return;
        }
        CatalogSectionId previous = activeSection;
        transitioning = true;
        try {
            if (active) {
                session(previous).deactivate();
            }
            activeSection = next;
            if (active) {
                try {
                    session(next).activate();
                } catch (RuntimeException | Error activationFailure) {
                    activeSection = previous;
                    try {
                        session(previous).activate();
                    } catch (RuntimeException | Error rollbackFailure) {
                        activationFailure.addSuppressed(rollbackFailure);
                    }
                    throw activationFailure;
                }
            }
        } finally {
            transitioning = false;
            publish();
        }
    }

    public void acceptMonsterIntent(MonsterCatalogIntent intent) {
        if (intent == null || !isActive(CatalogSectionId.MONSTERS)) {
            return;
        }
        switch (intent) {
            case MonsterCatalogIntent.ChangeFilters change ->
                    monsters.editDraft(monsters.state().draft().withFilters(change.filters()));
            case MonsterCatalogIntent.ChangeSort change ->
                    monsters.editDraft(monsters.state().draft().withSort(change.sort()));
            case MonsterCatalogIntent.Submit ignored -> monsters.submit();
            case MonsterCatalogIntent.ShiftPage shift -> monsters.shiftPage(shift.direction());
            case MonsterCatalogIntent.SelectCreature select -> monsters.select(select.creatureId());
            case MonsterCatalogIntent.OpenCreature open -> monsters.find(open.creatureId())
                    .ifPresent(row -> monsterDefinition.open(row.id()));
            case MonsterCatalogIntent.AddToEncounter add -> monsters.find(add.creatureId())
                    .ifPresent(row -> monsterDefinition.addToEncounter(row.id()));
            case MonsterCatalogIntent.AddToScene add -> monsters.find(add.creatureId())
                    .ifPresent(row -> monsterDefinition.addToScene(row.id()));
        }
    }

    public void acceptItemsIntent(ItemsCatalogIntent intent) {
        if (intent == null || !isActive(CatalogSectionId.ITEMS)) {
            return;
        }
        switch (intent) {
            case ItemsCatalogIntent.ChangeDraft change ->
                    items.editDraft(items.state().draft().withFilters(change.draft()));
            case ItemsCatalogIntent.Search ignored -> items.submit();
            case ItemsCatalogIntent.ShiftPage shift -> items.shiftPage(shift.direction());
            case ItemsCatalogIntent.SelectItem select -> {
                items.select(select.sourceKey());
                itemsActionEpoch++;
                itemsActionMessage = "";
                publish();
            }
            case ItemsCatalogIntent.OpenItem open -> openItem(open.sourceKey());
        }
    }

    public void acceptSavedEncounterIntent(SavedEncounterCatalogIntent intent) {
        if (intent == null || !isActive(CatalogSectionId.SAVED_ENCOUNTERS)) {
            return;
        }
        switch (intent) {
            case SavedEncounterCatalogIntent.SelectPlan select -> {
                savedEncounters.select(select.planId());
                savedActionEpoch++;
                savedConfirmation = savedConfirmation.clear();
                savedActionMessage = "";
                publish();
            }
            case SavedEncounterCatalogIntent.OpenPlan open -> openSavedEncounter(open.planId(), false);
            case SavedEncounterCatalogIntent.ConfirmOpen confirm -> {
                if (matchesConfirmation(confirm.confirmationRevision(), confirm.planId())) {
                    openSavedEncounter(confirm.planId(), true);
                }
            }
            case SavedEncounterCatalogIntent.CancelOpen cancel -> {
                if (matchesConfirmation(cancel.confirmationRevision(), cancel.planId())) {
                    savedActionEpoch++;
                    savedConfirmation = savedConfirmation.clear();
                    savedActionMessage = "Öffnen abgebrochen.";
                    publish();
                }
            }
        }
    }

    public void acceptWorldReferenceIntent(WorldReferenceCatalogIntent intent) {
        if (intent == null || !acceptsWorldIntent(intent)) {
            return;
        }
        switch (intent) {
            case WorldReferenceCatalogIntent.ChangeNpcQuery change ->
                    npcs.editDraft(new TextCatalogQuery(change.query()));
            case WorldReferenceCatalogIntent.SubmitNpcQuery ignored -> npcs.submit();
            case WorldReferenceCatalogIntent.SelectNpc select -> npcs.select(select.npcId());
            case WorldReferenceCatalogIntent.OpenNpc open -> npcs.find(open.npcId())
                    .ifPresent(row -> npcDefinition.open(row.npcId()));
            case WorldReferenceCatalogIntent.CreateNpc ignored -> npcDefinition.create();
            case WorldReferenceCatalogIntent.AddNpcToEncounter add -> npcs.find(add.npcId())
                    .ifPresent(row -> npcDefinition.addToEncounter(row.npcId()));
            case WorldReferenceCatalogIntent.AddNpcToScene add -> npcs.find(add.npcId())
                    .ifPresent(row -> npcDefinition.addToScene(row.npcId()));
            case WorldReferenceCatalogIntent.ChangeFactionQuery change ->
                    factions.editDraft(new TextCatalogQuery(change.query()));
            case WorldReferenceCatalogIntent.SubmitFactionQuery ignored -> factions.submit();
            case WorldReferenceCatalogIntent.SelectFaction select -> factions.select(select.factionId());
            case WorldReferenceCatalogIntent.OpenFaction open -> factions.find(open.factionId())
                    .ifPresent(row -> factionDefinition.open(row.factionId()));
            case WorldReferenceCatalogIntent.CreateFaction ignored -> factionDefinition.create();
            case WorldReferenceCatalogIntent.UseFactionAsEncounterSource use -> factions.find(use.factionId())
                    .ifPresent(row -> factionDefinition.useAsEncounterSource(row.factionId()));
            case WorldReferenceCatalogIntent.ChangeLocationQuery change ->
                    locations.editDraft(new TextCatalogQuery(change.query()));
            case WorldReferenceCatalogIntent.SubmitLocationQuery ignored -> locations.submit();
            case WorldReferenceCatalogIntent.SelectLocation select -> locations.select(select.locationId());
            case WorldReferenceCatalogIntent.OpenLocation open -> locations.find(open.locationId())
                    .ifPresent(row -> locationDefinition.open(row.locationId()));
            case WorldReferenceCatalogIntent.CreateLocation ignored -> locationDefinition.create();
            case WorldReferenceCatalogIntent.UseLocationAsEncounterSource use -> locations.find(use.locationId())
                    .ifPresent(row -> locationDefinition.useAsEncounterSource(row.locationId()));
            case WorldReferenceCatalogIntent.SetFocusedSceneLocation set -> locations.find(set.locationId())
                    .ifPresent(row -> locationDefinition.setFocusedSceneLocation(row.locationId()));
        }
    }

    public void acceptEncounterTableIntent(EncounterTableCatalogIntent intent) {
        if (intent == null || !isActive(CatalogSectionId.ENCOUNTER_TABLES)) {
            return;
        }
        switch (intent) {
            case EncounterTableCatalogIntent.ChangeQuery change ->
                    encounterTables.editDraft(new TextCatalogQuery(change.query()));
            case EncounterTableCatalogIntent.SubmitQuery ignored -> encounterTables.submit();
            case EncounterTableCatalogIntent.SelectTable select -> encounterTables.select(select.tableId());
            case EncounterTableCatalogIntent.UseAsEncounterSource use -> encounterTables.find(use.tableId())
                    .ifPresent(row -> encounterTableDefinition.useAsEncounterSource(row.tableId()));
        }
    }

    @Override
    public void activate() {
        if (active || closed) {
            return;
        }
        transitioning = true;
        try {
            session(activeSection).activate();
            active = true;
        } finally {
            transitioning = false;
            publish();
        }
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        transitioning = true;
        try {
            session(activeSection).deactivate();
        } finally {
            active = false;
            transitioning = false;
            publish();
        }
    }

    @Override
    public void close() {
        if (closed) {
            return;
        }
        Throwable failure = null;
        transitioning = true;
        try {
            try {
                deactivate();
            } catch (RuntimeException | Error deactivateFailure) {
                failure = deactivateFailure;
            }
            for (CatalogLifecycle session : sessions) {
                try {
                    session.close();
                } catch (RuntimeException | Error closeFailure) {
                    if (failure == null) {
                        failure = closeFailure;
                    } else {
                        failure.addSuppressed(closeFailure);
                    }
                }
            }
        } finally {
            debounceScheduler.shutdownNow();
            active = false;
            closed = true;
            transitioning = false;
            publish();
        }
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
    }

    private void openItem(String sourceKey) {
        if (!isActive(CatalogSectionId.ITEMS) || items.find(sourceKey).isEmpty()) {
            return;
        }
        long epoch = ++itemsActionEpoch;
        itemsActionMessage = "Item-Details werden geladen …";
        publish();
        itemsDefinition.open(sourceKey).whenComplete((message, failure) -> dispatcher.dispatch(() -> {
            if (!isActive(CatalogSectionId.ITEMS) || epoch != itemsActionEpoch
                    || items.find(sourceKey).isEmpty()) {
                return;
            }
            itemsActionMessage = failure == null && message != null
                    ? message : "Item-Details konnten nicht geladen werden.";
            publish();
        }));
    }

    private void openSavedEncounter(long planId, boolean confirmed) {
        Optional<SavedEncounterPlanSummary> plan = savedEncounters.find(planId);
        if (!isActive(CatalogSectionId.SAVED_ENCOUNTERS) || plan.isEmpty()) {
            return;
        }
        long epoch = ++savedActionEpoch;
        savedConfirmation = savedConfirmation.clear();
        savedActionMessage = "Encounter wird geöffnet …";
        publish();
        savedEncounterDefinition.open(planId, confirmed).whenComplete((result, failure) ->
                dispatcher.dispatch(() -> completeOpen(epoch, plan.orElseThrow(), confirmed, result, failure)));
    }

    private void completeOpen(
            long epoch,
            SavedEncounterPlanSummary plan,
            boolean confirmed,
            OpenSavedEncounterPlanResult result,
            Throwable failure
    ) {
        if (!isActive(CatalogSectionId.SAVED_ENCOUNTERS) || epoch != savedActionEpoch
                || savedEncounters.find(plan.planId()).isEmpty()) {
            return;
        }
        if (failure != null || result == null || result.planId() > 0L && result.planId() != plan.planId()) {
            savedActionMessage = "Encounter konnte nicht geöffnet werden.";
        } else if (result.status() == OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED && !confirmed) {
            savedConfirmation = new SavedEncounterCatalogState.Confirmation(
                    savedConfirmation.revision() + 1L, plan.planId(), plan.name(), true);
            savedActionMessage = result.message();
        } else if (result.status() == OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED) {
            savedActionMessage = "Encounter konnte nach Bestätigung nicht geöffnet werden.";
        } else {
            savedActionMessage = result.message();
        }
        publish();
    }

    private boolean matchesConfirmation(long confirmationRevision, long planId) {
        return savedConfirmation.required()
                && savedConfirmation.revision() == confirmationRevision
                && savedConfirmation.planId() == planId;
    }

    private boolean isActive(CatalogSectionId section) {
        return active && !closed && activeSection == section;
    }

    private boolean acceptsWorldIntent(WorldReferenceCatalogIntent intent) {
        CatalogSectionId section;
        if (intent instanceof WorldReferenceCatalogIntent.ChangeNpcQuery
                || intent instanceof WorldReferenceCatalogIntent.SubmitNpcQuery
                || intent instanceof WorldReferenceCatalogIntent.SelectNpc
                || intent instanceof WorldReferenceCatalogIntent.OpenNpc
                || intent instanceof WorldReferenceCatalogIntent.CreateNpc
                || intent instanceof WorldReferenceCatalogIntent.AddNpcToEncounter
                || intent instanceof WorldReferenceCatalogIntent.AddNpcToScene) {
            section = CatalogSectionId.NPCS;
        } else if (intent instanceof WorldReferenceCatalogIntent.ChangeFactionQuery
                || intent instanceof WorldReferenceCatalogIntent.SubmitFactionQuery
                || intent instanceof WorldReferenceCatalogIntent.SelectFaction
                || intent instanceof WorldReferenceCatalogIntent.OpenFaction
                || intent instanceof WorldReferenceCatalogIntent.CreateFaction
                || intent instanceof WorldReferenceCatalogIntent.UseFactionAsEncounterSource) {
            section = CatalogSectionId.FACTIONS;
        } else {
            section = CatalogSectionId.LOCATIONS;
        }
        return isActive(section);
    }

    private <Q, R, K> BrowseSession<Q, R, K> session(CatalogSectionDefinition<Q, R, K> definition) {
        return new BrowseSession<>(definition, dispatcher, debounceScheduler, this::sectionChanged);
    }

    private CatalogLifecycle session(CatalogSectionId section) {
        return switch (section) {
            case MONSTERS -> monsters;
            case ITEMS -> items;
            case SAVED_ENCOUNTERS -> savedEncounters;
            case NPCS -> npcs;
            case FACTIONS -> factions;
            case LOCATIONS -> locations;
            case ENCOUNTER_TABLES -> encounterTables;
        };
    }

    private void sectionChanged() {
        if (!transitioning) {
            publish();
        }
    }

    private void publish() {
        publication.publish(snapshot());
    }

    private CatalogWorkspaceState snapshot() {
        CatalogSectionState<MonsterCatalogQuery, CreatureCatalogRow, Long> monster = monsters.state();
        MonsterCatalogQuery monsterDraft = monster.draft();
        MonsterCatalogState monsterState = new MonsterCatalogState(
                monster.revision(), monsterDraft.filters(), monsterDraft.options(), monsterDraft.sort(),
                monster.pageSize(), monster.pageOffset(), monster.totalCount(),
                monster.selectedKey().orElse(0L), monster.result(),
                monsterDraft.encounterTables(), monsterDraft.factions(), monsterDraft.locations());

        CatalogSectionState<ItemsCatalogQuery, ItemsCatalogApi.ItemRow, String> item = items.state();
        ItemsCatalogState itemState = new ItemsCatalogState(
                item.revision(), item.draft().filters(), item.draft().options(), item.result(),
                item.selectedKey().orElse(""), item.pageSize(), item.pageOffset(), item.totalCount(),
                itemsActionMessage);

        CatalogSectionState<NoCatalogQuery, SavedEncounterPlanSummary, Long> saved = savedEncounters.state();
        SavedEncounterCatalogState savedState = new SavedEncounterCatalogState(
                saved.revision(), saved.result(), saved.selectedKey().orElse(0L),
                savedConfirmation, savedActionMessage);

        CatalogSectionState<TextCatalogQuery, NpcRow, Long> npc = npcs.state();
        CatalogSectionState<TextCatalogQuery, FactionRow, Long> faction = factions.state();
        CatalogSectionState<TextCatalogQuery, LocationRow, Long> location = locations.state();
        WorldReferenceCatalogState worldState = new WorldReferenceCatalogState(
                Math.max(npc.revision(), Math.max(faction.revision(), location.revision())),
                new ReferenceSectionState<>(npc.result(), npc.selectedKey().orElse(0L), npc.draft().text()),
                new ReferenceSectionState<>(
                        faction.result(), faction.selectedKey().orElse(0L), faction.draft().text()),
                new ReferenceSectionState<>(
                        location.result(), location.selectedKey().orElse(0L), location.draft().text()),
                monsterDraft.factions(), monsterDraft.locations());

        CatalogSectionState<TextCatalogQuery, EncounterTableCatalogState.EncounterTableRow, Long> table =
                encounterTables.state();
        EncounterTableCatalogState tableState = new EncounterTableCatalogState(
                table.revision(), table.result(), table.selectedKey().orElse(0L), table.draft().text(),
                monsterDraft.encounterTables());
        return new CatalogWorkspaceState(
                ++revision, activeSection, monsterState, itemState, savedState, worldState, tableState);
    }

    private static final class DebounceThreadFactory implements ThreadFactory {
        @Override public Thread newThread(Runnable task) {
            Thread thread = new Thread(task, "catalog-browse-debounce");
            thread.setDaemon(true);
            return thread;
        }
    }
}
