package features.world.dungeonmap.state;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonStairDraftState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private List<CubePoint> pathNodes = List.of();

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public List<CubePoint> pathNodes() {
        return pathNodes;
    }

    public boolean isEmpty() {
        return pathNodes.isEmpty();
    }

    public int levelCount() {
        return (int) pathNodes.stream()
                .map(CubePoint::z)
                .distinct()
                .count();
    }

    public CubePoint startNode() {
        return pathNodes.isEmpty() ? null : pathNodes.getFirst();
    }

    public CubePoint endNode() {
        return pathNodes.isEmpty() ? null : pathNodes.getLast();
    }

    public void append(CubePoint node) {
        CubePoint resolved = node == null ? null : new CubePoint(node.x(), node.y(), node.z());
        if (resolved == null) {
            return;
        }
        if (!pathNodes.isEmpty() && Objects.equals(pathNodes.getLast(), resolved)) {
            return;
        }
        ArrayList<CubePoint> updated = new ArrayList<>(pathNodes);
        updated.add(resolved);
        pathNodes = List.copyOf(updated);
        notifyListeners();
    }

    public void undoLast() {
        if (pathNodes.isEmpty()) {
            return;
        }
        pathNodes = List.copyOf(pathNodes.subList(0, pathNodes.size() - 1));
        notifyListeners();
    }

    public void clear() {
        if (pathNodes.isEmpty()) {
            return;
        }
        pathNodes = List.of();
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
