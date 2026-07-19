package features.dungeon.application.travel;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.travel.DungeonTravelAuthoredReadResult.Loaded;
import features.dungeon.application.travel.DungeonTravelAuthoredReadResult.Reason;
import features.dungeon.application.travel.DungeonTravelAuthoredReadResult.Unavailable;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelTransitionTarget;
import features.dungeon.application.travel.projection.TravelWindowProjectionMapper;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Sparse, revision-bound authored reader owned by Dungeon Travel. */
public final class DungeonTravelAuthoredReader {
    private static final int MAX_CATALOG_FIRST_ATTEMPTS = 2;

    private final DungeonCatalogStore catalog;
    private final DungeonWindowStore windows;

    public DungeonTravelAuthoredReader(
            DungeonCatalogStore catalog,
            DungeonWindowStore windows
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.windows = Objects.requireNonNull(windows, "windows");
    }

    public DungeonTravelAuthoredReadResult readCurrentPosition(@Nullable TravelPositionFacts position) {
        if (position == null) {
            return readFirstCatalogMap();
        }
        DungeonMapIdentity mapId = new DungeonMapIdentity(position.mapId());
        return retryStale(() -> readAtCurrentPosition(mapId, position.tile()));
    }

    public DungeonTravelAuthoredReadResult readSelectedMap(long mapId) {
        if (mapId <= 0L) {
            return new Unavailable(Reason.MAP_MISSING);
        }
        DungeonMapIdentity identity = new DungeonMapIdentity(mapId);
        return retryStale(() -> readAtTravelStart(catalog.find(identity)));
    }

    public DungeonTravelAuthoredReadResult readFirstCatalogMap() {
        return retryStale(() -> readAtTravelStart(catalog.first()));
    }

    public DungeonTravelAuthoredReadResult readExactTransitionTarget(TravelTransitionTarget target) {
        if (target == null || !target.isDungeonMapTarget() || !target.hasTransitionId()) {
            return new Unavailable(Reason.TARGET_UNAVAILABLE);
        }
        DungeonMapIdentity mapId = new DungeonMapIdentity(target.mapId());
        return retryStale(() -> readExactTransitionTarget(
                catalog.find(mapId), target.transitionId()));
    }

    private DungeonTravelAuthoredReadResult readAtCurrentPosition(
            DungeonMapIdentity mapId,
            Cell position
    ) {
        Optional<DungeonMapHeader> header = catalog.find(mapId);
        if (header.isEmpty()) {
            return new Unavailable(Reason.MAP_MISSING);
        }
        WindowResult initial = loadWindow(header.get(), position);
        if (initial.result() != null) {
            return initial.result();
        }
        DungeonWindow window = initial.window();
        if (TravelWindowProjectionMapper.containsCell(window, position)) {
            return project(header.get(), window, List.of());
        }
        return readAtTravelStart(header);
    }

    private DungeonTravelAuthoredReadResult readAtTravelStart(Optional<DungeonMapHeader> candidate) {
        if (candidate.isEmpty()) {
            return new Unavailable(Reason.MAP_MISSING);
        }
        DungeonMapHeader header = candidate.get();
        DungeonTravelStartResult start = windows.locateTravelStart(
                new DungeonTravelStartRequest(header.mapId(), header.revision()));
        if (start instanceof DungeonTravelStartResult.Rejected rejected) {
            return unavailable(rejected.reason());
        }
        if (start instanceof DungeonTravelStartResult.Empty empty) {
            if (!sameHeader(header, empty.mapHeader())) {
                return new Unavailable(Reason.STALE_REVISION);
            }
            return new Loaded(TravelWindowProjectionMapper.empty(header));
        }
        DungeonTravelStartResult.Located located = (DungeonTravelStartResult.Located) start;
        if (!sameHeader(header, located.mapHeader())) {
            return new Unavailable(Reason.STALE_REVISION);
        }
        WindowResult loaded = loadWindow(header, located.windowAnchor());
        if (loaded.result() != null) {
            return loaded.result();
        }
        List<DungeonPatchEntityRef> extraRefs = located.transitionId() == null
                ? List.of()
                : List.of(DungeonPatchEntityRef.transition(located.transitionId()));
        return project(header, loaded.window(), extraRefs);
    }

    private DungeonTravelAuthoredReadResult readExactTransitionTarget(
            Optional<DungeonMapHeader> candidate,
            long transitionId
    ) {
        if (candidate.isEmpty()) {
            return new Unavailable(Reason.MAP_MISSING);
        }
        DungeonMapHeader header = candidate.get();
        DungeonPatchEntityRef targetRef = DungeonPatchEntityRef.transition(transitionId);
        ClosureResult targetClosure = loadClosure(header, List.of(targetRef));
        if (targetClosure.result() != null) {
            return targetClosure.result();
        }
        Transition transition = targetTransition(targetClosure.entities(), transitionId);
        if (transition == null || !transition.isPlaced() || transition.anchor().travelCell() == null) {
            return new Unavailable(Reason.TARGET_UNAVAILABLE);
        }
        WindowResult loaded = loadWindow(header, transition.anchor().travelCell());
        if (loaded.result() != null) {
            return loaded.result();
        }
        return project(header, loaded.window(), List.of(targetRef));
    }

    private DungeonTravelAuthoredReadResult project(
            DungeonMapHeader header,
            DungeonWindow window,
            List<DungeonPatchEntityRef> extraRefs
    ) {
        Set<DungeonPatchEntityRef> refs = new LinkedHashSet<>(extraRefs);
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragment instanceof DungeonWindowEntityFragment.Stair
                    || fragment instanceof DungeonWindowEntityFragment.Transition) {
                refs.add(fragment.entityRef());
            }
        }
        ClosureResult closure = loadClosure(header, List.copyOf(refs));
        if (closure.result() != null) {
            return closure.result();
        }
        return new Loaded(TravelWindowProjectionMapper.from(header, window, closure.entities()));
    }

    private WindowResult loadWindow(DungeonMapHeader header, Cell anchor) {
        DungeonTravelChunkKeysResult discovered = windows.discoverTravelChunkKeys(
                new DungeonTravelChunkKeysRequest(
                        header.mapId(),
                        header.revision(),
                        Math.floorDiv(anchor.q(), DungeonChunkKey.CHUNK_SIZE),
                        Math.floorDiv(anchor.r(), DungeonChunkKey.CHUNK_SIZE)));
        if (discovered instanceof DungeonTravelChunkKeysResult.Rejected rejected) {
            return WindowResult.rejected(unavailable(rejected.reason()));
        }
        DungeonTravelChunkKeysResult.Complete complete = (DungeonTravelChunkKeysResult.Complete) discovered;
        if (!sameHeader(header, complete.mapHeader())) {
            return WindowResult.rejected(new Unavailable(Reason.STALE_REVISION));
        }
        Optional<DungeonWindow> loaded = windows.loadWindow(new DungeonWindowRequest(
                header.mapId(),
                header.revision(),
                complete.chunkKeys()));
        if (loaded.isEmpty()) {
            return WindowResult.rejected(new Unavailable(Reason.MAP_MISSING));
        }
        if (!sameHeader(header, loaded.get().mapHeader())) {
            return WindowResult.rejected(new Unavailable(Reason.STALE_REVISION));
        }
        return WindowResult.loaded(loaded.get());
    }

    private ClosureResult loadClosure(
            DungeonMapHeader header,
            List<DungeonPatchEntityRef> refs
    ) {
        DungeonIdentityClosureResult result = windows.loadIdentityClosure(
                new DungeonIdentityClosureRequest(header.mapId(), header.revision(), refs));
        if (result instanceof DungeonIdentityClosureResult.Rejected rejected) {
            return ClosureResult.rejected(unavailable(rejected.reason()));
        }
        DungeonIdentityClosureResult.Complete complete = (DungeonIdentityClosureResult.Complete) result;
        if (!sameHeader(header, complete.mapHeader())) {
            return ClosureResult.rejected(new Unavailable(Reason.STALE_REVISION));
        }
        return ClosureResult.loaded(complete.entities());
    }

    private DungeonTravelAuthoredReadResult retryStale(ReadAttempt attempt) {
        DungeonTravelAuthoredReadResult result = new Unavailable(Reason.STALE_REVISION);
        for (int index = 0; index < MAX_CATALOG_FIRST_ATTEMPTS; index++) {
            result = attempt.read();
            if (!(result instanceof Unavailable unavailable)
                    || unavailable.reason() != Reason.STALE_REVISION) {
                return result;
            }
        }
        return result;
    }

    private static @Nullable Transition targetTransition(
            List<DungeonEntitySnapshot> entities,
            long transitionId
    ) {
        for (DungeonEntitySnapshot entity : entities) {
            if (entity instanceof DungeonEntitySnapshot.TransitionSnapshot transition
                    && transition.value().transitionId() == transitionId) {
                return transition.value();
            }
        }
        return null;
    }

    private static boolean sameHeader(DungeonMapHeader expected, DungeonMapHeader actual) {
        return expected.mapId().equals(actual.mapId()) && expected.revision() == actual.revision();
    }

    private static Unavailable unavailable(DungeonIdentityClosureResult.Reason reason) {
        return new Unavailable(switch (reason) {
            case MAP_MISSING -> Reason.MAP_MISSING;
            case STALE_REVISION -> Reason.STALE_REVISION;
            case ENTITY_MISSING -> Reason.ENTITY_MISSING;
            case MALFORMED_ENTITY -> Reason.MALFORMED_ENTITY;
            case INCOMPLETE_ENTITY -> Reason.INCOMPLETE_ENTITY;
        });
    }

    @FunctionalInterface
    private interface ReadAttempt {
        DungeonTravelAuthoredReadResult read();
    }

    private record WindowResult(
            @Nullable DungeonWindow window,
            @Nullable DungeonTravelAuthoredReadResult result
    ) {
        private static WindowResult loaded(DungeonWindow window) {
            return new WindowResult(window, null);
        }

        private static WindowResult rejected(DungeonTravelAuthoredReadResult result) {
            return new WindowResult(null, result);
        }
    }

    private record ClosureResult(
            List<DungeonEntitySnapshot> entities,
            @Nullable DungeonTravelAuthoredReadResult result
    ) {
        private ClosureResult {
            entities = entities == null ? List.of() : List.copyOf(entities);
        }

        private static ClosureResult loaded(List<DungeonEntitySnapshot> entities) {
            return new ClosureResult(entities, null);
        }

        private static ClosureResult rejected(DungeonTravelAuthoredReadResult result) {
            return new ClosureResult(List.of(), result);
        }
    }
}
