package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.catalog.application.WorldReferenceCatalogState.FactionRow;
import features.catalog.application.WorldReferenceCatalogState.LocationRow;
import features.catalog.application.WorldReferenceCatalogState.NpcRow;
import features.catalog.application.WorldReferenceCatalogState.ReferenceSectionState;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.ToLongFunction;
import java.util.stream.Collectors;
import platform.ui.UiDispatcher;

/** Owns World Reference projection, stable selection, lifecycle, and semantic handoffs. */
public final class WorldReferenceCatalogController implements CatalogLifecycle {

    private final CreatureReferenceIndexModel creatures;
    private final WorldPlannerSnapshotModel world;
    private final WorldInspectorRoutes inspectors;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final UiDispatcher dispatcher;
    private final Runnable changed;
    private final List<Runnable> unsubscribe = new ArrayList<>();
    private WorldReferenceCatalogState state = WorldReferenceCatalogState.initial();
    private CreatureReferenceIndexResult creatureSnapshot = loadingCreatures();
    private WorldPlannerSnapshot worldSnapshot;
    private List<features.encountertable.api.EncounterTableSummary> encounterTableSnapshot = List.of();

    WorldReferenceCatalogController(
            CreatureReferenceIndexModel creatures,
            WorldPlannerSnapshotModel world,
            WorldInspectorRoutes inspectors,
            EncounterHandoff encounter,
            SceneHandoff scene,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.world = Objects.requireNonNull(world, "world");
        this.inspectors = Objects.requireNonNull(inspectors, "inspectors");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public WorldReferenceCatalogState state() {
        return state;
    }

    public void accept(WorldReferenceCatalogIntent intent) {
        if (intent == null || state.lifecycle() == WorldReferenceCatalogState.Lifecycle.CLOSED) {
            return;
        }
        switch (intent) {
            case WorldReferenceCatalogIntent.ChangeNpcQuery change -> changeNpcQuery(change.query());
            case WorldReferenceCatalogIntent.SelectNpc select -> selectNpc(select.npcId());
            case WorldReferenceCatalogIntent.OpenNpc open -> findNpc(open.npcId())
                    .ifPresent(npc -> inspectors.openNpc(npc.npcId()));
            case WorldReferenceCatalogIntent.CreateNpc ignored -> inspectors.createNpc();
            case WorldReferenceCatalogIntent.AddNpcToEncounter add -> findNpc(add.npcId())
                    .ifPresent(npc -> encounter.addWorldNpc(npc.creatureStatblockId(), npc.npcId()));
            case WorldReferenceCatalogIntent.AddNpcToScene add -> findNpc(add.npcId())
                    .ifPresent(npc -> scene.addNpc(npc.npcId()));
            case WorldReferenceCatalogIntent.ChangeFactionQuery change -> changeFactionQuery(change.query());
            case WorldReferenceCatalogIntent.SelectFaction select -> selectFaction(select.factionId());
            case WorldReferenceCatalogIntent.OpenFaction open -> findFaction(open.factionId())
                    .ifPresent(faction -> inspectors.openFaction(faction.factionId()));
            case WorldReferenceCatalogIntent.CreateFaction ignored -> inspectors.createFaction();
            case WorldReferenceCatalogIntent.UseFactionAsEncounterSource use -> findFaction(use.factionId())
                    .ifPresent(faction -> encounter.useFactionSource(faction.factionId()));
            case WorldReferenceCatalogIntent.ChangeLocationQuery change -> changeLocationQuery(change.query());
            case WorldReferenceCatalogIntent.SelectLocation select -> selectLocation(select.locationId());
            case WorldReferenceCatalogIntent.OpenLocation open -> findLocation(open.locationId())
                    .ifPresent(location -> inspectors.openLocation(location.locationId()));
            case WorldReferenceCatalogIntent.CreateLocation ignored -> inspectors.createLocation();
            case WorldReferenceCatalogIntent.UseLocationAsEncounterSource use -> findLocation(use.locationId())
                    .ifPresent(location -> encounter.useLocationSource(location.locationId()));
            case WorldReferenceCatalogIntent.SetFocusedSceneLocation set -> findLocation(set.locationId())
                    .ifPresent(location -> scene.setLocation(location.locationId()));
        }
    }

    @Override
    public void activate() {
        if (state.lifecycle() != WorldReferenceCatalogState.Lifecycle.INACTIVE) {
            return;
        }
        replace(state.lifecycleRevision() + 1L, WorldReferenceCatalogState.Lifecycle.ACTIVE,
                state.npcs(), state.factions(), state.locations(),
                state.factionOptions(), state.locationOptions());
        long lifecycleRevision = state.lifecycleRevision();
        try {
            unsubscribe.add(creatures.observeLatest(
                    value -> dispatcher.dispatch(() -> applyCreatures(lifecycleRevision, value))));
            unsubscribe.add(world.observeLatest(
                    value -> dispatcher.dispatch(() -> applyWorld(lifecycleRevision, value))));
        } catch (RuntimeException | Error failure) {
            try {
                releaseSubscriptions();
            } catch (RuntimeException | Error cleanupFailure) {
                failure.addSuppressed(cleanupFailure);
            }
            rollbackActivation();
            throw failure;
        }
    }

    @Override
    public void deactivate() {
        if (state.lifecycle() != WorldReferenceCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        try {
            releaseSubscriptions();
        } finally {
            rollbackActivation();
        }
    }

    private void releaseSubscriptions() {
        Throwable failure = null;
        for (int index = unsubscribe.size() - 1; index >= 0; index--) {
            try {
                unsubscribe.get(index).run();
            } catch (RuntimeException | Error cleanupFailure) {
                if (failure == null) {
                    failure = cleanupFailure;
                } else {
                    failure.addSuppressed(cleanupFailure);
                }
            }
        }
        unsubscribe.clear();
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
    }

    private void rollbackActivation() {
        replace(state.lifecycleRevision() + 1L, WorldReferenceCatalogState.Lifecycle.INACTIVE,
                state.npcs(), state.factions(), state.locations(),
                state.factionOptions(), state.locationOptions());
    }

    @Override
    public void close() {
        if (state.lifecycle() == WorldReferenceCatalogState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        replace(state.lifecycleRevision() + 1L, WorldReferenceCatalogState.Lifecycle.CLOSED,
                state.npcs(), state.factions(), state.locations(),
                state.factionOptions(), state.locationOptions());
    }

    /** Accepts the sole Table controller's already accepted provider projection without publishing itself. */
    void acceptEncounterTableLabels(EncounterTableCatalogResult result) {
        encounterTableSnapshot = result != null && result.status() == EncounterTableReadStatus.SUCCESS
                ? result.tables() : List.of();
        if (state.lifecycle() == WorldReferenceCatalogState.Lifecycle.ACTIVE && worldSnapshot != null) {
            rebuildWorldState(worldSnapshot);
        }
    }

    private void applyCreatures(long lifecycleRevision, CreatureReferenceIndexResult value) {
        if (!accepts(lifecycleRevision)) {
            return;
        }
        creatureSnapshot = value == null
                ? new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.STORAGE_ERROR, 0L, List.of())
                : value;
        if (worldSnapshot != null) {
            rebuildWorldState(worldSnapshot);
        } else {
            replaceKeepingLifecycle(state.npcs(), state.factions(), state.locations(),
                    state.factionOptions(), state.locationOptions());
        }
        changed.run();
    }

    private void applyWorld(long lifecycleRevision, WorldPlannerSnapshot value) {
        if (!accepts(lifecycleRevision)) {
            return;
        }
        worldSnapshot = value;
        rebuildWorldState(value);
        changed.run();
    }

    private void rebuildWorldState(WorldPlannerSnapshot snapshot) {
        if (snapshot == null || snapshot.status() != WorldPlannerReadStatus.SUCCESS) {
            String message = snapshot == null ? "" : snapshot.statusText();
            CatalogResultState<NpcRow> npcFailure = CatalogResultState.failed(message);
            CatalogResultState<FactionRow> factionFailure = CatalogResultState.failed(message);
            CatalogResultState<LocationRow> locationFailure = CatalogResultState.failed(message);
            replaceKeepingLifecycle(
                    new ReferenceSectionState<>(npcFailure, state.npcs().selectedId(), state.npcs().query()),
                    new ReferenceSectionState<>(factionFailure, state.factions().selectedId(), state.factions().query()),
                    new ReferenceSectionState<>(locationFailure, state.locations().selectedId(), state.locations().query()),
                    List.of(), List.of());
            return;
        }

        Map<Long, String> creatureNames = new HashMap<>();
        if (creatureSnapshot.status() == CreatureReferenceIndexStatus.SUCCESS) {
            creatureSnapshot.rows().forEach(row -> creatureNames.put(row.id(), row.name()));
        }
        Map<Long, String> factionNames = snapshot.factions().stream()
                .collect(Collectors.toMap(WorldFactionSummary::factionId, WorldFactionSummary::displayName,
                        (first, ignored) -> first));
        Map<Long, String> tableNames = encounterTableSnapshot.stream()
                .collect(Collectors.toMap(features.encountertable.api.EncounterTableSummary::tableId,
                        features.encountertable.api.EncounterTableSummary::name, (first, ignored) -> first));

        List<NpcRow> allNpcs = snapshot.npcs().stream().map(npc -> new NpcRow(
                npc.npcId(), npc.displayName(), npc.creatureStatblockId(),
                reference(creatureNames, npc.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, npc.factionId(), "Keine Fraktion") + " · "
                        + npc.disposition() + " · " + npc.status())).toList();
        List<FactionRow> allFactions = snapshot.factions().stream().map(faction -> new FactionRow(
                faction.factionId(), faction.displayName(),
                reference(tableNames, faction.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + faction.disposition() + " · "
                        + faction.npcIds().size() + " NPCs")).toList();
        List<LocationRow> allLocations = snapshot.locations().stream().map(location -> new LocationRow(
                location.locationId(), location.displayName(),
                joinedReferences(factionNames, location.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, location.encounterTableIds(), "Tabellen"))).toList();

        String statusText = snapshot.statusText();
        ReferenceSectionState<NpcRow> npcs = projected(
                allNpcs, state.npcs(), NpcRow::npcId, statusText,
                row -> row.displayName() + " " + row.details());
        ReferenceSectionState<FactionRow> factions = projected(
                allFactions, state.factions(), FactionRow::factionId, statusText,
                row -> row.displayName() + " " + row.details());
        ReferenceSectionState<LocationRow> locations = projected(
                allLocations, state.locations(), LocationRow::locationId, statusText,
                row -> row.displayName() + " " + row.details());
        List<CatalogReferenceOption> factionOptions = snapshot.factions().stream()
                .map(value -> new CatalogReferenceOption(value.factionId(), value.displayName())).toList();
        List<CatalogReferenceOption> locationOptions = snapshot.locations().stream()
                .map(value -> new CatalogReferenceOption(value.locationId(), value.displayName())).toList();
        replaceKeepingLifecycle(npcs, factions, locations, factionOptions, locationOptions);
    }

    private void changeNpcQuery(String query) {
        String normalized = Objects.requireNonNullElse(query, "");
        if (normalized.equals(state.npcs().query())) {
            return;
        }
        ReferenceSectionState<NpcRow> next = new ReferenceSectionState<>(
                state.npcs().results(), state.npcs().selectedId(), normalized);
        replaceKeepingLifecycle(next, state.factions(), state.locations(),
                state.factionOptions(), state.locationOptions());
        if (worldSnapshot != null) {
            rebuildWorldState(worldSnapshot);
        }
        changed.run();
    }

    private void changeFactionQuery(String query) {
        String normalized = Objects.requireNonNullElse(query, "");
        if (normalized.equals(state.factions().query())) {
            return;
        }
        ReferenceSectionState<FactionRow> next = new ReferenceSectionState<>(
                state.factions().results(), state.factions().selectedId(), normalized);
        replaceKeepingLifecycle(state.npcs(), next, state.locations(),
                state.factionOptions(), state.locationOptions());
        if (worldSnapshot != null) {
            rebuildWorldState(worldSnapshot);
        }
        changed.run();
    }

    private void changeLocationQuery(String query) {
        String normalized = Objects.requireNonNullElse(query, "");
        if (normalized.equals(state.locations().query())) {
            return;
        }
        ReferenceSectionState<LocationRow> next = new ReferenceSectionState<>(
                state.locations().results(), state.locations().selectedId(), normalized);
        replaceKeepingLifecycle(state.npcs(), state.factions(), next,
                state.factionOptions(), state.locationOptions());
        if (worldSnapshot != null) {
            rebuildWorldState(worldSnapshot);
        }
        changed.run();
    }

    private void selectNpc(long id) {
        if (id > 0L && findNpc(id).isEmpty() || id < 0L || id == state.npcs().selectedId()) {
            return;
        }
        replaceKeepingLifecycle(new ReferenceSectionState<>(state.npcs().results(), id, state.npcs().query()),
                state.factions(), state.locations(), state.factionOptions(), state.locationOptions());
        changed.run();
    }

    private void selectFaction(long id) {
        if (id > 0L && findFaction(id).isEmpty() || id < 0L || id == state.factions().selectedId()) {
            return;
        }
        replaceKeepingLifecycle(state.npcs(),
                new ReferenceSectionState<>(state.factions().results(), id, state.factions().query()),
                state.locations(), state.factionOptions(), state.locationOptions());
        changed.run();
    }

    private void selectLocation(long id) {
        if (id > 0L && findLocation(id).isEmpty() || id < 0L || id == state.locations().selectedId()) {
            return;
        }
        replaceKeepingLifecycle(state.npcs(), state.factions(),
                new ReferenceSectionState<>(state.locations().results(), id, state.locations().query()),
                state.factionOptions(), state.locationOptions());
        changed.run();
    }

    private java.util.Optional<WorldNpcSummary> findNpc(long id) {
        return worldSnapshot == null || worldSnapshot.status() != WorldPlannerReadStatus.SUCCESS
                ? java.util.Optional.empty()
                : worldSnapshot.npcs().stream().filter(value -> value.npcId() == id).findFirst();
    }

    private java.util.Optional<WorldFactionSummary> findFaction(long id) {
        return worldSnapshot == null || worldSnapshot.status() != WorldPlannerReadStatus.SUCCESS
                ? java.util.Optional.empty()
                : worldSnapshot.factions().stream().filter(value -> value.factionId() == id).findFirst();
    }

    private java.util.Optional<WorldLocationSummary> findLocation(long id) {
        return worldSnapshot == null || worldSnapshot.status() != WorldPlannerReadStatus.SUCCESS
                ? java.util.Optional.empty()
                : worldSnapshot.locations().stream().filter(value -> value.locationId() == id).findFirst();
    }

    private boolean accepts(long lifecycleRevision) {
        return state.lifecycle() == WorldReferenceCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision;
    }

    private void replaceKeepingLifecycle(
            ReferenceSectionState<NpcRow> npcs,
            ReferenceSectionState<FactionRow> factions,
            ReferenceSectionState<LocationRow> locations,
            List<CatalogReferenceOption> factionOptions,
            List<CatalogReferenceOption> locationOptions
    ) {
        replace(state.lifecycleRevision(), state.lifecycle(), npcs, factions, locations,
                factionOptions, locationOptions);
    }

    private void replace(
            long lifecycleRevision,
            WorldReferenceCatalogState.Lifecycle lifecycle,
            ReferenceSectionState<NpcRow> npcs,
            ReferenceSectionState<FactionRow> factions,
            ReferenceSectionState<LocationRow> locations,
            List<CatalogReferenceOption> factionOptions,
            List<CatalogReferenceOption> locationOptions
    ) {
        state = new WorldReferenceCatalogState(
                state.revision() + 1L, lifecycleRevision, lifecycle, npcs, factions, locations,
                factionOptions, locationOptions);
    }

    private static <Row> ReferenceSectionState<Row> projected(
            List<Row> allRows,
            ReferenceSectionState<Row> previous,
            ToLongFunction<Row> id,
            String message,
            java.util.function.Function<Row, String> searchable
    ) {
        String query = normalized(previous.query());
        List<Row> visible = query.isBlank() ? allRows : allRows.stream()
                .filter(row -> normalized(searchable.apply(row)).contains(query)).toList();
        long selected = allRows.stream().anyMatch(row -> id.applyAsLong(row) == previous.selectedId())
                ? previous.selectedId() : 0L;
        CatalogResultState.Status status = visible.isEmpty()
                ? CatalogResultState.Status.EMPTY : CatalogResultState.Status.READY;
        return new ReferenceSectionState<>(
                new CatalogResultState<>(status, visible, Objects.requireNonNullElse(message, "")),
                selected, previous.query());
    }

    private static String reference(Map<Long, String> labels, long id, String fallback) {
        if (id <= 0L) {
            return fallback;
        }
        String label = labels.get(id);
        return label == null || label.isBlank() ? fallback + " #" + id : label + " (#" + id + ")";
    }

    private static String joinedReferences(Map<Long, String> labels, List<Long> ids, String pluralLabel) {
        if (ids == null || ids.isEmpty()) {
            return "Keine " + pluralLabel;
        }
        return ids.stream().map(id -> reference(labels, id, pluralLabel)).collect(Collectors.joining(", "));
    }

    private static String normalized(String value) {
        return Objects.requireNonNullElse(value, "").trim().toLowerCase(Locale.ROOT);
    }

    private static CreatureReferenceIndexResult loadingCreatures() {
        return new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.LOADING, 0L, List.of());
    }
}
