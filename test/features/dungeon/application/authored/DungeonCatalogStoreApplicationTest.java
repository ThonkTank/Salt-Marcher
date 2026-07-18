package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonMapCatalogResponse;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonChangeSet;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import platform.execution.DirectExecutionLane;

final class DungeonCatalogStoreApplicationTest {

    @Test
    void catalogLifecycleNeverUsesTheTemporaryWholeMapRepository() {
        InMemoryCatalogStore catalog = new InMemoryCatalogStore();
        DungeonAuthoredPublishedState publishedState =
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE);
        DungeonAuthoredApplicationService service = new DungeonAuthoredApplicationService(
                catalog,
                new FailingWholeMapRepository(),
                features.dungeon.DungeonTestAssembly.emptyWindowStore(),
                DirectExecutionLane.INSTANCE,
                publishedState);
        DungeonAuthoredApplicationService.Session session =
                service.openSession(new DungeonEditorDungeonState());

        session.createMapCatalog("Gamma");
        session.searchMaps("");
        DungeonMapCatalogResponse.MapList created =
                (DungeonMapCatalogResponse.MapList) publishedState.mapCatalogModel().current();
        assertEquals(1, created.maps().size());
        assertEquals("Gamma", created.maps().getFirst().mapName());
        assertEquals(1L, created.maps().getFirst().revision());

        session.renameMapCatalog(new MapId(created.maps().getFirst().mapId().value()), "Gamma Prime");
        session.searchMaps("Prime");
        DungeonMapCatalogResponse.MapList renamed =
                (DungeonMapCatalogResponse.MapList) publishedState.mapCatalogModel().current();
        assertEquals(1, renamed.maps().size());
        assertEquals("Gamma Prime", renamed.maps().getFirst().mapName());
        assertEquals(2L, renamed.maps().getFirst().revision());

        session.deleteMapCatalog(new MapId(renamed.maps().getFirst().mapId().value()));
        assertTrue(((DungeonMapCatalogResponse.MapList) publishedState.mapCatalogModel().current())
                .maps()
                .isEmpty());
    }

    private static final class InMemoryCatalogStore implements DungeonCatalogStore {
        private final List<DungeonMapHeader> headers = new ArrayList<>();
        private long nextMapId = 1L;

        @Override
        public List<DungeonMapHeader> search(String query) {
            String needle = query == null ? "" : query.toLowerCase(java.util.Locale.ROOT);
            return headers.stream()
                    .filter(header -> header.mapName().toLowerCase(java.util.Locale.ROOT).contains(needle))
                    .toList();
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            DungeonMapHeader created = new DungeonMapHeader(
                    new DungeonMapIdentity(nextMapId++),
                    mapName,
                    1L);
            headers.add(created);
            return created;
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            for (int index = 0; index < headers.size(); index++) {
                DungeonMapHeader current = headers.get(index);
                if (current.mapId().equals(mapId)) {
                    DungeonMapHeader renamed =
                            new DungeonMapHeader(mapId, mapName, current.revision() + 1L);
                    headers.set(index, renamed);
                    return renamed;
                }
            }
            throw new IllegalArgumentException("Unknown map: " + mapId.value());
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            headers.removeIf(header -> header.mapId().equals(mapId));
        }
    }

    private static final class FailingWholeMapRepository implements DungeonMapRepository {
        @Override
        public long nextStairId() {
            throw unexpectedCall();
        }

        @Override
        public long nextTransitionId() {
            throw unexpectedCall();
        }

        @Override
        public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            throw unexpectedCall();
        }

        @Override
        public Optional<DungeonMap> firstMap() {
            throw unexpectedCall();
        }

        @Override
        public DungeonMap save(DungeonMap dungeonMap) {
            throw unexpectedCall();
        }

        @Override
        public DungeonMap saveChange(DungeonChangeSet changeSet) {
            throw unexpectedCall();
        }

        @Override
        public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
            throw unexpectedCall();
        }

        private static AssertionError unexpectedCall() {
            return new AssertionError("catalog lifecycle must not use whole-map persistence");
        }
    }
}
