package features.dungeon.application.authored;

import features.dungeon.api.DungeonAreaSnapshot;
import features.dungeon.api.DungeonBoundarySnapshot;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonFeatureSnapshot;
import features.dungeon.api.DungeonMapSnapshot;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.DungeonViewportSnapshot;
import features.dungeon.api.DungeonViewportContinuation;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import platform.ui.mapcanvas.WeightedViewportCache;

/** Partitions immutable authored projections into revision-scoped sparse chunks. */
final class DungeonViewportProjection {
    private static final long MAXIMUM_CACHE_WEIGHT = 256L * 1024L * 1024L;
    private final WeightedViewportCache<ChunkRevisionKey, ChunkProjection> cache =
            new WeightedViewportCache<>(MAXIMUM_CACHE_WEIGHT, ChunkProjection::estimatedBytes);

    DungeonViewportSnapshot project(
            DungeonViewportRequest request,
            long mapRevision,
            DungeonMapSnapshot map
    ) {
        DungeonViewportRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        Set<DungeonChunkKey> requestedChunks = safeRequest.loadingChunks();
        Set<ChunkRevisionKey> protectedKeys = requestedChunks.stream()
                .map(chunk -> new ChunkRevisionKey(chunk, mapRevision))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        List<ChunkProjection> chunks = new ArrayList<>();
        for (DungeonChunkKey chunk : requestedChunks) {
            ChunkRevisionKey cacheKey = new ChunkRevisionKey(chunk, mapRevision);
            ChunkProjection projection = cache.get(cacheKey);
            if (projection == null) {
                projection = ChunkProjection.from(safeMap, chunk);
                cache.put(cacheKey, projection, protectedKeys);
            }
            if (!projection.empty()) {
                chunks.add(projection);
            }
        }
        return merge(safeRequest, mapRevision, safeMap, chunks);
    }

    private static DungeonViewportSnapshot merge(
            DungeonViewportRequest request,
            long mapRevision,
            DungeonMapSnapshot map,
            List<ChunkProjection> chunks
    ) {
        Set<DungeonChunkKey> loadedChunks = new LinkedHashSet<>();
        Map<AreaKey, DungeonAreaSnapshot> areas = new LinkedHashMap<>();
        Set<DungeonBoundarySnapshot> boundaries = new LinkedHashSet<>();
        Map<FeatureKey, DungeonFeatureSnapshot> features = new LinkedHashMap<>();
        Set<DungeonEditorHandleSnapshot> handles = new LinkedHashSet<>();
        for (ChunkProjection chunk : chunks) {
            loadedChunks.add(chunk.key());
            for (DungeonAreaSnapshot area : chunk.areas()) {
                areas.merge(new AreaKey(area.kind().name(), area.id()), area, DungeonViewportProjection::mergeArea);
            }
            boundaries.addAll(chunk.boundaries());
            for (DungeonFeatureSnapshot feature : chunk.features()) {
                features.merge(
                        new FeatureKey(feature.kind().name(), feature.id()),
                        feature,
                        DungeonViewportProjection::mergeFeature);
            }
            handles.addAll(chunk.handles());
        }
        return new DungeonViewportSnapshot(
                request.mapId(),
                mapRevision,
                request.requestGeneration(),
                request.level(),
                map.topology(),
                loadedChunks,
                List.copyOf(areas.values()),
                List.copyOf(boundaries),
                List.copyOf(features.values()),
                List.copyOf(handles),
                continuations(map, request, loadedChunks),
                authoredBounds(map, request.level()));
    }

    private static List<DungeonViewportContinuation> continuations(
            DungeonMapSnapshot map,
            DungeonViewportRequest request,
            Set<DungeonChunkKey> loadedChunks
    ) {
        Set<DungeonViewportContinuation> result = new LinkedHashSet<>();
        for (DungeonAreaSnapshot area : map.areas()) {
            addContinuations(
                    result,
                    area.kind().name(),
                    area.id(),
                    area.topologyRef(),
                    area.cells(),
                    request,
                    loadedChunks);
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            addContinuations(
                    result,
                    feature.kind().name(),
                    feature.id(),
                    feature.topologyRef(),
                    feature.cells(),
                    request,
                    loadedChunks);
        }
        for (DungeonBoundarySnapshot boundary : map.boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (edge != null) {
                List<DungeonCellRef> edgeCells = new ArrayList<>();
                if (edge.from() != null) {
                    edgeCells.add(edge.from());
                }
                if (edge.to() != null) {
                    edgeCells.add(edge.to());
                }
                addContinuations(
                        result,
                        boundary.kind(),
                        boundary.id(),
                        boundary.topologyRef(),
                        edgeCells,
                        request,
                        loadedChunks);
            }
        }
        return List.copyOf(result);
    }

    private static void addContinuations(
            Set<DungeonViewportContinuation> result,
            String kind,
            long id,
            features.dungeon.api.DungeonTopologyElementRef topologyRef,
            List<DungeonCellRef> cells,
            DungeonViewportRequest request,
            Set<DungeonChunkKey> loadedChunks
    ) {
        Set<DungeonChunkKey> elementChunks = new LinkedHashSet<>();
        for (DungeonCellRef cell : cells) {
            if (cell != null && cell.level() == request.level()) {
                elementChunks.add(DungeonChunkKey.containing(request.mapId(), cell));
            }
        }
        boolean intersectsLoaded = elementChunks.stream().anyMatch(loadedChunks::contains);
        if (!intersectsLoaded) {
            return;
        }
        for (DungeonChunkKey chunk : elementChunks) {
            if (!request.loadingChunks().contains(chunk)) {
                result.add(new DungeonViewportContinuation(kind, id, topologyRef, chunk));
            }
        }
    }

    private static DungeonAreaSnapshot mergeArea(DungeonAreaSnapshot first, DungeonAreaSnapshot second) {
        Set<DungeonCellRef> cells = new LinkedHashSet<>(first.cells());
        cells.addAll(second.cells());
        return new DungeonAreaSnapshot(
                first.kind(), first.id(), first.clusterId(), first.label(), List.copyOf(cells), first.topologyRef());
    }

    private static DungeonFeatureSnapshot mergeFeature(
            DungeonFeatureSnapshot first,
            DungeonFeatureSnapshot second
    ) {
        Set<DungeonCellRef> cells = new LinkedHashSet<>(first.cells());
        cells.addAll(second.cells());
        return new DungeonFeatureSnapshot(
                first.kind(),
                first.id(),
                first.label(),
                List.copyOf(cells),
                first.description(),
                first.destinationLabel(),
                first.topologyRef(),
                first.anchorEdge() == null ? second.anchorEdge() : first.anchorEdge());
    }

    private static DungeonViewportSnapshot.AuthoredBounds authoredBounds(DungeonMapSnapshot map, int level) {
        BoundsAccumulator bounds = new BoundsAccumulator();
        map.areas().forEach(area -> area.cells().forEach(cell -> bounds.include(cell, level)));
        map.boundaries().forEach(boundary -> bounds.include(boundary.edge(), level));
        map.features().forEach(feature -> {
            feature.cells().forEach(cell -> bounds.include(cell, level));
            bounds.include(feature.anchorEdge(), level);
        });
        map.editorHandles().forEach(handle -> bounds.include(handle.cell(), level));
        return bounds.snapshot();
    }

    private record ChunkRevisionKey(DungeonChunkKey chunk, long revision) {
    }

    private record AreaKey(String kind, long id) {
    }

    private record FeatureKey(String kind, long id) {
    }

    private record ChunkProjection(
            DungeonChunkKey key,
            List<DungeonAreaSnapshot> areas,
            List<DungeonBoundarySnapshot> boundaries,
            List<DungeonFeatureSnapshot> features,
            List<DungeonEditorHandleSnapshot> handles
    ) {
        static ChunkProjection from(DungeonMapSnapshot map, DungeonChunkKey key) {
            return new ChunkProjection(
                    key,
                    map.areas().stream().map(area -> areaInChunk(area, key)).filter(Objects::nonNull).toList(),
                    map.boundaries().stream().filter(boundary -> edgeTouchesChunk(boundary.edge(), key)).toList(),
                    map.features().stream().map(feature -> featureInChunk(feature, key)).filter(Objects::nonNull).toList(),
                    map.editorHandles().stream().filter(handle -> inChunk(handle.cell(), key)).toList());
        }

        boolean empty() {
            return areas.isEmpty() && boundaries.isEmpty() && features.isEmpty() && handles.isEmpty();
        }

        long estimatedBytes() {
            long cellCount = areas.stream().mapToLong(area -> area.cells().size()).sum()
                    + features.stream().mapToLong(feature -> feature.cells().size()).sum();
            return 256L + cellCount * 48L + boundaries.size() * 192L
                    + handles.size() * 256L + features.size() * 192L + areas.size() * 160L;
        }

        private static DungeonAreaSnapshot areaInChunk(DungeonAreaSnapshot area, DungeonChunkKey key) {
            List<DungeonCellRef> cells = area.cells().stream().filter(cell -> inChunk(cell, key)).toList();
            return cells.isEmpty() ? null : new DungeonAreaSnapshot(
                    area.kind(), area.id(), area.clusterId(), area.label(), cells, area.topologyRef());
        }

        private static DungeonFeatureSnapshot featureInChunk(DungeonFeatureSnapshot feature, DungeonChunkKey key) {
            List<DungeonCellRef> cells = feature.cells().stream().filter(cell -> inChunk(cell, key)).toList();
            if (cells.isEmpty() && !edgeTouchesChunk(feature.anchorEdge(), key)) {
                return null;
            }
            return new DungeonFeatureSnapshot(
                    feature.kind(),
                    feature.id(),
                    feature.label(),
                    cells,
                    feature.description(),
                    feature.destinationLabel(),
                    feature.topologyRef(),
                    feature.anchorEdge());
        }
    }

    private static boolean edgeTouchesChunk(DungeonEdgeRef edge, DungeonChunkKey key) {
        return edge != null && (inChunk(edge.from(), key) || inChunk(edge.to(), key));
    }

    private static boolean inChunk(DungeonCellRef cell, DungeonChunkKey key) {
        return cell != null
                && cell.level() == key.level()
                && cell.q() >= key.minimumQ() && cell.q() <= key.maximumQ()
                && cell.r() >= key.minimumR() && cell.r() <= key.maximumR();
    }

    private static final class BoundsAccumulator {
        private boolean present;
        private int minimumQ;
        private int minimumR;
        private int maximumQ;
        private int maximumR;

        void include(DungeonEdgeRef edge, int level) {
            if (edge != null) {
                include(edge.from(), level);
                include(edge.to(), level);
            }
        }

        void include(DungeonCellRef cell, int level) {
            if (cell == null || cell.level() != level) {
                return;
            }
            if (!present) {
                present = true;
                minimumQ = maximumQ = cell.q();
                minimumR = maximumR = cell.r();
                return;
            }
            minimumQ = Math.min(minimumQ, cell.q());
            minimumR = Math.min(minimumR, cell.r());
            maximumQ = Math.max(maximumQ, cell.q());
            maximumR = Math.max(maximumR, cell.r());
        }

        DungeonViewportSnapshot.AuthoredBounds snapshot() {
            return present
                    ? new DungeonViewportSnapshot.AuthoredBounds(
                            true, minimumQ, minimumR, maximumQ, maximumR)
                    : DungeonViewportSnapshot.AuthoredBounds.empty();
        }
    }
}
