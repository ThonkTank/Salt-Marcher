package features.hex.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class HexEditorModel {

    private final Supplier<HexEditorSnapshot> currentSupplier;
    private final Function<Consumer<HexEditorSnapshot>, Runnable> subscribeAction;
    private final List<Consumer<HexEditorSnapshot>> listeners = new ArrayList<>();
    private HexEditorSnapshot current = emptySnapshot();
    private PublishedState<HexEditorSnapshot> statefulStore;
    private ToolIntent toolIntent = new ToolIntent(0L, "SELECT", "GRASSLAND");

    public HexEditorModel() {
        this(new PublishedState<>(emptySnapshot()));
    }

    public HexEditorModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptySnapshot(), dispatcher));
    }

    private HexEditorModel(PublishedState<HexEditorSnapshot> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public HexEditorModel(
            Supplier<HexEditorSnapshot> currentSupplier,
            Function<Consumer<HexEditorSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> HexEditorSnapshot.empty("Hex editor service is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public HexEditorSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<HexEditorSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public synchronized ToolIntent currentToolIntent() {
        return toolIntent;
    }

    public synchronized void publishImmediateToolIntent(String activeTool, String activeTerrain) {
        HexEditorSnapshot base = safeSnapshot(current());
        toolIntent = new ToolIntent(toolIntent.revision() + 1L, activeTool, activeTerrain);
        publishDirect(withToolIntent(
                base,
                toolIntent,
                "Hex editor tool selected.",
                "",
                ""));
    }

    public synchronized void publish(HexEditorSnapshot snapshot) {
        publishDirect(withToolIntent(safeSnapshot(snapshot), toolIntent));
    }

    public synchronized void publishCompletion(HexEditorSnapshot snapshot, long submittedToolRevision) {
        HexEditorSnapshot safeSnapshot = safeSnapshot(snapshot);
        if (toolIntent.revision() == submittedToolRevision) {
            toolIntent = new ToolIntent(
                    toolIntent.revision(),
                    safeSnapshot.activeTool(),
                    safeSnapshot.activeTerrain());
            publishDirect(safeSnapshot);
            return;
        }
        publishDirect(withToolIntent(safeSnapshot, toolIntent));
    }

    private void publishDirect(HexEditorSnapshot snapshot) {
        if (statefulStore != null) {
            statefulStore.publish(snapshot);
            return;
        }
        current = snapshot;
        for (Consumer<HexEditorSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    private HexEditorSnapshot localCurrent() {
        return current;
    }

    private Runnable localSubscribe(Consumer<HexEditorSnapshot> listener) {
        Consumer<HexEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(current);
        return () -> listeners.remove(safeListener);
    }

    private static HexEditorSnapshot emptySnapshot() {
        return HexEditorSnapshot.empty("No Hex map loaded.");
    }

    private static HexEditorSnapshot safeSnapshot(HexEditorSnapshot snapshot) {
        return snapshot == null ? emptySnapshot() : snapshot;
    }

    private static HexEditorSnapshot withToolIntent(HexEditorSnapshot snapshot, ToolIntent intent) {
        return withToolIntent(
                snapshot,
                intent,
                snapshot.statusText(),
                snapshot.failureText(),
                snapshot.warningText());
    }

    private static HexEditorSnapshot withToolIntent(
            HexEditorSnapshot snapshot,
            ToolIntent intent,
            String statusText,
            String failureText,
            String warningText
    ) {
        return new HexEditorSnapshot(
                snapshot.catalog(),
                snapshot.selectedMap(),
                snapshot.tiles(),
                snapshot.selectedTile(),
                intent.activeTool(),
                intent.activeTerrain(),
                statusText,
                failureText,
                warningText);
    }

    public record ToolIntent(long revision, String activeTool, String activeTerrain) {

        public ToolIntent {
            if (revision < 0L) {
                throw new IllegalArgumentException("tool intent revision must not be negative");
            }
            HexEditorSnapshot normalized = new HexEditorSnapshot(
                    List.of(),
                    java.util.Optional.empty(),
                    List.of(),
                    java.util.Optional.empty(),
                    activeTool,
                    activeTerrain,
                    "",
                    "",
                    "");
            activeTool = normalized.activeTool();
            activeTerrain = normalized.activeTerrain();
        }
    }
}
