package features.world.dungeonmap.editor.session.application.workflow;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public interface DungeonEditorSessionAsyncRunner {
    <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onFailure);

    <T> CancellationHandle submitCancelable(
            Callable<T> work,
            Consumer<T> onSuccess,
            Consumer<Throwable> onFailure,
            Runnable onCancelled
    );

    @FunctionalInterface
    interface CancellationHandle {
        CancellationHandle NO_OP = () -> {
        };

        void cancel();
    }
}
