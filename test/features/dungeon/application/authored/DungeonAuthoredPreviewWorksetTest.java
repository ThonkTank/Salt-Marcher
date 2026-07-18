package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class DungeonAuthoredPreviewWorksetTest {
    @Test
    void repeatedPointerPreviewsUseTheLoadedWorksetWithoutRepositoryReads() {
        CountingRepository repository = new CountingRepository();
        DungeonAuthoredApplicationService service = new DungeonAuthoredApplicationService(
                repository,
                repository,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));
        DungeonAuthoredApplicationService.Session session = service.openSession(new DungeonEditorDungeonState());
        DungeonEditorWorkspaceValues.MapId mapId = new DungeonEditorWorkspaceValues.MapId(1L);
        DungeonEditorSessionValues.RoomRectanglePreview preview = new DungeonEditorSessionValues.RoomRectanglePreview(
                new features.dungeon.domain.core.geometry.Cell(0, 0, 0),
                new features.dungeon.domain.core.geometry.Cell(2, 2, 0),
                false);

        session.executePreview(mapId, preview);
        session.executePreview(mapId, preview);

        assertEquals(1, repository.findByIdCalls);
    }

    private static final class CountingRepository implements DungeonCatalogStore, DungeonMapRepository {
        private final DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Map");
        private int findByIdCalls;

        @Override
        public long nextStairId() {
            return 1L;
        }

        @Override
        public long nextTransitionId() {
            return 1L;
        }

        @Override
        public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            findByIdCalls++;
            return Optional.of(map);
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            return List.of(header(map));
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<DungeonMap> firstMap() {
            return Optional.of(map);
        }

        @Override
        public DungeonMap save(DungeonMap dungeonMap) {
            return dungeonMap;
        }

        @Override
        public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
            return List.copyOf(dungeonMaps);
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
        }

        private static DungeonMapHeader header(DungeonMap dungeonMap) {
            return new DungeonMapHeader(
                    dungeonMap.metadata().mapId(),
                    dungeonMap.metadata().mapName(),
                    dungeonMap.revision());
        }
    }
}
