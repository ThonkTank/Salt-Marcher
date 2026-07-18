package features.catalog.application;

import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexModel;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class WorldReferenceCatalogController implements CatalogLifecycle {

    private final CreatureReferenceIndexModel creatures;
    private final WorldPlannerSnapshotModel world;
    private final Runnable changed;
    private final List<Runnable> unsubscribe = new ArrayList<>();
    private WorldReferenceCatalogState state = WorldReferenceCatalogState.initial();
    private boolean active;
    private long lifecycleEpoch;

    WorldReferenceCatalogController(
            CreatureReferenceIndexModel creatures,
            WorldPlannerSnapshotModel world,
            Runnable changed
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.world = Objects.requireNonNull(world, "world");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public WorldReferenceCatalogState state() {
        return state;
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
        long epoch = ++lifecycleEpoch;
        unsubscribe.add(CurrentFirstSubscription.open(
                creatures::current, creatures::subscribe, value -> {
                    if (active && lifecycleEpoch == epoch) {
                        applyCreatures(value);
                    }
                }));
        unsubscribe.add(CurrentFirstSubscription.open(
                world::current, world::subscribe, value -> {
                    if (active && lifecycleEpoch == epoch) {
                        applyWorld(value);
                    }
                }));
    }

    private void applyCreatures(CreatureReferenceIndexResult creatures) {
        state = new WorldReferenceCatalogState(
                state.npcs(), state.factions(), state.locations(), Objects.requireNonNull(creatures, "creatures"));
        changed.run();
    }

    private void applyWorld(WorldPlannerSnapshot world) {
        boolean success = world.status() == WorldPlannerReadStatus.SUCCESS;
        state = new WorldReferenceCatalogState(
                section(success, world.npcs(), world.statusText(), state.npcs()),
                section(success, world.factions(), world.statusText(), state.factions()),
                section(success, world.locations(), world.statusText(), state.locations()),
                state.creatures());
        changed.run();
    }

    private static <T> WorldReferenceCatalogState.ReferenceSectionState<T> section(
            boolean success,
            List<T> rows,
            String message,
            WorldReferenceCatalogState.ReferenceSectionState<T> previous
    ) {
        CatalogResultState<T> result = success
                ? CatalogResultState.ready(rows)
                : new CatalogResultState<>(CatalogResultState.Status.FAILED, List.of(), message);
        return new WorldReferenceCatalogState.ReferenceSectionState<>(
                result, previous.selectedId(), previous.query());
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        lifecycleEpoch++;
        unsubscribe.forEach(Runnable::run);
        unsubscribe.clear();
    }

    @Override
    public void close() {
        deactivate();
    }
}
