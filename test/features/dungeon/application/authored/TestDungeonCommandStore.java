package features.dungeon.application.authored;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonContinuationPage;
import features.dungeon.application.authored.port.DungeonEntityChunkExtent;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Revision-aware sparse read double used by authored command/history tests. */
public final class TestDungeonCommandStore implements DungeonCatalogStore, DungeonWindowStore {
    private final Map<Long, DungeonMap> maps = new LinkedHashMap<>();
    private final List<DungeonWindowRequest> windowRequests = new ArrayList<>();
    private final List<DungeonIdentityClosureRequest> closureRequests = new ArrayList<>();
    private final List<DungeonInboundReferenceRequest> inboundRequests = new ArrayList<>();
    private DungeonIdentityClosureResult.Reason nextClosureRejection;

    public TestDungeonCommandStore(DungeonMap map) {
        this(List.of(map));
    }

    public TestDungeonCommandStore(List<DungeonMap> initialMaps) {
        for (DungeonMap map : initialMaps == null ? List.<DungeonMap>of() : initialMaps) {
            maps.put(map.metadata().mapId().value(), map);
        }
    }

    @Override
    public List<DungeonMapHeader> search(String query) {
        return maps.values().stream().map(TestDungeonCommandStore::header).toList();
    }

    @Override
    public DungeonMapHeader create(String mapName) {
        throw new UnsupportedOperationException();
    }

    @Override
    public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
        throw new UnsupportedOperationException();
    }

    @Override
    public void delete(DungeonMapIdentity mapId) {
        throw new UnsupportedOperationException();
    }

    @Override
    public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
        windowRequests.add(request);
        DungeonMap map = maps.get(request.mapId().value());
        if (map == null) {
            return Optional.empty();
        }
        List<DungeonEntitySnapshot> snapshots = snapshots(map);
        List<DungeonEntityChunkExtent> extents = request.chunkKeys().isEmpty()
                ? List.of()
                : snapshots.stream().map(snapshot -> extent(snapshot.ref(), request.chunkKeys().getFirst())).toList();
        return Optional.of(new DungeonWindow(
                header(map),
                request.requestGeneration(),
                request.chunkKeys().stream()
                        .map(key -> new DungeonWindowChunkHeader(key, map.revision()))
                        .toList(),
                List.of(),
                extents,
                List.of(),
                DungeonContinuationPage.empty()));
    }

    @Override
    public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
        closureRequests.add(request);
        if (nextClosureRejection != null) {
            DungeonIdentityClosureResult.Reason reason = nextClosureRejection;
            nextClosureRejection = null;
            return new DungeonIdentityClosureResult.Rejected(reason, request.entityRefs());
        }
        DungeonMap map = maps.get(request.mapId().value());
        if (map == null) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.MAP_MISSING, request.entityRefs());
        }
        if (map.revision() != request.expectedMapRevision()) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.STALE_REVISION, request.entityRefs());
        }
        Map<DungeonPatchEntityRef, DungeonEntitySnapshot> byRef = new LinkedHashMap<>();
        snapshots(map).forEach(snapshot -> byRef.put(snapshot.ref(), snapshot));
        List<DungeonEntitySnapshot> selected = request.entityRefs().stream()
                .map(byRef::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        if (selected.size() != request.entityRefs().size()) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING, request.entityRefs());
        }
        return new DungeonIdentityClosureResult.Complete(header(map), selected);
    }

    @Override
    public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
        inboundRequests.add(request);
        DungeonMap map = maps.get(request.mapId().value());
        if (map == null) {
            return new DungeonInboundReferenceResult.Rejected(
                    DungeonIdentityClosureResult.Reason.MAP_MISSING, request.targetRefs());
        }
        if (map.revision() != request.expectedMapRevision()) {
            return new DungeonInboundReferenceResult.Rejected(
                    DungeonIdentityClosureResult.Reason.STALE_REVISION, request.targetRefs());
        }
        return new DungeonInboundReferenceResult.Complete(header(map), List.of());
    }

    public void apply(DungeonPatch patch) {
        DungeonMap current = maps.get(patch.mapId().value());
        maps.put(patch.mapId().value(), patch.applyTo(current));
    }

    public void apply(DungeonCompoundPatch patch) {
        Map<Long, DungeonMap> candidates = new LinkedHashMap<>();
        for (DungeonPatch mapPatch : patch.patches()) {
            candidates.put(mapPatch.mapId().value(), mapPatch.applyTo(maps.get(mapPatch.mapId().value())));
        }
        maps.putAll(candidates);
    }

    public long revision(long mapId) {
        return maps.get(mapId).revision();
    }

    public int readCount() {
        return windowRequests.size() + closureRequests.size() + inboundRequests.size();
    }

    public List<DungeonIdentityClosureRequest> closureRequests() {
        return List.copyOf(closureRequests);
    }

    public List<DungeonWindowRequest> windowRequests() {
        return List.copyOf(windowRequests);
    }

    public void rejectNextClosure(DungeonIdentityClosureResult.Reason reason) {
        nextClosureRejection = reason;
    }

    private static DungeonMapHeader header(DungeonMap map) {
        return new DungeonMapHeader(map.metadata().mapId(), map.metadata().mapName(), map.revision());
    }

    private static DungeonEntityChunkExtent extent(DungeonPatchEntityRef ref, DungeonChunkKey chunk) {
        return new DungeonEntityChunkExtent(
                ref, chunk,
                chunk.minimumQ(), chunk.minimumR(), chunk.minimumQ(), chunk.minimumR(), 2);
    }

    private static List<DungeonEntitySnapshot> snapshots(DungeonMap map) {
        List<DungeonEntitySnapshot> result = new ArrayList<>();
        map.rooms().rooms().forEach(room -> result.add(new DungeonEntitySnapshot.Room(room)));
        map.topology().roomClusters().forEach(
                cluster -> result.add(new DungeonEntitySnapshot.RoomClusterSnapshot(cluster)));
        map.corridors().forEach(corridor -> result.add(new DungeonEntitySnapshot.CorridorSnapshot(corridor)));
        map.stairs().stairs().forEach(stair -> result.add(new DungeonEntitySnapshot.StairSnapshot(stair)));
        map.transitionCatalog().transitions().forEach(
                transition -> result.add(new DungeonEntitySnapshot.TransitionSnapshot(transition)));
        map.featureMarkers().markers().forEach(
                marker -> result.add(new DungeonEntitySnapshot.FeatureMarkerSnapshot(marker)));
        return List.copyOf(result);
    }
}
