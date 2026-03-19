package features.world.quarantine.dungeonmap.foundation.async;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public interface DungeonAsyncRunner {
    <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onFailure);

    <T> CancellationHandle submitCancelable(
            Callable<T> work,
            Consumer<T> onSuccess,
            Consumer<Throwable> onFailure,
            Runnable onCancelled
    );

    interface CancellationHandle {
        CancellationHandle NO_OP = () -> {
        };

        void cancel();
    }
}
