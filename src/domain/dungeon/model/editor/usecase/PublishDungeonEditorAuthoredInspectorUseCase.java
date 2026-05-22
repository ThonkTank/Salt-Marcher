package src.domain.dungeon.model.editor.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class PublishDungeonEditorAuthoredInspectorUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public PublishDungeonEditorAuthoredInspectorUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector) {
        state.replaceInspector(inspectorFacts(inspector));
        DungeonAuthoredPublishedStateRepository.InspectorPublication publication =
                inspectorPublication(inspector);
        if (publication != null) {
            publishedStateRepository.publishInspector(publication);
        }
    }

    private static DungeonEditorWorkspaceValues.@Nullable Inspector inspectorFacts(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                roomNarrations(inspector.roomNarrations()));
    }

    private static DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspectorPublication(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.InspectorPublication(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                roomNarrationPublications(inspector.roomNarrations()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> roomNarrationPublications(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarrationPublication(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarrationPublication(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonAuthoredPublishedStateRepository.RoomNarrationPublication(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExitPublications(roomNarration.exits()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> roomExitPublications(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(new DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication(
                    exit.label(),
                    exit.cell(),
                    exit.direction(),
                    exit.description()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.RoomNarrationCard> roomNarrations(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonEditorWorkspaceValues.RoomNarrationCard> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarration(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard roomNarration(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    private static List<DungeonEditorWorkspaceValues.RoomExitNarration> roomExits(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonEditorWorkspaceValues.RoomExitNarration> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            DungeonCell cell = exit.cell();
            result.add(new DungeonEditorWorkspaceValues.RoomExitNarration(
                    exit.label(),
                    cell == null
                            ? DungeonEditorWorkspaceValues.Cell.empty()
                            : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level()),
                    exit.direction().name(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
