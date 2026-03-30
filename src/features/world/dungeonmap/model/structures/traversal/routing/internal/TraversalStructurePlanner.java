package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.model.structures.traversal.TraversalStairPlacement;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class TraversalStructurePlanner {

    private static final int MAX_HORIZONTAL_NEIGHBORS = 3;

    private TraversalStructurePlanner() {
        throw new AssertionError("No instances");
    }

    public static StructurePlan plan(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        List<TraversalEdge> candidateEdges = buildCandidateEdges(resolvedTopology);
        return resolvedTopology.hasWaypoints()
                ? planWaypointBackbone(resolvedTopology, candidateEdges)
                : planRequiredNodeNetwork(resolvedTopology, candidateEdges);
    }

    private static StructurePlan planRequiredNodeNetwork(
            TraversalTopology topology,
            List<TraversalEdge> candidateEdges
    ) {
        List<TraversalNode> requiredNodes = topology == null ? List.of() : topology.requiredNodes();
        if (requiredNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        Map<String, List<TraversalEdge>> candidateEdgesByNodeKey = indexEdgesByNodeKey(candidateEdges);
        ArrayList<TraversalEdge> selectedEdges = new ArrayList<>();
        LinkedHashSet<String> connectedNodeKeys = new LinkedHashSet<>();
        LinkedHashSet<String> requiredNodeKeys = requiredNodeKeys(requiredNodes);
        TraversalNode seedNode = requiredNodes.getFirst();
        connectedNodeKeys.add(seedNode.nodeKey());
        while (connectedNodeKeys.size() < requiredNodeKeys.size()) {
            TraversalEdge nextEdge = null;
            String nextNodeKey = null;
            for (String connectedNodeKey : connectedNodeKeys) {
                for (TraversalEdge candidateEdge : candidateEdgesByNodeKey.getOrDefault(connectedNodeKey, List.of())) {
                    String candidateNodeKey = otherNodeKey(candidateEdge, connectedNodeKey);
                    if (candidateNodeKey == null
                            || connectedNodeKeys.contains(candidateNodeKey)
                            || !requiredNodeKeys.contains(candidateNodeKey)
                            || !isBetterEdge(candidateEdge, nextEdge, candidateNodeKey, nextNodeKey)) {
                        continue;
                    }
                    nextEdge = candidateEdge;
                    nextNodeKey = candidateNodeKey;
                }
            }
            if (nextEdge == null || nextNodeKey == null) {
                break;
            }
            selectedEdges.add(nextEdge);
            connectedNodeKeys.add(nextNodeKey);
        }
        return new StructurePlan(topology, selectedEdges);
    }

    private static StructurePlan planWaypointBackbone(
            TraversalTopology topology,
            List<TraversalEdge> candidateEdges
    ) {
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        if (waypointNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        Map<String, TraversalEdge> candidateEdgesByKey = indexEdgesByKey(candidateEdges);
        ArrayList<TraversalEdge> selectedEdges = new ArrayList<>();
        for (int index = 1; index < waypointNodes.size(); index++) {
            TraversalNode start = waypointNodes.get(index - 1);
            TraversalNode end = waypointNodes.get(index);
            TraversalEdge selectedEdge = candidateEdgesByKey.get(edgeKey(
                    start == null ? null : start.nodeKey(),
                    end == null ? null : end.nodeKey()));
            if (selectedEdge != null) {
                selectedEdges.add(selectedEdge);
            }
        }
        if (waypointNodes.size() > 1 && selectedEdges.size() != waypointNodes.size() - 1) {
            return new StructurePlan(topology, selectedEdges);
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            TraversalEdge attachmentEdge = selectBestPortalAttachmentEdge(candidateEdgesByKey, roomPortalNode, waypointNodes);
            if (attachmentEdge != null) {
                selectedEdges.add(attachmentEdge);
            }
        }
        return new StructurePlan(topology, selectedEdges);
    }

    private static TraversalEdge selectBestPortalAttachmentEdge(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalNode roomPortalNode,
            List<TraversalNode> spineNodes
    ) {
        if (roomPortalNode == null || spineNodes == null || spineNodes.isEmpty()) {
            return null;
        }
        TraversalNode bestTarget = null;
        TraversalEdge bestEdge = null;
        for (TraversalNode spineNode : spineNodes) {
            TraversalEdge candidateEdge = candidateEdgesByKey.get(edgeKey(
                    roomPortalNode.nodeKey(),
                    spineNode == null ? null : spineNode.nodeKey()));
            if (candidateEdge == null || !isBetterEdge(
                    candidateEdge,
                    bestEdge,
                    spineNode == null ? null : spineNode.nodeKey(),
                    bestTarget == null ? null : bestTarget.nodeKey())) {
                continue;
            }
            bestTarget = spineNode;
            bestEdge = candidateEdge;
        }
        return bestTarget == null ? null : bestEdge;
    }

    private static LinkedHashSet<String> requiredNodeKeys(List<TraversalNode> requiredNodes) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (TraversalNode requiredNode : requiredNodes == null ? List.<TraversalNode>of() : requiredNodes) {
            if (requiredNode != null && requiredNode.nodeKey() != null) {
                result.add(requiredNode.nodeKey());
            }
        }
        return result;
    }

    private static String otherNodeKey(
            TraversalEdge edge,
            String nodeKey
    ) {
        if (edge == null || nodeKey == null) {
            return null;
        }
        if (nodeKey.equals(edge.startNodeKey())) {
            return edge.endNodeKey();
        }
        if (nodeKey.equals(edge.endNodeKey())) {
            return edge.startNodeKey();
        }
        return null;
    }

    private static boolean isBetterEdge(
            TraversalEdge candidateEdge,
            TraversalEdge currentBest,
            String candidateNodeKey,
            String currentBestNodeKey
    ) {
        if (candidateEdge == null) {
            return false;
        }
        if (currentBest == null) {
            return true;
        }
        if (candidateEdge.costHint() != currentBest.costHint()) {
            return candidateEdge.costHint() < currentBest.costHint();
        }
        String candidateKey = candidateNodeKey == null ? "" : candidateNodeKey;
        String bestKey = currentBestNodeKey == null ? "" : currentBestNodeKey;
        int nodeComparison = candidateKey.compareTo(bestKey);
        if (nodeComparison != 0) {
            return nodeComparison < 0;
        }
        int startComparison = nodeValue(candidateEdge.startNodeKey()).compareTo(nodeValue(currentBest.startNodeKey()));
        if (startComparison != 0) {
            return startComparison < 0;
        }
        return nodeValue(candidateEdge.endNodeKey()).compareTo(nodeValue(currentBest.endNodeKey())) < 0;
    }

    private static List<TraversalEdge> buildCandidateEdges(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        LinkedHashMap<String, TraversalEdge> candidateEdgesByKey = new LinkedHashMap<>();
        addHorizontalCandidates(candidateEdgesByKey, resolvedTopology);
        addWaypointBackboneCandidates(candidateEdgesByKey, resolvedTopology);
        addVerticalCandidates(candidateEdgesByKey, resolvedTopology);
        return candidateEdgesByKey.isEmpty() ? List.of() : List.copyOf(candidateEdgesByKey.values());
    }

    private static void addHorizontalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        Map<Integer, List<TraversalNode>> nodesByLevel = new LinkedHashMap<>();
        for (TraversalNode node : topology == null ? List.<TraversalNode>of() : topology.nodes()) {
            if (node != null) {
                nodesByLevel.computeIfAbsent(node.levelZ(), ignored -> new ArrayList<>()).add(node);
            }
        }
        for (List<TraversalNode> levelNodes : nodesByLevel.values()) {
            for (TraversalNode node : levelNodes) {
                addHorizontalCandidates(candidateEdgesByKey, topology, node, levelNodes);
            }
        }
        addRequiredPortalAttachmentCandidates(candidateEdgesByKey, topology);
    }

    private static void addWaypointBackboneCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        if (topology == null || !topology.hasWaypoints()) {
            return;
        }
        List<TraversalNode> waypointNodes = topology.requiredWaypointNodes();
        for (int index = 1; index < waypointNodes.size(); index++) {
            addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, waypointNodes.get(index - 1), waypointNodes.get(index)));
        }
    }

    private static void addRequiredPortalAttachmentCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        if (topology == null || !topology.hasWaypoints()) {
            return;
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            for (TraversalNode waypointNode : topology.requiredWaypointNodes()) {
                addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, roomPortalNode, waypointNode));
            }
        }
    }

    private static void addHorizontalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology,
            TraversalNode node,
            List<TraversalNode> levelNodes
    ) {
        if (node == null || levelNodes == null || levelNodes.size() < 2) {
            return;
        }
        ArrayList<TraversalNode> candidates = new ArrayList<>();
        for (TraversalNode candidate : levelNodes) {
            if (candidate != null && !Objects.equals(node.nodeKey(), candidate.nodeKey())) {
                candidates.add(candidate);
            }
        }
        candidates.sort(Comparator
                .comparingLong((TraversalNode candidate) -> horizontalDistance(node, candidate))
                .thenComparing(TraversalNode::nodeKey));
        int added = 0;
        for (TraversalNode candidate : candidates) {
            if (added >= MAX_HORIZONTAL_NEIGHBORS) {
                return;
            }
            if (addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, node, candidate))) {
                added++;
            }
        }
    }

    private static void addVerticalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        List<TraversalNode> nodes = topology == null ? List.of() : topology.nodes();
        for (int firstIndex = 0; firstIndex < nodes.size(); firstIndex++) {
            TraversalNode first = nodes.get(firstIndex);
            if (first == null) {
                continue;
            }
            for (int secondIndex = firstIndex + 1; secondIndex < nodes.size(); secondIndex++) {
                TraversalNode second = nodes.get(secondIndex);
                if (second == null || first.levelZ() == second.levelZ()) {
                    continue;
                }
                addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, first, second));
            }
        }
    }

    private static TraversalEdge edgeBetween(
            TraversalTopology topology,
            TraversalNode start,
            TraversalNode end
    ) {
        if (start == null
                || end == null
                || start.nodeKey() == null
                || end.nodeKey() == null
                || start.nodeKey().equals(end.nodeKey())) {
            return null;
        }
        if (start.levelZ() == end.levelZ()) {
            TraversalGeometryRealizer.LocalSegmentResult segmentResult = TraversalGeometryRealizer.routeSegment(
                    terminalFor(start),
                    terminalFor(end),
                    topology == null ? Set.of() : topology.obstacles());
            if (!segmentResult.routable()) {
                return null;
            }
            return new HorizontalTraversalEdge(
                    start.nodeKey(),
                    end.nodeKey(),
                    segmentResult.pathCells().size());
        }
        VerticalCandidateEdge candidateEdge = VerticalCandidateGenerator.project(
                start,
                end,
                topology == null ? Set.of() : topology.obstacles());
        return candidateEdge.hasCandidates() ? candidateEdge : null;
    }

    private static TraversalGeometryRealizer.LocalSegmentRequest.LocalTerminal terminalFor(TraversalNode node) {
        if (node == null) {
            return TraversalGeometryRealizer.LocalSegmentRequest.FixedCellsTerminal.of(List.of());
        }
        if (node.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
            return new TraversalGeometryRealizer.LocalSegmentRequest.RoomPortalTerminal(node);
        }
        return TraversalGeometryRealizer.LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
    }

    private static long horizontalDistance(TraversalNode first, TraversalNode second) {
        if (first == null || second == null || first.anchor() == null || second.anchor() == null) {
            return Long.MAX_VALUE;
        }
        return Math.abs((long) first.anchor().x() - second.anchor().x())
                + Math.abs((long) first.anchor().y() - second.anchor().y());
    }

    private static boolean addCandidateEdge(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalEdge edge
    ) {
        if (candidateEdgesByKey == null || edge == null || edge.costHint() == Long.MAX_VALUE) {
            return false;
        }
        String edgeKey = edgeKey(edge.startNodeKey(), edge.endNodeKey());
        if (edgeKey == null) {
            return false;
        }
        TraversalEdge existing = candidateEdgesByKey.get(edgeKey);
        if (existing == null || edge.costHint() < existing.costHint()) {
            candidateEdgesByKey.put(edgeKey, edge);
            return true;
        }
        return false;
    }

    private static Map<String, List<TraversalEdge>> indexEdgesByNodeKey(List<TraversalEdge> candidateEdges) {
        if (candidateEdges == null || candidateEdges.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, ArrayList<TraversalEdge>> result = new LinkedHashMap<>();
        for (TraversalEdge candidateEdge : candidateEdges) {
            if (candidateEdge == null) {
                continue;
            }
            result.computeIfAbsent(candidateEdge.startNodeKey(), ignored -> new ArrayList<>()).add(candidateEdge);
            result.computeIfAbsent(candidateEdge.endNodeKey(), ignored -> new ArrayList<>()).add(candidateEdge);
        }
        if (result.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, List<TraversalEdge>> copy = new LinkedHashMap<>();
        for (Map.Entry<String, ArrayList<TraversalEdge>> entry : result.entrySet()) {
            copy.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static Map<String, TraversalEdge> indexEdgesByKey(List<TraversalEdge> candidateEdges) {
        if (candidateEdges == null || candidateEdges.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, TraversalEdge> result = new LinkedHashMap<>();
        for (TraversalEdge candidateEdge : candidateEdges) {
            String edgeKey = candidateEdge == null ? null : edgeKey(candidateEdge.startNodeKey(), candidateEdge.endNodeKey());
            if (edgeKey != null) {
                result.putIfAbsent(edgeKey, candidateEdge);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static String edgeKey(String firstNodeKey, String secondNodeKey) {
        if (firstNodeKey == null || secondNodeKey == null) {
            return null;
        }
        return firstNodeKey.compareTo(secondNodeKey) <= 0
                ? firstNodeKey + "->" + secondNodeKey
                : secondNodeKey + "->" + firstNodeKey;
    }

    private static String nodeValue(String nodeKey) {
        return nodeKey == null ? "" : nodeKey;
    }

    public record StructurePlan(
            TraversalTopology topology,
            List<TraversalEdge> selectedEdges
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            selectedEdges = normalizeSelectedEdges(selectedEdges);
        }

        public static StructurePlan empty() {
            return new StructurePlan(
                    TraversalTopology.empty(),
                    List.of());
        }

        private static List<TraversalEdge> normalizeSelectedEdges(List<TraversalEdge> selectedEdges) {
            if (selectedEdges == null || selectedEdges.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<TraversalEdge> result = new LinkedHashSet<>();
            for (TraversalEdge selectedEdge : selectedEdges) {
                if (selectedEdge != null) {
                    result.add(selectedEdge);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }

    sealed interface TraversalEdge permits HorizontalTraversalEdge, VerticalCandidateEdge {
        String startNodeKey();

        String endNodeKey();

        long costHint();
    }

    record HorizontalTraversalEdge(
            String startNodeKey,
            String endNodeKey,
            long costHint
    ) implements TraversalEdge {

        HorizontalTraversalEdge {
            Objects.requireNonNull(startNodeKey, "startNodeKey");
            Objects.requireNonNull(endNodeKey, "endNodeKey");
            if (startNodeKey.equals(endNodeKey)) {
                throw new IllegalArgumentException("edge must connect distinct nodes");
            }
            if (costHint < 0L) {
                throw new IllegalArgumentException("costHint must not be negative");
            }
        }
    }

    record VerticalCandidateEdge(
            String startNodeKey,
            String endNodeKey,
            List<StairCandidate> stairCandidates,
            long costHint
    ) implements TraversalEdge {

        VerticalCandidateEdge {
            Objects.requireNonNull(startNodeKey, "startNodeKey");
            Objects.requireNonNull(endNodeKey, "endNodeKey");
            if (startNodeKey.equals(endNodeKey)) {
                throw new IllegalArgumentException("edge must connect distinct nodes");
            }
            stairCandidates = normalizeCandidates(stairCandidates);
            costHint = normalizeCostHint(stairCandidates, costHint);
        }

        boolean hasCandidates() {
            return !stairCandidates.isEmpty();
        }

        private static List<StairCandidate> normalizeCandidates(List<StairCandidate> stairCandidates) {
            if (stairCandidates == null || stairCandidates.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<StairCandidate> deduplicated = new LinkedHashSet<>();
            for (StairCandidate stairCandidate : stairCandidates) {
                if (stairCandidate != null) {
                    deduplicated.add(stairCandidate);
                }
            }
            if (deduplicated.isEmpty()) {
                return List.of();
            }
            ArrayList<StairCandidate> result = new ArrayList<>(deduplicated);
            result.sort(Comparator.comparingLong(StairCandidate::costHint));
            return List.copyOf(result);
        }

        private static long normalizeCostHint(List<StairCandidate> stairCandidates, long costHint) {
            if (costHint >= 0L) {
                return costHint;
            }
            if (stairCandidates == null || stairCandidates.isEmpty()) {
                return Long.MAX_VALUE;
            }
            return stairCandidates.stream()
                    .mapToLong(StairCandidate::costHint)
                    .min()
                    .orElse(Long.MAX_VALUE);
        }
    }

    record StairCandidate(
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels,
            Set<CubePoint> footprint,
            CubePoint startCell,
            CubePoint endCell,
            long costHint
    ) {
        StairCandidate {
            Objects.requireNonNull(anchor, "anchor");
            Objects.requireNonNull(shape, "shape");
            Objects.requireNonNull(direction, "direction");
            Objects.requireNonNull(startCell, "startCell");
            Objects.requireNonNull(endCell, "endCell");
            exitLevels = normalizeExitLevels(exitLevels);
            footprint = normalizeFootprint(footprint);
            if (costHint < 0L) {
                throw new IllegalArgumentException("costHint must not be negative");
            }
            if (exitLevels.size() < 2) {
                throw new IllegalArgumentException("stair candidate requires at least two exit levels");
            }
            if (!footprint.contains(startCell) || !footprint.contains(endCell)) {
                throw new IllegalArgumentException("stair candidate endpoints must be part of the footprint");
            }
        }

        TraversalStairPlacement toPlacement() {
            return new TraversalStairPlacement(
                    DungeonStair.planned(
                            anchor,
                            shape,
                            direction,
                            dimension1,
                            dimension2,
                            exitLevels),
                    footprint);
        }

        int stairPathLength() {
            return exitLevels.size();
        }

        int profileSize() {
            LinkedHashSet<Point2i> projectedFootprint = new LinkedHashSet<>();
            for (CubePoint cell : footprint) {
                if (cell != null) {
                    projectedFootprint.add(cell.projectedCell());
                }
            }
            return projectedFootprint.size();
        }

        int profileArea() {
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            int maxX = Integer.MIN_VALUE;
            int maxY = Integer.MIN_VALUE;
            for (CubePoint cell : footprint) {
                if (cell == null) {
                    continue;
                }
                minX = Math.min(minX, cell.x());
                minY = Math.min(minY, cell.y());
                maxX = Math.max(maxX, cell.x());
                maxY = Math.max(maxY, cell.y());
            }
            if (minX == Integer.MAX_VALUE) {
                return 0;
            }
            return (maxX - minX + 1) * (maxY - minY + 1);
        }

        private static List<Integer> normalizeExitLevels(List<Integer> exitLevels) {
            if (exitLevels == null || exitLevels.isEmpty()) {
                return List.of();
            }
            ArrayList<Integer> result = new ArrayList<>();
            for (Integer exitLevel : exitLevels) {
                if (exitLevel != null) {
                    result.add(exitLevel);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static Set<CubePoint> normalizeFootprint(Set<CubePoint> footprint) {
            if (footprint == null || footprint.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            for (CubePoint cell : footprint) {
                if (cell != null) {
                    result.add(cell);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }

    static final class VerticalCandidateGenerator {

        private static final int HORIZONTAL_PADDING = 3;

        private VerticalCandidateGenerator() {
            throw new AssertionError("No instances");
        }

        private static VerticalCandidateEdge project(
                TraversalNode start,
                TraversalNode end,
                Set<CubePoint> obstacles
        ) {
            if (start == null || end == null) {
                return new VerticalCandidateEdge(
                        fallbackNodeKey(start, "start"),
                        fallbackNodeKey(end, "end"),
                        List.of(),
                        Long.MAX_VALUE);
            }
            TraversalGeometryRealizer.SearchVolume searchVolume = TraversalGeometryRealizer.SearchVolume.enclosing(
                    obstacles == null ? Set.of() : obstacles,
                    terminalBounds(start),
                    terminalBounds(end));
            TerminalResolution startResolution = resolveNode(start, searchVolume);
            TerminalResolution endResolution = resolveNode(end, searchVolume);
            List<StairCandidate> candidates = generateCandidates(
                    start,
                    end,
                    startResolution.cells(),
                    endResolution.cells(),
                    searchVolume);
            long costHint = candidates.stream()
                    .mapToLong(StairCandidate::costHint)
                    .min()
                    .orElse(Long.MAX_VALUE);
            return new VerticalCandidateEdge(start.nodeKey(), end.nodeKey(), candidates, costHint);
        }

        private static List<StairCandidate> generateCandidates(
                TraversalNode start,
                TraversalNode end,
                Set<CubePoint> startTerminals,
                Set<CubePoint> endTerminals,
                TraversalGeometryRealizer.SearchVolume searchVolume
        ) {
            if (startTerminals.isEmpty() || endTerminals.isEmpty()) {
                return List.of();
            }
            TraversalNode lowerNode = start.levelZ() <= end.levelZ() ? start : end;
            TraversalNode upperNode = lowerNode == start ? end : start;
            Set<CubePoint> lowerTerminals = lowerNode == start ? startTerminals : endTerminals;
            Set<CubePoint> upperTerminals = lowerNode == start ? endTerminals : startTerminals;
            int minZ = lowerNode.levelZ();
            int maxZ = upperNode.levelZ();
            CandidateBounds bounds = CandidateBounds.enclosing(terminalBounds(start), terminalBounds(end));
            LinkedHashMap<StairPlacementKey, StairCandidate> candidates = new LinkedHashMap<>();
            for (CardinalDirection direction : CardinalDirection.values()) {
                List<AutomaticStairVariantCatalog.StairVariant> variants = AutomaticStairVariantCatalog.variantsFor(
                        direction,
                        minZ,
                        maxZ);
                for (AutomaticStairVariantCatalog.StairVariant variant : variants) {
                    for (CubePoint lowerTerminal : lowerTerminals) {
                        addCandidate(
                                candidates,
                                start,
                                end,
                                variant.placementAnchorForLowerTerminal(lowerTerminal.projectedCell()),
                                variant,
                                lowerTerminals,
                                upperTerminals,
                                bounds,
                                searchVolume);
                    }
                    for (CubePoint upperTerminal : upperTerminals) {
                        addCandidate(
                                candidates,
                                start,
                                end,
                                variant.placementAnchorForUpperTerminal(upperTerminal.projectedCell()),
                                variant,
                                lowerTerminals,
                                upperTerminals,
                                bounds,
                                searchVolume);
                    }
                }
            }
            if (candidates.isEmpty()) {
                return List.of();
            }
            ArrayList<StairCandidate> result = new ArrayList<>(candidates.values());
            result.sort(Comparator.comparingLong(StairCandidate::costHint));
            return List.copyOf(result);
        }

        private static void addCandidate(
                Map<StairPlacementKey, StairCandidate> candidates,
                TraversalNode start,
                TraversalNode end,
                Point2i anchor,
                AutomaticStairVariantCatalog.StairVariant variant,
                Set<CubePoint> lowerTerminals,
                Set<CubePoint> upperTerminals,
                CandidateBounds bounds,
                TraversalGeometryRealizer.SearchVolume searchVolume
        ) {
            if (anchor == null || variant == null) {
                return;
            }
            List<CubePoint> path = variant.placeAt(anchor);
            if (path.isEmpty() || !bounds.containsAll(path) || !searchVolume.isFootprintPassable(path)) {
                return;
            }
            CubePoint lowerCell = path.getFirst();
            CubePoint upperCell = path.getLast();
            long lowerAttachCost = attachCost(lowerCell, lowerTerminals);
            long upperAttachCost = attachCost(upperCell, upperTerminals);
            if (lowerAttachCost == Long.MAX_VALUE || upperAttachCost == Long.MAX_VALUE) {
                return;
            }
            LinkedHashSet<Integer> exitLevels = new LinkedHashSet<>();
            for (int level = lowerCell.z(); level <= upperCell.z(); level++) {
                exitLevels.add(level);
            }
            CubePoint startCell = start.levelZ() <= end.levelZ() ? lowerCell : upperCell;
            CubePoint endCell = start.levelZ() <= end.levelZ() ? upperCell : lowerCell;
            long baseDistance = variant.stairPathLength() + lowerAttachCost + upperAttachCost;
            long costHint = TraversalRoutingCostModel.penalizeStairs(baseDistance, 1);
            StairCandidate candidate = new StairCandidate(
                    anchor,
                    variant.shape(),
                    variant.direction(),
                    variant.dimension1(),
                    variant.dimension2(),
                    List.copyOf(exitLevels),
                    Set.copyOf(path),
                    startCell,
                    endCell,
                    costHint);
            candidates.putIfAbsent(
                    new StairPlacementKey(
                            candidate.anchor(),
                            candidate.shape(),
                            candidate.direction(),
                            candidate.dimension1(),
                            candidate.dimension2(),
                            candidate.exitLevels()),
                    candidate);
        }

        private static TerminalResolution resolveNode(
                TraversalNode node,
                TraversalGeometryRealizer.SearchVolume searchVolume
        ) {
            if (node == null) {
                return TerminalResolution.empty();
            }
            return node.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL
                    ? resolveRoomPortal(node, searchVolume)
                    : resolveFixedCells(node.anchorCells(), searchVolume);
        }

        private static Set<CubePoint> terminalBounds(TraversalNode node) {
            if (node == null) {
                return Set.of();
            }
            if (node.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                return node.anchorCells();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>(node.occupiedCells());
            if (node.anchor() != null) {
                result.add(node.anchor());
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static long attachCost(CubePoint stairTerminal, Set<CubePoint> terminalCells) {
            if (stairTerminal == null || terminalCells == null || terminalCells.isEmpty()) {
                return Long.MAX_VALUE;
            }
            long best = Long.MAX_VALUE;
            for (CubePoint terminalCell : terminalCells) {
                if (terminalCell == null || terminalCell.z() != stairTerminal.z()) {
                    continue;
                }
                long distance = Math.abs((long) stairTerminal.x() - terminalCell.x())
                        + Math.abs((long) stairTerminal.y() - terminalCell.y());
                best = Math.min(best, distance);
            }
            return best;
        }

        private static TerminalResolution resolveFixedCells(
                Set<CubePoint> cells,
                TraversalGeometryRealizer.SearchVolume searchVolume
        ) {
            if (cells == null || cells.isEmpty()) {
                return TerminalResolution.empty();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            for (CubePoint cell : cells) {
                if (cell != null && searchVolume.isPassable(cell)) {
                    result.add(cell);
                }
            }
            return result.isEmpty()
                    ? TerminalResolution.empty()
                    : new TerminalResolution(Set.copyOf(result));
        }

        private static TerminalResolution resolveRoomPortal(
                TraversalNode portal,
                TraversalGeometryRealizer.SearchVolume searchVolume
        ) {
            if (portal == null || portal.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                return TerminalResolution.empty();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            TraversalNode.FixedDoorBinding binding = portal.fixedDoorBinding();
            if (portal.hasFixedDoorBinding() && binding != null) {
                CubePoint boundEntry = portal.boundEntryCell();
                if (searchVolume.isPassable(boundEntry)) {
                    result.add(boundEntry);
                }
                return result.isEmpty()
                        ? TerminalResolution.empty()
                        : new TerminalResolution(Set.copyOf(result));
            }

            for (CubePoint occupiedCell : portal.occupiedCells()) {
                if (occupiedCell == null) {
                    continue;
                }
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    CubePoint candidate = CubePoint.at(occupiedCell.projectedCell().add(step), occupiedCell.z());
                    if (portal.occupiedCells().contains(candidate) || !searchVolume.isPassable(candidate)) {
                        continue;
                    }
                    result.add(candidate);
                }
            }
            return result.isEmpty()
                    ? TerminalResolution.empty()
                    : new TerminalResolution(Set.copyOf(result));
        }

        private static String fallbackNodeKey(TraversalNode node, String label) {
            return node == null || node.nodeKey() == null ? "missing:" + label : node.nodeKey();
        }

        private record StairPlacementKey(
                Point2i anchor,
                StairShape shape,
                CardinalDirection direction,
                int dimension1,
                int dimension2,
                List<Integer> exitLevels
        ) {
        }

        private record CandidateBounds(
                int minX,
                int minY,
                int maxX,
                int maxY
        ) {
            private static CandidateBounds enclosing(Set<CubePoint> first, Set<CubePoint> second) {
                int minX = Integer.MAX_VALUE;
                int minY = Integer.MAX_VALUE;
                int maxX = Integer.MIN_VALUE;
                int maxY = Integer.MIN_VALUE;
                for (CubePoint point : merge(first, second)) {
                    minX = Math.min(minX, point.x());
                    minY = Math.min(minY, point.y());
                    maxX = Math.max(maxX, point.x());
                    maxY = Math.max(maxY, point.y());
                }
                if (minX == Integer.MAX_VALUE) {
                    minX = 0;
                    minY = 0;
                    maxX = 0;
                    maxY = 0;
                }
                return new CandidateBounds(
                        minX - HORIZONTAL_PADDING,
                        minY - HORIZONTAL_PADDING,
                        maxX + HORIZONTAL_PADDING,
                        maxY + HORIZONTAL_PADDING);
            }

            private boolean containsAll(List<CubePoint> points) {
                for (CubePoint point : points == null ? List.<CubePoint>of() : points) {
                    if (!contains(point)) {
                        return false;
                    }
                }
                return true;
            }

            private boolean contains(CubePoint point) {
                return point != null
                        && point.x() >= minX
                        && point.x() <= maxX
                        && point.y() >= minY
                        && point.y() <= maxY;
            }

            private static Set<CubePoint> merge(Set<CubePoint> first, Set<CubePoint> second) {
                LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
                if (first != null) {
                    result.addAll(first);
                }
                if (second != null) {
                    result.addAll(second);
                }
                return result;
            }
        }

        private record TerminalResolution(
                Set<CubePoint> cells
        ) {
            private TerminalResolution {
                cells = cells == null ? Set.of() : Set.copyOf(cells);
            }

            private static TerminalResolution empty() {
                return new TerminalResolution(Set.of());
            }
        }
    }

    static final class AutomaticStairVariantCatalog {

        private AutomaticStairVariantCatalog() {
            throw new AssertionError("No instances");
        }

        private static List<StairVariant> variantsFor(
                CardinalDirection direction,
                int minZ,
                int maxZ
        ) {
            if (direction == null || maxZ < minZ) {
                return List.of();
            }
            int height = maxZ - minZ + 1;
            LinkedHashMap<VariantKey, StairVariant> bestVariantByKey = new LinkedHashMap<>();
            for (StairShape shape : automaticShapes()) {
                for (StairDimensions dimensions : dimensionsFor(shape, height)) {
                    List<CubePoint> templatePath;
                    try {
                        templatePath = StairPathGenerator.generatePath(
                                shape,
                                new Point2i(0, 0),
                                direction,
                                minZ,
                                maxZ,
                                dimensions.dimension1(),
                                dimensions.dimension2());
                    } catch (IllegalArgumentException ignored) {
                        continue;
                    }
                    if (templatePath.isEmpty()) {
                        continue;
                    }
                    StairVariant candidate = StairVariant.of(
                            shape,
                            direction,
                            dimensions.dimension1(),
                            dimensions.dimension2(),
                            templatePath);
                    VariantKey key = new VariantKey(candidate.startOffset(), candidate.endOffset());
                    StairVariant currentBest = bestVariantByKey.get(key);
                    if (currentBest == null || isBetterProfile(candidate, currentBest)) {
                        bestVariantByKey.put(key, candidate);
                    }
                }
            }
            ArrayList<StairVariant> result = new ArrayList<>(bestVariantByKey.values());
            result.sort(Comparator
                    .comparingInt(StairVariant::profileSize)
                    .thenComparingInt(StairVariant::profileArea)
                    .thenComparingInt(variant -> shapePriority(variant.shape()))
                    .thenComparingInt(StairVariant::dimension1)
                    .thenComparingInt(StairVariant::dimension2)
                    .thenComparing(StairVariant::startOffset, Point2i.POINT_ORDER)
                    .thenComparing(StairVariant::endOffset, Point2i.POINT_ORDER));
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static List<StairShape> automaticShapes() {
            ArrayList<StairShape> result = new ArrayList<>();
            for (StairShape shape : StairShape.values()) {
                if (shape != StairShape.LADDER) {
                    result.add(shape);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static List<StairDimensions> dimensionsFor(StairShape shape, int height) {
            if (shape == null || height <= 0) {
                return List.of();
            }
            if (shape == StairShape.STRAIGHT) {
                return List.of(new StairDimensions(0, 0));
            }
            int maxDimension = Math.max(1, height - 1);
            ArrayList<StairDimensions> result = new ArrayList<>();
            if (shape == StairShape.SQUARE) {
                for (int sideLength = 1; sideLength <= maxDimension; sideLength++) {
                    result.add(new StairDimensions(sideLength, 0));
                }
                return List.copyOf(result);
            }
            if (shape == StairShape.RECTANGULAR) {
                for (int width = 1; width <= maxDimension; width++) {
                    for (int depth = 1; depth <= maxDimension; depth++) {
                        if (width != depth) {
                            result.add(new StairDimensions(width, depth));
                        }
                    }
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
            if (shape == StairShape.CIRCULAR) {
                for (int radius = 1; radius <= maxDimension; radius++) {
                    result.add(new StairDimensions(radius, 0));
                }
                return List.copyOf(result);
            }
            return List.of();
        }

        private static boolean isBetterProfile(StairVariant candidate, StairVariant currentBest) {
            if (candidate.profileSize() != currentBest.profileSize()) {
                return candidate.profileSize() < currentBest.profileSize();
            }
            if (candidate.profileArea() != currentBest.profileArea()) {
                return candidate.profileArea() < currentBest.profileArea();
            }
            if (shapePriority(candidate.shape()) != shapePriority(currentBest.shape())) {
                return shapePriority(candidate.shape()) < shapePriority(currentBest.shape());
            }
            if (candidate.dimension1() != currentBest.dimension1()) {
                return candidate.dimension1() < currentBest.dimension1();
            }
            return candidate.dimension2() < currentBest.dimension2();
        }

        private static int shapePriority(StairShape shape) {
            return switch (shape) {
                case STRAIGHT -> 0;
                case SQUARE -> 1;
                case RECTANGULAR -> 2;
                case CIRCULAR -> 3;
                case LADDER -> 4;
            };
        }

        private record StairDimensions(
                int dimension1,
                int dimension2
        ) {
        }

        private record VariantKey(
                Point2i startOffset,
                Point2i endOffset
        ) {
        }

        private record StairVariant(
                StairShape shape,
                CardinalDirection direction,
                int dimension1,
                int dimension2,
                List<CubePoint> templatePath,
                Point2i startOffset,
                Point2i endOffset,
                int profileSize,
                int profileArea
        ) {
            private StairVariant {
                templatePath = templatePath == null ? List.of() : List.copyOf(templatePath);
            }

            private static StairVariant of(
                    StairShape shape,
                    CardinalDirection direction,
                    int dimension1,
                    int dimension2,
                    List<CubePoint> templatePath
            ) {
                LinkedHashSet<Point2i> projectedFootprint = new LinkedHashSet<>();
                for (CubePoint point : templatePath == null ? List.<CubePoint>of() : templatePath) {
                    if (point != null) {
                        projectedFootprint.add(point.projectedCell());
                    }
                }
                Point2i startOffset = templatePath == null || templatePath.isEmpty()
                        ? new Point2i(0, 0)
                        : templatePath.getFirst().projectedCell();
                Point2i endOffset = templatePath == null || templatePath.isEmpty()
                        ? new Point2i(0, 0)
                        : templatePath.getLast().projectedCell();
                return new StairVariant(
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        templatePath,
                        startOffset,
                        endOffset,
                        projectedFootprint.size(),
                        profileArea(projectedFootprint));
            }

            private Point2i placementAnchorForLowerTerminal(Point2i lowerTerminal) {
                return lowerTerminal == null ? null : lowerTerminal.subtract(startOffset);
            }

            private Point2i placementAnchorForUpperTerminal(Point2i upperTerminal) {
                return upperTerminal == null ? null : upperTerminal.subtract(endOffset);
            }

            private List<CubePoint> placeAt(Point2i anchor) {
                if (anchor == null || templatePath.isEmpty()) {
                    return List.of();
                }
                ArrayList<CubePoint> result = new ArrayList<>(templatePath.size());
                for (CubePoint point : templatePath) {
                    result.add(CubePoint.at(point.projectedCell().add(anchor), point.z()));
                }
                return List.copyOf(result);
            }

            private int stairPathLength() {
                return templatePath.size();
            }

            private static int profileArea(Iterable<Point2i> projectedFootprint) {
                int minX = Integer.MAX_VALUE;
                int minY = Integer.MAX_VALUE;
                int maxX = Integer.MIN_VALUE;
                int maxY = Integer.MIN_VALUE;
                for (Point2i point : projectedFootprint) {
                    if (point == null) {
                        continue;
                    }
                    minX = Math.min(minX, point.x());
                    minY = Math.min(minY, point.y());
                    maxX = Math.max(maxX, point.x());
                    maxY = Math.max(maxY, point.y());
                }
                if (minX == Integer.MAX_VALUE) {
                    return 0;
                }
                return (maxX - minX + 1) * (maxY - minY + 1);
            }
        }
    }

    static final class TraversalRoutingCostModel {

        private static final int BASE_STAIR_PENALTY_TILES = 18;
        private static final int MIN_STAIR_PENALTY_TILES = 4;
        private static final int STAIR_PENALTY_RELAX_INTERVAL = 10;

        private TraversalRoutingCostModel() {
            throw new AssertionError("No instances");
        }

        static long approximateConnectionScore(long horizontalDistance, long verticalDistance) {
            if (horizontalDistance < 0L || verticalDistance < 0L) {
                return Long.MAX_VALUE;
            }
            long baseDistance = horizontalDistance + verticalDistance;
            return penalizeStairs(baseDistance, verticalDistance > 0L ? 1 : 0);
        }

        static long penalizeStairs(long baseDistance, int stairCount) {
            if (baseDistance < 0L) {
                return Long.MAX_VALUE;
            }
            if (stairCount <= 0) {
                return baseDistance;
            }
            return baseDistance + (long) stairCount * stairPenaltyTiles(baseDistance);
        }

        private static int stairPenaltyTiles(long baseDistance) {
            if (baseDistance < 0L) {
                return Integer.MAX_VALUE;
            }
            long relaxedPenalty = BASE_STAIR_PENALTY_TILES - (baseDistance / STAIR_PENALTY_RELAX_INTERVAL);
            return (int) Math.max(MIN_STAIR_PENALTY_TILES, relaxedPenalty);
        }
    }
}
