package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;

/**
 * Shared authored dungeon snapshot records and loader seam.
 */
public final class LoadDungeonSnapshotUseCase {

    private LoadDungeonSnapshotUseCase() {
    }

    public static DungeonSnapshotData snapshotData(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles,
            long revision
    ) {
        return new DungeonSnapshotData(mapName, derived, editorHandles, revision);
    }

    public record DungeonSnapshotData(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles,
            long revision
    ) {
        public DungeonSnapshotData {
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }
    }

    public record InspectorSnapshotData(
            String title,
            String description,
            List<String> facts,
            StatePanelFacts statePanelFacts,
            List<RoomNarrationData> roomNarrations
    ) {
        public InspectorSnapshotData(String title, String description, List<String> facts) {
            this(title, description, facts, StatePanelFacts.empty(), List.of());
        }

        public InspectorSnapshotData {
            facts = facts == null ? List.of() : List.copyOf(facts);
            statePanelFacts = statePanelFacts == null ? StatePanelFacts.empty() : statePanelFacts;
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    public record StatePanelFacts(
            @Nullable StairGeometryPanelFacts stairGeometry,
            @Nullable TransitionDestinationPanelFacts transitionDestination
    ) {
        public StatePanelFacts {
            stairGeometry = stairGeometry == null ? StairGeometryPanelFacts.empty() : stairGeometry;
            transitionDestination =
                    transitionDestination == null ? TransitionDestinationPanelFacts.empty() : transitionDestination;
        }

        public static StatePanelFacts empty() {
            return new StatePanelFacts(StairGeometryPanelFacts.empty(), TransitionDestinationPanelFacts.empty());
        }
    }

    public record StairGeometryPanelFacts(
            boolean present,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        public StairGeometryPanelFacts {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            present = present && stairId > 0L;
        }

        public static StairGeometryPanelFacts empty() {
            return new StairGeometryPanelFacts(false, 0L, "", "", 0, 0);
        }
    }

    public record TransitionDestinationPanelFacts(
            boolean present,
            String destinationTypeKey,
            long mapId,
            long tileId,
            long transitionId
    ) {
        public TransitionDestinationPanelFacts {
            destinationTypeKey = destinationTypeKey == null || destinationTypeKey.isBlank()
                    ? "UNLINKED_ENTRANCE"
                    : destinationTypeKey.strip();
            mapId = Math.max(0L, mapId);
            tileId = Math.max(0L, tileId);
            transitionId = Math.max(0L, transitionId);
        }

        public static TransitionDestinationPanelFacts empty() {
            return new TransitionDestinationPanelFacts(false, "UNLINKED_ENTRANCE", 0L, 0L, 0L);
        }
    }

    public record RoomNarrationData(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationData> exits
    ) {
        public RoomNarrationData {
            roomName = roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarrationData(
            String label,
            Cell cell,
            Direction direction,
            String description
    ) {
        public RoomExitNarrationData {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            cell = cell == null ? new Cell(0, 0, 0) : cell;
            direction = direction == null ? Direction.NORTH : direction;
            description = description == null ? "" : description;
        }
    }

    public record AuthoredSurfaceData(
            DungeonSnapshotData snapshot,
            InspectorSnapshotData inspector
    ) {
        public AuthoredSurfaceData {
            snapshot = Objects.requireNonNull(snapshot, "snapshot");
            inspector = Objects.requireNonNull(inspector, "inspector");
        }
    }

}
