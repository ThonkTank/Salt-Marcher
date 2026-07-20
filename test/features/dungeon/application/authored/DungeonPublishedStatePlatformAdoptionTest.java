package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.UiDispatcher;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.api.DungeonMapCatalogResponse;

final class DungeonPublishedStatePlatformAdoptionTest {

    @Test
    void subscribersUseTheUiDispatcherAndMutationAcknowledgementsDoNotReplaceCatalogTruth() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        DungeonAuthoredPublishedState state = new DungeonAuthoredPublishedState(dispatcher);
        List<DungeonMapCatalogResponse> deliveries = new ArrayList<>();
        List<DungeonMapCatalogResponse> currentWhileDispatching = new ArrayList<>();
        state.mapCatalogModel().subscribe(deliveries::add);
        dispatcher.beforeDispatch(() -> currentWhileDispatching.add(state.mapCatalogModel().current()));
        DungeonMapIdentity mapId = new DungeonMapIdentity(7L);

        state.publishSearch(new DungeonAuthoredPublication.Catalog(List.of(
                new DungeonAuthoredPublication.MapSummary(mapId, "Current", 4L))));
        currentWhileDispatching.clear();
        state.publishRenamed(new DungeonAuthoredPublication.MapMutation(mapId));

        DungeonMapCatalogResponse.MapList currentDuringMutationDispatch = assertInstanceOf(
                DungeonMapCatalogResponse.MapList.class,
                currentWhileDispatching.getFirst());
        assertEquals("Current", currentDuringMutationDispatch.maps().getFirst().mapName());
        DungeonMapCatalogResponse.MapList current = assertInstanceOf(
                DungeonMapCatalogResponse.MapList.class,
                state.mapCatalogModel().current());
        assertEquals("Current", current.maps().getFirst().mapName());
        assertEquals(0, deliveries.size());
        dispatcher.runAll();
        assertEquals(2, deliveries.size());
        assertInstanceOf(DungeonMapCatalogResponse.MapMutation.class, deliveries.get(1));
    }

    @Test
    void mutationEventsDeduplicateSubscribersAndCancelQueuedDeliveryAfterUnsubscribe() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        DungeonAuthoredPublishedState state = new DungeonAuthoredPublishedState(dispatcher);
        List<DungeonMapCatalogResponse> deliveries = new ArrayList<>();
        Consumer<DungeonMapCatalogResponse> subscriber = deliveries::add;
        Runnable unsubscribe = state.mapCatalogModel().subscribe(subscriber);
        state.mapCatalogModel().subscribe(subscriber);
        DungeonAuthoredPublication.MapMutation mutation = new DungeonAuthoredPublication.MapMutation(
                new DungeonMapIdentity(9L));

        state.publishRenamed(mutation);
        dispatcher.runAll();
        assertEquals(1, deliveries.size());

        state.publishDeleted(mutation);
        unsubscribe.run();
        dispatcher.runAll();
        assertEquals(1, deliveries.size());
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();
        private Runnable beforeDispatch = () -> { };

        @Override
        public void dispatch(Runnable update) {
            beforeDispatch.run();
            updates.addLast(update);
        }

        void beforeDispatch(Runnable action) {
            beforeDispatch = action;
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }
}
