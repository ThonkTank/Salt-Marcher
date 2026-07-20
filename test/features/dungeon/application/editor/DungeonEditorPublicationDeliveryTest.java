package features.dungeon.application.editor;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.ui.UiDispatcher;
import features.dungeon.api.editor.DungeonEditorState;

final class DungeonEditorPublicationDeliveryTest {

    @Test
    void queuedDeliveryRejectsStaleFrames() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        List<DungeonEditorState> delivered = new ArrayList<>();
        DungeonEditorApiFacade.StateDelivery delivery =
                new DungeonEditorApiFacade.StateDelivery(delivered::add, dispatcher);
        DungeonEditorState stale = DungeonEditorState.empty();
        DungeonEditorState current = DungeonEditorState.empty();

        delivery.deliver(stale);
        delivery.deliver(current);
        dispatcher.runAll();

        assertEquals(1, delivered.size());
        assertEquals(0L, delivered.getFirst().publicationRevision());
    }

    @Test
    void queuedDeliveryRejectsFramesAfterClose() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        List<DungeonEditorState> delivered = new ArrayList<>();
        DungeonEditorApiFacade.StateDelivery delivery =
                new DungeonEditorApiFacade.StateDelivery(delivered::add, dispatcher);

        delivery.deliver(DungeonEditorState.empty());
        delivery.close();
        dispatcher.runAll();

        assertEquals(0, delivered.size());
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }
}
