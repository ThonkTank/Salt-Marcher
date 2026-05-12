package src.domain.dungeon.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorOperationInstructionUseCase {

    private DungeonEditorOperationInstructionUseCase() {
    }

    public sealed interface Instruction permits
            Identity,
            MoveTopologyElement,
            MoveEditorHandle,
            MoveBoundaryStretch,
            MoveRoomAnchor,
            RoomRectangle,
            EditClusterBoundaries,
            CreateCorridor,
            ExtendCorridor,
            MergeCorridors,
            DeleteCorridor,
            SaveRoomNarration {
    }

    public record Identity() implements Instruction {
    }

    public record MoveTopologyElement(
            DungeonTopologyRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Instruction {
    }

    public record MoveEditorHandle(
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Instruction {
    }

    public record MoveBoundaryStretch(
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Instruction {

        public MoveBoundaryStretch {
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }

    public record MoveRoomAnchor(
            int deltaQ,
            int deltaR
    ) implements Instruction {
    }

    public record RoomRectangle(
            DungeonCell start,
            DungeonCell end,
            boolean deletesRoomCells
    ) implements Instruction {
    }

    public record EditClusterBoundaries(
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) implements Instruction {

        public EditClusterBoundaries {
            edges = edges == null ? List.of() : List.copyOf(edges);
            kind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
        }
    }

    public record CreateCorridor(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) implements Instruction {
    }

    public record ExtendCorridor(
            long corridorId,
            @Nullable DungeonCorridorRoomEndpoint endpoint
    ) implements Instruction {
    }

    public record MergeCorridors(
            long corridorId,
            long mergedCorridorId
    ) implements Instruction {
    }

    public record DeleteCorridor(long corridorId) implements Instruction {
    }

    public record SaveRoomNarration(
            long roomId,
            DungeonRoomNarration narration
    ) implements Instruction {
    }
}
