package features.dungeon.application.authored;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.DungeonCommandReadSpec.CommandIntent;
import features.dungeon.application.authored.DungeonCommandReadSpec.DependencyExpansion;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Deterministic bounded read specifications for one authored command. */
final class DungeonCommandReadSpecs {
    private DungeonCommandReadSpecs() {
    }

    static DungeonCommandReadSpec forViewport(
            AcceptedViewport viewport,
            Collection<DungeonChunkKey> commandChunks,
            Collection<DungeonPatchEntityRef> seedRefs,
            DependencyExpansion expansion,
            CommandIntent intent
    ) {
        LinkedHashSet<DungeonChunkKey> chunks = new LinkedHashSet<>(viewport.chunkKeys());
        if (commandChunks != null) {
            chunks.addAll(commandChunks);
        }
        return spec(
                viewport.mapId(),
                viewport.revision(),
                chunks,
                seedRefs,
                expansion,
                viewport.requestGeneration(),
                intent);
    }

    static DungeonCommandReadSpec forHeader(
            DungeonMapHeader header,
            long requestGeneration,
            Collection<DungeonChunkKey> chunks,
            Collection<DungeonPatchEntityRef> seedRefs,
            DependencyExpansion expansion,
            CommandIntent intent
    ) {
        return spec(
                header.mapId(),
                header.revision(),
                chunks,
                seedRefs,
                expansion,
                requestGeneration,
                intent);
    }

    private static DungeonCommandReadSpec spec(
            DungeonMapIdentity mapId,
            long revision,
            Collection<DungeonChunkKey> chunks,
            Collection<DungeonPatchEntityRef> seedRefs,
            DependencyExpansion expansion,
            long requestGeneration,
            CommandIntent intent
    ) {
        List<DungeonChunkKey> orderedChunks = new ArrayList<>(chunks == null ? List.of() : chunks);
        orderedChunks.sort(DungeonWindowRequest.CHUNK_ORDER);
        List<DungeonPatchEntityRef> orderedRefs = new ArrayList<>(seedRefs == null ? List.of() : seedRefs);
        orderedRefs.sort(features.dungeon.application.authored.port.DungeonWindow.ENTITY_ORDER);
        return new DungeonCommandReadSpec(
                mapId,
                revision,
                orderedChunks,
                orderedRefs,
                expansion,
                requestGeneration,
                intent);
    }

    static Set<DungeonChunkKey> cellsWithRing(long mapId, Iterable<Cell> cells) {
        LinkedHashSet<DungeonChunkKey> base = new LinkedHashSet<>();
        if (cells != null) {
            for (Cell cell : cells) {
                if (cell != null) {
                    base.add(containing(mapId, cell));
                }
            }
        }
        return withRing(base);
    }

    static Set<DungeonChunkKey> edgesWithRing(long mapId, Iterable<Edge> edges) {
        List<Cell> cells = new ArrayList<>();
        if (edges != null) {
            for (Edge edge : edges) {
                if (edge != null) {
                    cells.add(edge.from());
                    cells.add(edge.to());
                }
            }
        }
        return cellsWithRing(mapId, cells);
    }

    static Set<DungeonChunkKey> rectangleWithRing(long mapId, Cell start, Cell end) {
        if (start == null || end == null || start.level() != end.level()) {
            return Set.of();
        }
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        int minChunkQ = Math.floorDiv(minQ, DungeonChunkKey.CHUNK_SIZE);
        int maxChunkQ = Math.floorDiv(maxQ, DungeonChunkKey.CHUNK_SIZE);
        int minChunkR = Math.floorDiv(minR, DungeonChunkKey.CHUNK_SIZE);
        int maxChunkR = Math.floorDiv(maxR, DungeonChunkKey.CHUNK_SIZE);
        LinkedHashSet<DungeonChunkKey> base = new LinkedHashSet<>();
        for (int chunkR = minChunkR; chunkR <= maxChunkR; chunkR++) {
            for (int chunkQ = minChunkQ; chunkQ <= maxChunkQ; chunkQ++) {
                base.add(new DungeonChunkKey(mapId, start.level(), chunkQ, chunkR));
            }
        }
        return withRing(base);
    }

    static Set<DungeonChunkKey> translatedEdgesWithRing(
            long mapId,
            Iterable<Edge> edges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Edge> sourceAndTarget = new ArrayList<>();
        if (edges != null) {
            for (Edge edge : edges) {
                if (edge != null) {
                    sourceAndTarget.add(edge);
                    sourceAndTarget.add(new Edge(
                            moved(edge.from(), deltaQ, deltaR, deltaLevel),
                            moved(edge.to(), deltaQ, deltaR, deltaLevel)));
                }
            }
        }
        return edgesWithRing(mapId, sourceAndTarget);
    }

    static Set<DungeonChunkKey> movedCellWithRing(
            long mapId,
            Cell cell,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return cellsWithRing(mapId, List.of(cell, moved(cell, deltaQ, deltaR, deltaLevel)));
    }

    static Set<DungeonChunkKey> withRing(Collection<DungeonChunkKey> base) {
        LinkedHashSet<DungeonChunkKey> result = new LinkedHashSet<>();
        if (base == null) {
            return Set.of();
        }
        for (DungeonChunkKey key : base) {
            if (key == null) {
                continue;
            }
            for (int ringR = -1; ringR <= 1; ringR++) {
                for (int ringQ = -1; ringQ <= 1; ringQ++) {
                    result.add(new DungeonChunkKey(
                            key.mapId(), key.level(), key.chunkQ() + ringQ, key.chunkR() + ringR));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static DungeonChunkKey containing(long mapId, Cell cell) {
        return new DungeonChunkKey(
                mapId,
                cell.level(),
                Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE));
    }

    private static Cell moved(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(cell.q() + deltaQ, cell.r() + deltaR, cell.level() + deltaLevel);
    }

    record AcceptedViewport(
            DungeonMapIdentity mapId,
            long revision,
            long requestGeneration,
            int projectionLevel,
            int minimumQ,
            int minimumR,
            int maximumQ,
            int maximumR,
            List<DungeonChunkKey> chunkKeys
    ) {
        AcceptedViewport {
            chunkKeys = List.copyOf(chunkKeys == null ? List.of() : chunkKeys);
        }

        AcceptedViewport committed(long committedRevision) {
            return new AcceptedViewport(
                    mapId,
                    committedRevision,
                    requestGeneration,
                    projectionLevel,
                    minimumQ,
                    minimumR,
                    maximumQ,
                    maximumR,
                    chunkKeys);
        }

    }
}
