package features.dungeon.application.editor.session;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;

public final class DungeonEditorSessionValues {

    private DungeonEditorSessionValues() {
    }

    public record Selection(
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
            handleRef = handleRef == null ? emptyHandleRef() : handleRef;
        }

        public static Selection empty() {
            return new Selection(
                    DungeonTopologyRef.empty(),
                    0L,
                    false,
                    emptyHandleRef());
        }
    }

    public sealed interface Preview permits NoPreview,
            RoomRectanglePreview,
            ClusterBoundariesPreview,
            StairCreatePreview,
            CorridorCreatePreview,
            DeleteCorridorPreview,
            MoveHandlePreview,
            MoveBoundaryStretchPreview {

        static Preview none() {
            return NoPreview.INSTANCE;
        }

    }

    public static final class NoPreview implements Preview {
        private static final NoPreview INSTANCE = new NoPreview();

        private NoPreview() {
        }
    }

    public static final class RoomRectanglePreview implements Preview {
        private final features.dungeon.domain.core.geometry.Cell start;
        private final features.dungeon.domain.core.geometry.Cell end;
        private final boolean deleteMode;

        public RoomRectanglePreview(
                features.dungeon.domain.core.geometry.Cell start,
                features.dungeon.domain.core.geometry.Cell end,
                boolean deleteMode
        ) {
            this.start = start == null ? features.dungeon.domain.core.geometry.Cell.empty() : start;
            this.end = end == null ? features.dungeon.domain.core.geometry.Cell.empty() : end;
            this.deleteMode = deleteMode;
        }

        public features.dungeon.domain.core.geometry.Cell start() {
            return start;
        }

        public features.dungeon.domain.core.geometry.Cell end() {
            return end;
        }

        public boolean deleteMode() {
            return deleteMode;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RoomRectanglePreview that)) {
                return false;
            }
            return deleteMode == that.deleteMode
                    && Objects.equals(start, that.start)
                    && Objects.equals(end, that.end);
        }

        @Override
        public int hashCode() {
            return Objects.hash(start, end, deleteMode);
        }

        @Override
        public String toString() {
            return "RoomRectanglePreview[start=%s, end=%s, deleteMode=%s]".formatted(start, end, deleteMode);
        }
    }

    public record ClusterBoundariesPreview(
            long clusterId,
            List<features.dungeon.domain.core.geometry.Edge> edges,
            features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind boundaryKind,
            boolean deleteMode
    ) implements Preview {
        public ClusterBoundariesPreview {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null ? features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.defaultKind() : boundaryKind;
        }

        @Override
        public List<features.dungeon.domain.core.geometry.Edge> edges() {
            return List.copyOf(edges);
        }
    }

    public record StairCreatePreview(
            features.dungeon.domain.core.geometry.Cell anchor,
            features.dungeon.domain.core.geometry.Cell end,
            features.dungeon.domain.core.geometry.Cell specAnchor,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            boolean valid,
            String statusText
    ) implements Preview {
        public StairCreatePreview {
            anchor = anchor == null ? features.dungeon.domain.core.geometry.Cell.empty() : anchor;
            end = end == null ? anchor : end;
            specAnchor = specAnchor == null ? anchor : specAnchor;
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.trim();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.trim();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            statusText = statusText == null ? "" : statusText;
        }
    }

    public record CorridorCreatePreview(
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end
    ) implements Preview {
    }

    public static final class DeleteCorridorPreview implements Preview {
        private final CorridorDeletionTarget target;

        public DeleteCorridorPreview(CorridorDeletionTarget target) {
            this.target = target == null ? CorridorDeletionTarget.wholeCorridor(0L) : target;
        }

        public CorridorDeletionTarget target() {
            return target;
        }

        public long corridorId() {
            return target.corridorId();
        }
    }

    public record MoveHandlePreview(
            DungeonEditorWorkspaceValues.HandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Preview {
        public MoveHandlePreview {
            handleRef = handleRef == null ? emptyHandleRef() : handleRef;
        }
    }

    public static final class MoveBoundaryStretchPreview implements Preview {
        private final long clusterId;
        private final List<features.dungeon.domain.core.geometry.Edge> sourceEdges;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        public MoveBoundaryStretchPreview(
                long clusterId,
                List<features.dungeon.domain.core.geometry.Edge> sourceEdges,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<features.dungeon.domain.core.geometry.Edge> sourceEdges() {
            return List.copyOf(sourceEdges);
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        public int deltaLevel() {
            return deltaLevel;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MoveBoundaryStretchPreview that)) {
                return false;
            }
            return clusterId == that.clusterId
                    && deltaQ == that.deltaQ
                    && deltaR == that.deltaR
                    && deltaLevel == that.deltaLevel
                    && Objects.equals(sourceEdges, that.sourceEdges);
        }

        @Override
        public int hashCode() {
            return Objects.hash(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
        }

        @Override
        public String toString() {
            return "MoveBoundaryStretchPreview[clusterId=%d, sourceEdges=%s, deltaQ=%d, deltaR=%d, deltaLevel=%d]"
                    .formatted(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
        }
    }

    public static boolean hasSelectedMap(DungeonEditorWorkspaceValues.@Nullable MapId selectedMapId) {
        return selectedMapId != null;
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyHandleRef() {
        return DungeonEditorWorkspaceValues.HandleRef.empty();
    }
}
