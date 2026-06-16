package src.domain.dungeon.model.core.structure.door;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

/**
 * Owns door-boundary relocation policy for transient editor previews.
 */
public final class DoorBoundaryPreviewRelocation {

    public @Nullable DoorBoundaryPreviewPlan planDoorBoundaryMove(
            List<PreviewBoundary> boundaries,
            Map<Long, ? extends Iterable<Cell>> cellsByRoom,
            Edge sourceEdge,
            Edge movedEdge,
            DungeonTopologyRef topologyRef
    ) {
        List<PreviewBoundary> safeBoundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        PreviewBoundary sourceBoundary = boundaryAt(safeBoundaries, sourceEdge, topologyRef);
        PreviewBoundary targetBoundary = boundaryAt(safeBoundaries, movedEdge, null);
        if (sourceBoundary == null
                || targetBoundary == null
                || sourceBoundary.kind() != PreviewBoundaryKind.DOOR
                || !targetMaterializesDoor(targetBoundary, movedEdge, cellsByRoom)) {
            return null;
        }
        PreviewBoundary sourceReplacement = new PreviewBoundary(
                targetBoundary.id(),
                targetBoundary.label(),
                sourceBoundary.edge(),
                targetBoundary.topologyRef(),
                PreviewBoundaryKind.WALL);
        PreviewBoundary targetReplacement = new PreviewBoundary(
                sourceBoundary.id(),
                sourceBoundary.label(),
                movedEdge,
                sourceBoundary.topologyRef(),
                PreviewBoundaryKind.DOOR);
        return new DoorBoundaryPreviewPlan(List.of(
                new PreviewBoundaryReplacement(sourceBoundary, sourceReplacement),
                new PreviewBoundaryReplacement(targetBoundary, targetReplacement)));
    }

    private static boolean targetMaterializesDoor(
            PreviewBoundary targetBoundary,
            Edge movedEdge,
            Map<Long, ? extends Iterable<Cell>> cellsByRoom
    ) {
        return DoorBoundaryMaterialization.forEdge(
                movedEdge,
                cellsByRoom,
                boundaryKind(targetBoundary)).materializesDoor();
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            PreviewBoundary boundary
    ) {
        return switch (boundary.kind()) {
            case DOOR -> DoorBoundaryMaterialization.existingDoorBoundary();
            case WALL, OPEN -> DoorBoundaryMaterialization.existingNonDoorBoundary();
        };
    }

    private static @Nullable PreviewBoundary boundaryAt(
            List<PreviewBoundary> boundaries,
            Edge edge,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        if (edge == null) {
            return null;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (PreviewBoundary boundary : boundaries) {
            if (boundary != null
                    && key.equals(DungeonBoundaryKey.from(boundary.edge()))
                    && (topologyRef == null || topologyRef.equals(boundary.topologyRef()))) {
                return boundary;
            }
        }
        return null;
    }

    public enum PreviewBoundaryKind {
        WALL,
        DOOR,
        OPEN
    }

    public record PreviewBoundary(
            long id,
            String label,
            Edge edge,
            DungeonTopologyRef topologyRef,
            PreviewBoundaryKind kind
    ) {
        public PreviewBoundary {
            id = Math.max(1L, id);
            label = label == null ? "" : label;
            edge = edge == null ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0)) : edge;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            kind = kind == null ? PreviewBoundaryKind.WALL : kind;
        }
    }

    public record PreviewBoundaryReplacement(
            PreviewBoundary original,
            PreviewBoundary replacement
    ) {
        public PreviewBoundaryReplacement {
            original = Objects.requireNonNull(original, "original");
            replacement = Objects.requireNonNull(replacement, "replacement");
        }
    }

    public record DoorBoundaryPreviewPlan(
            List<PreviewBoundaryReplacement> replacements
    ) {
        public DoorBoundaryPreviewPlan {
            replacements = replacements == null ? List.of() : List.copyOf(replacements);
        }

        public @Nullable PreviewBoundary replacementFor(PreviewBoundary boundary) {
            for (PreviewBoundaryReplacement replacement : replacements) {
                if (sameBoundaryIdentity(replacement.original(), boundary)) {
                    return replacement.replacement();
                }
            }
            return null;
        }

        private static boolean sameBoundaryIdentity(PreviewBoundary first, PreviewBoundary second) {
            return first.id() == second.id()
                    && first.kind() == second.kind()
                    && first.topologyRef().equals(second.topologyRef())
                    && DungeonBoundaryKey.from(first.edge()).equals(DungeonBoundaryKey.from(second.edge()));
        }
    }
}
