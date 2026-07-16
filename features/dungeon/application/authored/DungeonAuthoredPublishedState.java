package features.dungeon.application.authored;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredMutationResult;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonAuthoredReadResult;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.DungeonMapCatalogResponse;
import platform.state.PublishedState;

public final class DungeonAuthoredPublishedState {

    private final PublishedState<DungeonAuthoredReadResult> authoredRead;
    private final PublishedState<DungeonAuthoredMutationResult> authoredMutation;
    private final PublishedState<DungeonMapCatalogResponse> mapCatalog;
    private final PublishedEvents<DungeonMapCatalogResponse.MapMutation> mapCatalogMutations;
    private final DungeonAuthoredReadModel authoredReadModel;
    private final DungeonAuthoredMutationModel authoredMutationModel;
    private final DungeonMapCatalogModel mapCatalogModel;

    DungeonAuthoredPublishedState() {
        this(DirectUiDispatcher.INSTANCE);
    }

    public DungeonAuthoredPublishedState(UiDispatcher dispatcher) {
        authoredRead = new PublishedState<>(DungeonAuthoredReadProjectionServiceAssembly.defaultRead(), dispatcher);
        authoredMutation = new PublishedState<>(
                DungeonAuthoredMutationProjectionServiceAssembly.defaultMutation(), dispatcher);
        mapCatalog = new PublishedState<>(new DungeonMapCatalogResponse.MapList(List.of()), dispatcher);
        mapCatalogMutations = new PublishedEvents<>(dispatcher);
        authoredReadModel = new DungeonAuthoredReadModel(authoredRead::current, authoredRead::subscribe);
        authoredMutationModel = new DungeonAuthoredMutationModel(authoredMutation::current, authoredMutation::subscribe);
        mapCatalogModel = new DungeonMapCatalogModel(mapCatalog::current, this::subscribeMapCatalog);
    }

    public DungeonAuthoredReadModel authoredReadModel() {
        return authoredReadModel;
    }

    public DungeonAuthoredMutationModel authoredMutationModel() {
        return authoredMutationModel;
    }

    public DungeonMapCatalogModel mapCatalogModel() {
        return mapCatalogModel;
    }

    void publishSnapshot(DungeonAuthoredPublication.Snapshot snapshot) {
        if (snapshot != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.CommittedSnapshot(
                    DungeonAuthoredReadProjectionServiceAssembly.snapshot(snapshot)));
        }
    }

    void publishInspector(DungeonAuthoredPublication.Inspector inspector) {
        if (inspector != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.SelectionInspector(
                    DungeonAuthoredReadProjectionServiceAssembly.inspector(inspector)));
        }
    }

    void publishMutation(DungeonAuthoredPublication.Mutation result) {
        if (result != null) {
            authoredMutation.publish(DungeonAuthoredMutationProjectionServiceAssembly.mutation(result));
        }
    }

    void publishSearch(DungeonAuthoredPublication.Catalog result) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapList(result));
    }

    void publishCreated(DungeonAuthoredPublication.MapMutation mutation) {
        publishCatalogMutation(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.CREATED,
                mutation));
    }

    void publishRenamed(DungeonAuthoredPublication.MapMutation mutation) {
        publishCatalogMutation(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.RENAMED,
                mutation));
    }

    void publishDeleted(DungeonAuthoredPublication.MapMutation mutation) {
        publishCatalogMutation(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.DELETED,
                mutation));
    }

    private void publishCatalogMutation(DungeonMapCatalogResponse mutation) {
        if (mutation instanceof DungeonMapCatalogResponse.MapMutation mapMutation) {
            mapCatalogMutations.publish(mapMutation);
        }
    }

    private Runnable subscribeMapCatalog(Consumer<DungeonMapCatalogResponse> listener) {
        Consumer<DungeonMapCatalogResponse> safeListener = Objects.requireNonNull(listener, "listener");
        Runnable unsubscribeSnapshots = mapCatalog.subscribe(safeListener);
        Runnable unsubscribeMutations = mapCatalogMutations.subscribe(safeListener);
        return () -> {
            unsubscribeSnapshots.run();
            unsubscribeMutations.run();
        };
    }

    private static final class PublishedEvents<T> {

        private final Map<Consumer<? super T>, Registration<T>> subscribers = new LinkedHashMap<>();
        private final UiDispatcher dispatcher;

        private PublishedEvents(UiDispatcher dispatcher) {
            this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        }

        private Runnable subscribe(Consumer<? super T> subscriber) {
            Consumer<? super T> safeSubscriber = Objects.requireNonNull(subscriber, "subscriber");
            synchronized (subscribers) {
                subscribers.computeIfAbsent(safeSubscriber, Registration::new);
            }
            return () -> unsubscribe(safeSubscriber);
        }

        private void publish(T event) {
            T safeEvent = Objects.requireNonNull(event, "event");
            List<Registration<T>> currentSubscribers;
            synchronized (subscribers) {
                currentSubscribers = new ArrayList<>(subscribers.values());
            }
            for (Registration<T> registration : currentSubscribers) {
                dispatcher.dispatch(() -> registration.deliver(safeEvent));
            }
        }

        private void unsubscribe(Consumer<? super T> subscriber) {
            Registration<T> registration;
            synchronized (subscribers) {
                registration = subscribers.remove(subscriber);
            }
            if (registration != null) {
                registration.close();
            }
        }

        private static final class Registration<T> {

            private final Consumer<? super T> subscriber;
            private final AtomicBoolean active = new AtomicBoolean(true);

            private Registration(Consumer<? super T> subscriber) {
                this.subscriber = subscriber;
            }

            private void deliver(T event) {
                if (active.get()) {
                    subscriber.accept(event);
                }
            }

            private void close() {
                active.set(false);
            }
        }
    }
}
