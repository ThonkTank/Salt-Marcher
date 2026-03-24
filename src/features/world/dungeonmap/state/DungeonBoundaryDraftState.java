package features.world.dungeonmap.state;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonBoundaryDraftState {

    public record Draft(
            Long clusterId,
            boolean deleteMode,
            Point2i startVertex,
            Point2i currentVertex,
            Set<VertexEdge> previewEdges,
            Set<VertexEdge> skippedDoorEdges,
            String statusMessage
    ) {
        public Draft {
            previewEdges = previewEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(previewEdges));
            skippedDoorEdges = skippedDoorEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(skippedDoorEdges));
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private Draft draft;

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public Draft draft() {
        return draft;
    }

    public boolean hasDraft() {
        return draft != null;
    }

    public void showDraft(Draft draft) {
        if (Objects.equals(this.draft, draft)) {
            return;
        }
        this.draft = draft;
        notifyListeners();
    }

    public void clear() {
        if (draft == null) {
            return;
        }
        draft = null;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
