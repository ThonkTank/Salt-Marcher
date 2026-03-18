package features.world.dungeonmap.runtime.loading.ui;

import features.world.dungeonmap.runtime.loading.application.DungeonRuntimeAsyncRunner;
import ui.async.UiAsyncTasks;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonRuntimeUiAsyncRunner implements DungeonRuntimeAsyncRunner {

    @Override
    public <T> void runAsync(String threadName, Callable<T> background, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        UiAsyncTasks.submit(background, onSuccess, onError);
    }
}
