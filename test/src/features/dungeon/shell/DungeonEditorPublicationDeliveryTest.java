package src.features.dungeon.shell;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.ui.UiDispatcher;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;

final class DungeonEditorPublicationDeliveryTest {

    @Test
    void queuedDeliveryRejectsStaleFrames() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();
        DungeonEditorFeatureShellBinding.PublicationDelivery delivery =
                new DungeonEditorFeatureShellBinding.PublicationDelivery(delivered::add, dispatcher);
        DungeonEditorRenderFrame stale = DungeonEditorRenderFrame.empty();
        DungeonEditorRenderFrame current = DungeonEditorRenderFrame.empty();

        delivery.deliver(stale);
        delivery.deliver(current);
        dispatcher.runAll();

        assertEquals(1, delivered.size());
        assertSame(current, delivered.getFirst());
    }

    @Test
    void queuedDeliveryRejectsFramesAfterClose() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();
        DungeonEditorFeatureShellBinding.PublicationDelivery delivery =
                new DungeonEditorFeatureShellBinding.PublicationDelivery(delivered::add, dispatcher);

        delivery.deliver(DungeonEditorRenderFrame.empty());
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
