package features.world.dungeon.dungeonmap.input;

import java.util.concurrent.Callable;
import java.util.function.Consumer;
import java.util.function.Function;

@SuppressWarnings("unused")
public record SubmitMutationInput<T>(
        Callable<T> work,
        Function<T, Long> preferredMapIdResolver,
        Consumer<T> onPersisted,
        Consumer<Throwable> onFailure
) {
}
