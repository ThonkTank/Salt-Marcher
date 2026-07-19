package features.dungeon.application.authored;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonAuthoredLevelBounds;
import features.dungeon.application.authored.port.DungeonContinuationPage;
import features.dungeon.application.authored.port.DungeonContinuationPageRequest;
import features.dungeon.application.authored.port.DungeonEntityChunkExtent;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowContentSource;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import platform.ui.mapcanvas.WeightedViewportCache;

/** One feature-lifetime, revision-keyed cache shared by every Dungeon window consumer. */
public final class DungeonCachedWindowStore implements DungeonWindowStore {
    static final long MAXIMUM_FACT_WEIGHT = 262_144L;

    private final DungeonWindowContentSource source;
    private final WeightedViewportCache<ChunkVersion, ChunkContent> cache =
            new WeightedViewportCache<>(MAXIMUM_FACT_WEIGHT, ChunkContent::weight);
    private final Map<DungeonChunkKey, ChunkVersion> currentVersions = new LinkedHashMap<>();

    public DungeonCachedWindowStore(DungeonWindowContentSource source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    @Override
    public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
        DungeonWindowRequest safeRequest = Objects.requireNonNull(request, "request");
        Optional<DungeonWindowIndex> indexed = source.loadIndex(safeRequest);
        if (indexed.isEmpty()) {
            return Optional.empty();
        }
        DungeonWindowIndex index = indexed.get();
        if (!sameRequest(safeRequest, index)) {
            return Optional.empty();
        }
        List<ChunkVersion> versions = index.chunkHeaders().stream()
                .map(header -> new ChunkVersion(header.key(), header.contentRevision()))
                .toList();
        remember(versions);
        Map<ChunkVersion, ChunkContent> contents = new LinkedHashMap<>(cache.getAll(versions));
        Map<ChunkVersion, ChunkContent> loadedMisses = new LinkedHashMap<>();
        for (int indexPosition = 0; indexPosition < versions.size(); indexPosition++) {
            ChunkVersion version = versions.get(indexPosition);
            if (contents.containsKey(version)) {
                continue;
            }
            DungeonWindowChunkHeader expectedChunk = index.chunkHeaders().get(indexPosition);
            Optional<DungeonWindow> loaded = source.loadContent(new DungeonWindowContentRequest(
                    index.mapHeader().mapId(), index.mapHeader().revision(), index.requestGeneration(),
                    List.of(expectedChunk)));
            if (loaded.isEmpty() || !validSingleChunk(index, expectedChunk, loaded.get())) {
                return Optional.empty();
            }
            ChunkContent content = ChunkContent.from(loaded.get());
            loadedMisses.put(version, content);
            contents.put(version, content);
        }
        if (!loadedMisses.isEmpty()) {
            Optional<DungeonWindowIndex> confirmed = source.loadIndex(safeRequest);
            if (confirmed.isEmpty() || !sameIndex(index, confirmed.get())) {
                return Optional.empty();
            }
            cache.putAll(loadedMisses);
        }
        return Optional.of(assemble(index, versions, contents));
    }

    @Override
    public Optional<DungeonContinuationPage> loadContinuationPage(DungeonContinuationPageRequest request) {
        return source.loadContinuationPage(Objects.requireNonNull(request, "request"));
    }

    @Override
    public synchronized void protectVisibleChunks(Collection<DungeonChunkKey> chunks) {
        Set<ChunkVersion> protectedVersions = new LinkedHashSet<>();
        for (DungeonChunkKey chunk : chunks == null ? List.<DungeonChunkKey>of() : chunks) {
            ChunkVersion version = currentVersions.get(chunk);
            if (version != null) {
                protectedVersions.add(version);
            }
        }
        cache.replaceProtectedKeys(protectedVersions);
    }

    @Override
    public synchronized Lease protectEditChunks(Collection<DungeonChunkKey> chunks) {
        Set<ChunkVersion> protectedVersions = new LinkedHashSet<>();
        for (DungeonChunkKey chunk : chunks == null ? List.<DungeonChunkKey>of() : chunks) {
            ChunkVersion version = currentVersions.get(chunk);
            if (version != null) {
                protectedVersions.add(version);
            }
        }
        WeightedViewportCache.Lease lease = cache.protect(protectedVersions);
        return lease::close;
    }

    @Override
    public synchronized void invalidateChunks(Collection<DungeonChunkKey> chunks) {
        Set<DungeonChunkKey> identities = Set.copyOf(
                chunks == null ? List.<DungeonChunkKey>of() : chunks);
        cache.invalidateIf(version -> identities.contains(version.key()));
        identities.forEach(currentVersions::remove);
    }

    @Override
    public synchronized void invalidateMap(long mapId) {
        cache.invalidateIf(version -> version.key().mapId() == mapId);
        currentVersions.keySet().removeIf(key -> key.mapId() == mapId);
    }

    @Override
    public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
        return source.loadIdentityClosure(request);
    }

    @Override
    public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
        return source.locateTravelStart(request);
    }

    @Override
    public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
        return source.discoverTravelChunkKeys(request);
    }

    @Override
    public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
        return source.discoverInboundReferences(request);
    }

    private synchronized void remember(List<ChunkVersion> versions) {
        versions.forEach(version -> currentVersions.put(version.key(), version));
    }

    private static boolean sameRequest(DungeonWindowRequest request, DungeonWindowIndex index) {
        return request.mapId().equals(index.mapHeader().mapId())
                && request.requestGeneration() == index.requestGeneration()
                && request.chunkKeys().equals(index.chunkHeaders().stream()
                        .map(DungeonWindowChunkHeader::key).toList());
    }

    private static boolean sameIndex(DungeonWindowIndex left, DungeonWindowIndex right) {
        return left.mapHeader().equals(right.mapHeader())
                && left.requestGeneration() == right.requestGeneration()
                && left.chunkHeaders().equals(right.chunkHeaders())
                && left.authoredBounds().equals(right.authoredBounds())
                && left.continuationPage().equals(right.continuationPage());
    }

    private static boolean validSingleChunk(
            DungeonWindowIndex index,
            DungeonWindowChunkHeader expected,
            DungeonWindow window
    ) {
        return window.mapHeader().equals(index.mapHeader())
                && window.requestGeneration() == index.requestGeneration()
                && window.chunkHeaders().equals(List.of(expected));
    }

    private static DungeonWindow assemble(
            DungeonWindowIndex index,
            List<ChunkVersion> versions,
            Map<ChunkVersion, ChunkContent> contents
    ) {
        Map<DungeonPatchEntityRef, DungeonWindowEntityFragment> fragments = new LinkedHashMap<>();
        List<DungeonEntityChunkExtent> extents = new ArrayList<>();
        for (ChunkVersion version : versions) {
            ChunkContent content = Objects.requireNonNull(contents.get(version), "indexed chunk content");
            for (DungeonWindowEntityFragment fragment : content.fragments()) {
                fragments.merge(fragment.entityRef(), fragment, DungeonCachedWindowStore::merge);
            }
            extents.addAll(content.entityExtents());
        }
        return new DungeonWindow(index.mapHeader(), index.requestGeneration(), index.chunkHeaders(),
                List.copyOf(fragments.values()), extents, index.authoredBounds(), index.continuationPage());
    }

    private static DungeonWindowEntityFragment merge(
            DungeonWindowEntityFragment left,
            DungeonWindowEntityFragment right
    ) {
        if (!left.entityRef().equals(right.entityRef()) || left.getClass() != right.getClass()) {
            throw new IllegalStateException("incompatible cached Dungeon fragments");
        }
        List<DungeonChunkKey> chunks = union(left.intersectingRequestedChunks(), right.intersectingRequestedChunks());
        List<DungeonPatchEntityRef> dependencies = union(left.dependencyHeaders(), right.dependencyHeaders());
        if (left instanceof DungeonWindowEntityFragment.Room a
                && right instanceof DungeonWindowEntityFragment.Room b) {
            requireEqual(a.clusterId(), b.clusterId()); requireEqual(a.name(), b.name());
            requireEqual(a.visualDescription(), b.visualDescription());
            return new DungeonWindowEntityFragment.Room(a.entityRef(), a.clusterId(), a.name(),
                    a.visualDescription(), union(a.floorCells(), b.floorCells()),
                    union(a.exitDescriptions(), b.exitDescriptions()), chunks, dependencies);
        }
        if (left instanceof DungeonWindowEntityFragment.RoomCluster a
                && right instanceof DungeonWindowEntityFragment.RoomCluster b) {
            requireEqual(a.name(), b.name());
            return new DungeonWindowEntityFragment.RoomCluster(a.entityRef(), a.name(),
                    union(a.memberCells(), b.memberCells()), union(a.boundaries(), b.boundaries()),
                    chunks, dependencies);
        }
        if (left instanceof DungeonWindowEntityFragment.Corridor a
                && right instanceof DungeonWindowEntityFragment.Corridor b) {
            requireEqual(a.level(), b.level()); requireEqual(a.roomIds(), b.roomIds());
            return new DungeonWindowEntityFragment.Corridor(a.entityRef(), a.level(), a.roomIds(),
                    union(a.waypoints(), b.waypoints()), union(a.doorBindings(), b.doorBindings()),
                    union(a.anchorBindings(), b.anchorBindings()), union(a.anchorRefs(), b.anchorRefs()),
                    union(a.routeCells(), b.routeCells()), chunks, dependencies);
        }
        if (left instanceof DungeonWindowEntityFragment.Stair a
                && right instanceof DungeonWindowEntityFragment.Stair b) {
            requireEqual(a.name(), b.name()); requireEqual(a.shape(), b.shape());
            requireEqual(a.direction(), b.direction()); requireEqual(a.dimension1(), b.dimension1());
            requireEqual(a.dimension2(), b.dimension2()); requireEqual(a.corridorId(), b.corridorId());
            return new DungeonWindowEntityFragment.Stair(a.entityRef(), a.name(), a.shape(), a.direction(),
                    a.dimension1(), a.dimension2(), a.corridorId(), union(a.path(), b.path()),
                    union(a.exits(), b.exits()), chunks, dependencies);
        }
        if (left instanceof DungeonWindowEntityFragment.Transition a
                && right instanceof DungeonWindowEntityFragment.Transition b) {
            requireEqual(a.description(), b.description()); requireEqual(a.anchor(), b.anchor());
            requireEqual(a.destination(), b.destination()); requireEqual(a.linkedTransitionId(), b.linkedTransitionId());
            return new DungeonWindowEntityFragment.Transition(a.entityRef(), a.description(), a.anchor(),
                    a.destination(), a.linkedTransitionId(), chunks, dependencies);
        }
        if (left instanceof DungeonWindowEntityFragment.FeatureMarker a
                && right instanceof DungeonWindowEntityFragment.FeatureMarker b) {
            requireEqual(a.kind(), b.kind()); requireEqual(a.anchor(), b.anchor());
            requireEqual(a.label(), b.label()); requireEqual(a.description(), b.description());
            return new DungeonWindowEntityFragment.FeatureMarker(a.entityRef(), a.kind(), a.anchor(),
                    a.label(), a.description(), chunks, dependencies);
        }
        throw new IllegalStateException("unsupported cached Dungeon fragment");
    }

    private static <T> List<T> union(Collection<T> left, Collection<T> right) {
        LinkedHashSet<T> values = new LinkedHashSet<>(left);
        values.addAll(right);
        return List.copyOf(values);
    }

    private static void requireEqual(Object left, Object right) {
        if (!Objects.equals(left, right)) {
            throw new IllegalStateException("cached Dungeon fragment metadata changed without revision change");
        }
    }

    private record ChunkVersion(DungeonChunkKey key, long contentRevision) {
        private ChunkVersion {
            key = Objects.requireNonNull(key, "key");
            if (contentRevision < 0L) {
                throw new IllegalArgumentException("content revision must not be negative");
            }
        }
    }

    private record ChunkContent(
            DungeonWindowChunkHeader header,
            List<DungeonWindowEntityFragment> fragments,
            List<DungeonEntityChunkExtent> entityExtents
    ) {
        private ChunkContent {
            header = Objects.requireNonNull(header, "header");
            fragments = List.copyOf(fragments);
            entityExtents = List.copyOf(entityExtents);
        }

        static ChunkContent from(DungeonWindow window) {
            return new ChunkContent(window.chunkHeaders().get(0), window.fragments(), window.entityExtents());
        }

        long weight() {
            long result = 1L;
            for (DungeonWindowEntityFragment fragment : fragments) {
                result = add(result, atomicFactCount(fragment));
                result = add(result, fragment.dependencyHeaders().size());
                result = add(result, fragment.intersectingRequestedChunks().size());
            }
            result = add(result, entityExtents.size());
            return result;
        }

        private static long atomicFactCount(DungeonWindowEntityFragment fragment) {
            if (fragment instanceof DungeonWindowEntityFragment.Room value) {
                return value.floorCells().size() + value.exitDescriptions().size();
            }
            if (fragment instanceof DungeonWindowEntityFragment.RoomCluster value) {
                return value.memberCells().size() + value.boundaries().size();
            }
            if (fragment instanceof DungeonWindowEntityFragment.Corridor value) {
                return value.roomIds().size() + value.waypoints().size() + value.doorBindings().size()
                        + value.anchorBindings().size() + value.anchorRefs().size() + value.routeCells().size();
            }
            if (fragment instanceof DungeonWindowEntityFragment.Stair value) {
                return value.path().size() + value.exits().size();
            }
            return 1L;
        }

        private static long add(long left, long right) {
            return Long.MAX_VALUE - left < right ? Long.MAX_VALUE : left + right;
        }
    }
}
