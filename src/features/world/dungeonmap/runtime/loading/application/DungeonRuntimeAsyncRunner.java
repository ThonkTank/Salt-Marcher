package features.world.dungeonmap.runtime.loading.application;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

@FunctionalInterface
public interface DungeonRuntimeAsyncRunner {
    <T> void runAsync(String threadName, Callable<T> background, Consumer<T> onSuccess, Consumer<Throwable> onError);
}
