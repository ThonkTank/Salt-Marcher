package features.catalog.application;

import features.creatures.api.CreatureCatalogRow;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanSummary;
import features.items.api.ItemsCatalogApi;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Supplier;
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
    private final BrowseSession<TextCatalogQuery, NpcCatalogRow, Long> npcs;
    private final BrowseSession<TextCatalogQuery, FactionCatalogRow, Long> factions;
    private final BrowseSession<TextCatalogQuery, LocationCatalogRow, Long> locations;
    private final BrowseSession<TextCatalogQuery, EncounterTableCatalogRow, Long> encounterTables;
    private final Map<CatalogSectionId, SectionRuntime> sections;
    private final CatalogWorkspacePublication publication;
    private CatalogSectionId activeSection = CatalogSectionId.MONSTERS;
    private CatalogConfirmation<Long> savedConfirmation = CatalogConfirmation.none();
    private String monsterActionMessage = "";
    private String savedActionMessage = "";
    private String itemsActionMessage = "";
    private String encounterTableActionMessage = "";
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
        EnumMap<CatalogSectionId, SectionRuntime> runtimes = new EnumMap<>(CatalogSectionId.class);
        add(runtimes, runtime(monsterDefinition, monsters,
                () -> commands(CatalogSectionId.MONSTERS, monsters, this::monsterAction,
                        action -> unavailableCreate(CatalogSectionId.MONSTERS, action),
                        ignored -> { }, ignored -> { }, () -> { }),
                () -> monsterActionMessage, CatalogConfirmation::none));
        add(runtimes, runtime(itemsDefinition, items,
                () -> commands(CatalogSectionId.ITEMS, items, this::itemAction,
                        action -> unavailableCreate(CatalogSectionId.ITEMS, action),
                        ignored -> { }, ignored -> { }, this::itemSelectionChanged),
                () -> itemsActionMessage, CatalogConfirmation::none));
        add(runtimes, runtime(savedEncounterDefinition, savedEncounters,
                () -> commands(CatalogSectionId.SAVED_ENCOUNTERS, savedEncounters,
                        this::savedEncounterAction,
                        action -> unavailableCreate(CatalogSectionId.SAVED_ENCOUNTERS, action),
                        this::confirmSavedEncounter,
                        this::cancelSavedEncounter, this::savedEncounterSelectionChanged),
                () -> savedActionMessage, () -> savedConfirmation));
        add(runtimes, runtime(npcDefinition, npcs,
                () -> commands(CatalogSectionId.NPCS, npcs, this::npcAction, this::npcSectionAction,
                        ignored -> { }, ignored -> { }, () -> { }),
                () -> "", CatalogConfirmation::none));
        add(runtimes, runtime(factionDefinition, factions,
                () -> commands(CatalogSectionId.FACTIONS, factions, this::factionAction,
                        this::factionSectionAction, ignored -> { }, ignored -> { }, () -> { }),
                () -> "", CatalogConfirmation::none));
        add(runtimes, runtime(locationDefinition, locations,
                () -> commands(CatalogSectionId.LOCATIONS, locations, this::locationAction,
                        this::locationSectionAction, ignored -> { }, ignored -> { }, () -> { }),
                () -> "", CatalogConfirmation::none));
        add(runtimes, runtime(encounterTableDefinition, encounterTables,
                () -> commands(CatalogSectionId.ENCOUNTER_TABLES, encounterTables,
                        this::encounterTableAction,
                        action -> unavailableCreate(CatalogSectionId.ENCOUNTER_TABLES, action),
                        ignored -> { }, ignored -> { }, () -> { }),
                () -> encounterTableActionMessage, CatalogConfirmation::none));
        sections = Map.copyOf(runtimes);
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
            for (CatalogLifecycle session : sections.values()) {
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

    private void monsterAction(CatalogActionId action, Long key) {
        monsters.find(key).ifPresent(row -> {
            switch (action) {
                case OPEN -> monsterDefinition.open(row.id());
                case ADD_TO_ENCOUNTER -> monsterDefinition.addToEncounter(row.id());
                case ADD_TO_SCENE -> monsterDefinition.addToScene(row.id());
                default -> { }
            }
        });
    }

    private void itemAction(CatalogActionId action, String key) {
        if (action == CatalogActionId.OPEN) {
            openItem(key);
        }
    }

    private void itemSelectionChanged() {
        itemsActionEpoch++;
        itemsActionMessage = "";
        publish();
    }

    private void savedEncounterAction(CatalogActionId action, Long key) {
        if (action == CatalogActionId.OPEN) {
            openSavedEncounter(key, false);
        }
    }

    private void savedEncounterSelectionChanged() {
        savedActionEpoch++;
        savedConfirmation = savedConfirmation.clear();
        savedActionMessage = "";
        publish();
    }

    private void confirmSavedEncounter(CatalogConfirmation<Long> confirmation) {
        if (matchesConfirmation(confirmation)) {
            confirmation.key().ifPresent(key -> openSavedEncounter(key, true));
        }
    }

    private void cancelSavedEncounter(CatalogConfirmation<Long> confirmation) {
        if (matchesConfirmation(confirmation)) {
            savedActionEpoch++;
            savedConfirmation = savedConfirmation.clear();
            savedActionMessage = "Öffnen abgebrochen.";
            publish();
        }
    }

    private void npcAction(CatalogActionId action, Long key) {
        npcs.find(key).ifPresent(row -> {
            switch (action) {
                case OPEN -> npcDefinition.open(row.npcId());
                case ADD_TO_ENCOUNTER -> npcDefinition.addToEncounter(row.npcId());
                case ADD_TO_SCENE -> npcDefinition.addToScene(row.npcId());
                default -> { }
            }
        });
    }

    private void npcSectionAction(CatalogActionId action) {
        if (action == CatalogActionId.CREATE) {
            npcDefinition.create();
        }
    }

    private void factionAction(CatalogActionId action, Long key) {
        factions.find(key).ifPresent(row -> {
            if (action == CatalogActionId.OPEN) {
                factionDefinition.open(row.factionId());
            } else if (action == CatalogActionId.USE_AS_ENCOUNTER_SOURCE) {
                factionDefinition.useAsEncounterSource(row.factionId());
            }
        });
    }

    private void factionSectionAction(CatalogActionId action) {
        if (action == CatalogActionId.CREATE) {
            factionDefinition.create();
        }
    }

    private void locationAction(CatalogActionId action, Long key) {
        locations.find(key).ifPresent(row -> {
            switch (action) {
                case OPEN -> locationDefinition.open(row.locationId());
                case USE_AS_ENCOUNTER_SOURCE -> locationDefinition.useAsEncounterSource(row.locationId());
                case SET_FOCUSED_SCENE_LOCATION -> locationDefinition.setFocusedSceneLocation(row.locationId());
                default -> { }
            }
        });
    }

    private void locationSectionAction(CatalogActionId action) {
        if (action == CatalogActionId.CREATE) {
            locationDefinition.create();
        }
    }

    private void encounterTableAction(CatalogActionId action, Long key) {
        if (action == CatalogActionId.USE_AS_ENCOUNTER_SOURCE) {
            encounterTables.find(key).ifPresent(row ->
                    encounterTableDefinition.useAsEncounterSource(row.tableId()));
        }
    }

    private void unavailableCreate(CatalogSectionId section, CatalogActionId action) {
        if (action != CatalogActionId.CREATE) {
            return;
        }
        String message = "Erstellen ist für " + section.label() + " noch nicht verfügbar.";
        switch (section) {
            case MONSTERS -> monsterActionMessage = message;
            case ITEMS -> itemsActionMessage = message;
            case SAVED_ENCOUNTERS -> savedActionMessage = message;
            case ENCOUNTER_TABLES -> encounterTableActionMessage = message;
            default -> throw new IllegalArgumentException("Create route is available for " + section);
        }
        publish();
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
            savedConfirmation = new CatalogConfirmation<>(
                    savedConfirmation.revision() + 1L, Optional.of(plan.planId()), plan.name(), true);
            savedActionMessage = result.message();
        } else if (result.status() == OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED) {
            savedActionMessage = "Encounter konnte nach Bestätigung nicht geöffnet werden.";
        } else {
            savedActionMessage = result.message();
        }
        publish();
    }

    private boolean matchesConfirmation(CatalogConfirmation<Long> confirmation) {
        return savedConfirmation.required() && savedConfirmation.equals(confirmation);
    }

    private boolean isActive(CatalogSectionId section) {
        return active && !closed && activeSection == section;
    }

    private <Q, R, K> BrowseSession<Q, R, K> session(CatalogSectionDefinition<Q, R, K> definition) {
        return new BrowseSession<>(definition, dispatcher, debounceScheduler, this::sectionChanged);
    }

    private <Q, R, K> CatalogSectionCommands<Q, K> commands(
            CatalogSectionId id,
            BrowseSession<Q, R, K> session,
            BiConsumer<CatalogActionId, K> rowAction,
            Consumer<CatalogActionId> sectionAction,
            Consumer<CatalogConfirmation<K>> confirm,
            Consumer<CatalogConfirmation<K>> cancel,
            Runnable selectionChanged
    ) {
        return new CatalogSectionCommands<>(
                draft -> runActive(id, () -> session.editDraft(draft)),
                draft -> runActive(id, () -> session.commitDraft(draft)),
                () -> runActive(id, session::submit),
                sortOrder -> runActive(id, () -> session.sort(sortOrder)),
                direction -> runActive(id, () -> session.shiftPage(direction)),
                key -> runActive(id, () -> {
                    session.select(key.orElse(null));
                    selectionChanged.run();
                }),
                (action, key) -> runActive(id, () -> rowAction.accept(action, key)),
                action -> runActive(id, () -> sectionAction.accept(action)),
                confirmation -> runActive(id, () -> confirm.accept(confirmation)),
                confirmation -> runActive(id, () -> cancel.accept(confirmation)));
    }

    private void runActive(CatalogSectionId section, Runnable command) {
        if (isActive(section)) {
            Objects.requireNonNull(command, "command").run();
        }
    }

    private <Q, R, K> SectionRuntime runtime(
            CatalogSectionDefinition<Q, R, K> definition,
            BrowseSession<Q, R, K> session,
            Supplier<CatalogSectionCommands<Q, K>> commands,
            Supplier<String> actionMessage,
            Supplier<CatalogConfirmation<K>> confirmation
    ) {
        return new TypedSectionRuntime<>(definition, session, commands, actionMessage, confirmation);
    }

    private static void add(Map<CatalogSectionId, SectionRuntime> sections, SectionRuntime runtime) {
        CatalogSectionId id = runtime.snapshot().id();
        if (sections.put(id, runtime) != null) {
            throw new IllegalArgumentException("Duplicate Catalog section runtime: " + id);
        }
    }

    private CatalogLifecycle session(CatalogSectionId section) {
        return sections.get(Objects.requireNonNull(section, "section"));
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
        return new CatalogWorkspaceState(++revision, sections.get(activeSection).snapshot());
    }

    private interface SectionRuntime extends CatalogLifecycle {
        CatalogActiveSection snapshot();
    }

    private static final class TypedSectionRuntime<Q, R, K> implements SectionRuntime {
        private final CatalogSectionDefinition<Q, R, K> definition;
        private final BrowseSession<Q, R, K> session;
        private final Supplier<CatalogSectionCommands<Q, K>> commands;
        private final Supplier<String> actionMessage;
        private final Supplier<CatalogConfirmation<K>> confirmation;

        private TypedSectionRuntime(
                CatalogSectionDefinition<Q, R, K> definition,
                BrowseSession<Q, R, K> session,
                Supplier<CatalogSectionCommands<Q, K>> commands,
                Supplier<String> actionMessage,
                Supplier<CatalogConfirmation<K>> confirmation
        ) {
            this.definition = Objects.requireNonNull(definition, "definition");
            this.session = Objects.requireNonNull(session, "session");
            this.commands = Objects.requireNonNull(commands, "commands");
            this.actionMessage = Objects.requireNonNull(actionMessage, "actionMessage");
            this.confirmation = Objects.requireNonNull(confirmation, "confirmation");
        }

        @Override public CatalogActiveSection snapshot() {
            return CatalogActiveSection.of(new CatalogSectionBinding<>(
                    definition, session.state(), commands.get(), actionMessage.get(), confirmation.get()));
        }

        @Override public void activate() {
            session.activate();
        }

        @Override public void deactivate() {
            session.deactivate();
        }

        @Override public void close() {
            session.close();
        }
    }

    private static final class DebounceThreadFactory implements ThreadFactory {
        @Override public Thread newThread(Runnable task) {
            Thread thread = new Thread(task, "catalog-browse-debounce");
            thread.setDaemon(true);
            return thread;
        }
    }
}
