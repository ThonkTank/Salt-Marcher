package src.domain.scene.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SceneModel {
    private final Supplier<SceneSnapshot> current;
    private final Function<Consumer<SceneSnapshot>, Runnable> subscribe;

    public SceneModel(Supplier<SceneSnapshot> current, Function<Consumer<SceneSnapshot>, Runnable> subscribe) {
        this.current = Objects.requireNonNull(current, "current");
        this.subscribe = Objects.requireNonNull(subscribe, "subscribe");
    }

    public SceneSnapshot current() { return current.get(); }
    public Runnable subscribe(Consumer<SceneSnapshot> listener) { return subscribe.apply(listener); }
}
