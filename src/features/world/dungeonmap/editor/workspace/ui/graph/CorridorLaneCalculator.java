package features.world.dungeonmap.editor.workspace.ui.graph;

import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.GridSegment;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

final class CorridorLaneCalculator {
    private static final double SHARED_SEGMENT_OFFSET = 7.0;
    private static final double MAX_SHARED_OFFSET = 20.0;

    private CorridorLaneCalculator() {}

    static Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> laneOrderBySegment(
            Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> result = new HashMap<>();
        List<SharedSegmentChain> chains = sharedSegmentChains(corridorIdsBySegment);
        Map<Point2i, List<SharedSegmentChain>> chainsByPoint = new HashMap<>();
        for (SharedSegmentChain chain : chains) {
            for (DungeonGraphCorridorLayoutSupport.SegmentKey segment : chain.segments()) {
                chainsByPoint.computeIfAbsent(segment.start(), ignored -> new ArrayList<>()).add(chain);
                chainsByPoint.computeIfAbsent(segment.end(), ignored -> new ArrayList<>()).add(chain);
            }
        }

        List<SharedSegmentChain> sortedChains = new ArrayList<>(chains);
        sortedChains.sort(Comparator
                .comparingInt((SharedSegmentChain chain) -> -chain.corridorIds().size())
                .thenComparing(chain -> chain.sortKey().x())
                .thenComparing(chain -> chain.sortKey().y()));

        Map<SharedSegmentChain, List<Long>> resolvedOrder = new LinkedHashMap<>();
        for (SharedSegmentChain chain : sortedChains) {
            List<Long> inheritedOrder = inheritedLaneOrder(chain, chainsByPoint, resolvedOrder);
            List<Long> laneOrder = inheritedOrder == null ? chain.corridorIds() : inheritedOrder;
            resolvedOrder.put(chain, laneOrder);
            for (DungeonGraphCorridorLayoutSupport.SegmentKey segment : chain.segments()) {
                result.put(segment, laneOrder);
            }
        }

        for (Map.Entry<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            result.putIfAbsent(entry.getKey(), entry.getValue());
        }
        return result;
    }

    static Map<Long, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath> corridorDisplayPaths(
            List<DungeonCorridor> corridors,
            Function<DungeonCorridor, CorridorGeometry> geometryProvider,
            DungeonCanvasCamera camera,
            Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> laneOrderBySegment) {
        Map<Long, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath> result = new HashMap<>();
        for (DungeonCorridor corridor : corridors) {
            CorridorGeometry geometry = geometryProvider.apply(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            List<DungeonGraphCorridorLayoutSupport.OffsetLine> displaySegments = new ArrayList<>();
            for (GridSegment segment : geometry.segments()) {
                displaySegments.add(offsetLine(segment, corridor.corridorId(), laneOrderBySegment, camera));
            }
            result.put(corridor.corridorId(), new DungeonGraphCorridorLayoutSupport.CorridorDisplayPath(displaySegments));
        }
        return result;
    }

    private static List<SharedSegmentChain> sharedSegmentChains(
            Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<CorridorSetKey, List<DungeonGraphCorridorLayoutSupport.SegmentKey>> segmentsByCorridorSet = new LinkedHashMap<>();
        for (Map.Entry<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }
            segmentsByCorridorSet
                    .computeIfAbsent(new CorridorSetKey(entry.getValue()), ignored -> new ArrayList<>())
                    .add(entry.getKey());
        }

        List<SharedSegmentChain> result = new ArrayList<>();
        for (Map.Entry<CorridorSetKey, List<DungeonGraphCorridorLayoutSupport.SegmentKey>> entry : segmentsByCorridorSet.entrySet()) {
            Set<DungeonGraphCorridorLayoutSupport.SegmentKey> unvisited = new LinkedHashSet<>(entry.getValue());
            while (!unvisited.isEmpty()) {
                DungeonGraphCorridorLayoutSupport.SegmentKey seed = unvisited.iterator().next();
                Set<DungeonGraphCorridorLayoutSupport.SegmentKey> component = new LinkedHashSet<>();
                List<DungeonGraphCorridorLayoutSupport.SegmentKey> queue = new ArrayList<>();
                queue.add(seed);
                unvisited.remove(seed);
                for (int index = 0; index < queue.size(); index++) {
                    DungeonGraphCorridorLayoutSupport.SegmentKey current = queue.get(index);
                    component.add(current);
                    for (DungeonGraphCorridorLayoutSupport.SegmentKey neighbor : touchingSegments(current, unvisited)) {
                        if (unvisited.remove(neighbor)) {
                            queue.add(neighbor);
                        }
                    }
                }
                Point2i sortKey = component.stream()
                        .flatMap(segment -> java.util.stream.Stream.of(segment.start(), segment.end()))
                        .min(Comparator.comparingInt(Point2i::x).thenComparingInt(Point2i::y))
                        .orElse(new Point2i(0, 0));
                result.add(new SharedSegmentChain(
                        List.copyOf(entry.getKey().corridorIds()),
                        Set.copyOf(component),
                        sortKey));
            }
        }
        return result;
    }

    private static List<DungeonGraphCorridorLayoutSupport.SegmentKey> touchingSegments(
            DungeonGraphCorridorLayoutSupport.SegmentKey anchor,
            Set<DungeonGraphCorridorLayoutSupport.SegmentKey> candidates) {
        List<DungeonGraphCorridorLayoutSupport.SegmentKey> result = new ArrayList<>();
        for (DungeonGraphCorridorLayoutSupport.SegmentKey candidate : candidates) {
            if (anchor.touches(candidate)) {
                result.add(candidate);
            }
        }
        return result;
    }

    private static List<Long> inheritedLaneOrder(
            SharedSegmentChain chain,
            Map<Point2i, List<SharedSegmentChain>> chainsByPoint,
            Map<SharedSegmentChain, List<Long>> resolvedOrder
    ) {
        List<Long> best = null;
        int bestSourceSize = -1;
        for (DungeonGraphCorridorLayoutSupport.SegmentKey segment : chain.segments()) {
            for (Point2i point : List.of(segment.start(), segment.end())) {
                for (SharedSegmentChain neighbor : chainsByPoint.getOrDefault(point, List.of())) {
                    if (neighbor == chain) {
                        continue;
                    }
                    List<Long> order = resolvedOrder.get(neighbor);
                    if (order == null || !order.containsAll(chain.corridorIds())) {
                        continue;
                    }
                    List<Long> filtered = order.stream().filter(chain.corridorIds()::contains).toList();
                    if (filtered.size() != chain.corridorIds().size()) {
                        continue;
                    }
                    if (order.size() > bestSourceSize || best == null) {
                        best = filtered;
                        bestSourceSize = order.size();
                    }
                }
            }
        }
        return best;
    }

    private static DungeonGraphCorridorLayoutSupport.OffsetLine offsetLine(
            GridSegment segment,
            Long corridorId,
            Map<DungeonGraphCorridorLayoutSupport.SegmentKey, List<Long>> laneOrderBySegment,
            DungeonCanvasCamera camera) {
        DungeonGraphCorridorLayoutSupport.SegmentKey canonicalSegment =
                DungeonGraphCorridorLayoutSupport.SegmentKey.of(segment.from(), segment.to());
        double x1 = camera.toScreenX(segment.from().x() + 0.5);
        double y1 = camera.toScreenY(segment.from().y() + 0.5);
        double x2 = camera.toScreenX(segment.to().x() + 0.5);
        double y2 = camera.toScreenY(segment.to().y() + 0.5);
        List<Long> corridorIds = laneOrderBySegment.getOrDefault(canonicalSegment, List.of());
        if (corridorIds.size() < 2 || corridorId == null) {
            return new DungeonGraphCorridorLayoutSupport.OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new DungeonGraphCorridorLayoutSupport.OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double centerOffset = (index - (corridorIds.size() - 1) / 2.0) * laneSpacing(corridorIds.size());
        double canonicalX1 = camera.toScreenX(canonicalSegment.start().x() + 0.5);
        double canonicalY1 = camera.toScreenY(canonicalSegment.start().y() + 0.5);
        double canonicalX2 = camera.toScreenX(canonicalSegment.end().x() + 0.5);
        double canonicalY2 = camera.toScreenY(canonicalSegment.end().y() + 0.5);
        double dx = canonicalX2 - canonicalX1;
        double dy = canonicalY2 - canonicalY1;
        double length = Math.hypot(dx, dy);
        if (length == 0) {
            return new DungeonGraphCorridorLayoutSupport.OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double offsetX = -dy / length * centerOffset;
        double offsetY = dx / length * centerOffset;
        return new DungeonGraphCorridorLayoutSupport.OffsetLine(
                x1 + offsetX, y1 + offsetY, x2 + offsetX, y2 + offsetY, canonicalSegment);
    }

    private static double laneSpacing(int laneCount) {
        if (laneCount <= 1) {
            return SHARED_SEGMENT_OFFSET;
        }
        return Math.min(
                SHARED_SEGMENT_OFFSET + (laneCount - 2) * 1.5,
                MAX_SHARED_OFFSET / Math.max(1.0, (laneCount - 1) / 2.0));
    }

    private record CorridorSetKey(List<Long> corridorIds) {
        private CorridorSetKey {
            corridorIds = List.copyOf(corridorIds);
        }
    }

    private record SharedSegmentChain(
            List<Long> corridorIds,
            Set<DungeonGraphCorridorLayoutSupport.SegmentKey> segments,
            Point2i sortKey) {
        private SharedSegmentChain {
            corridorIds = List.copyOf(corridorIds);
            segments = Set.copyOf(segments);
            sortKey = Objects.requireNonNull(sortKey, "sortKey");
        }
    }
}
