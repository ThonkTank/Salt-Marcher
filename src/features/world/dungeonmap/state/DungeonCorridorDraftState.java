package features.world.dungeonmap.state;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonCorridorDraftState {

    public sealed interface PendingTarget permits PendingTarget.Room, PendingTarget.Corridor {
        String targetKey();

        record Room(Long roomId, String targetKey) implements PendingTarget {
        }

        record Corridor(Long corridorId, String targetKey) implements PendingTarget {
        }
    }

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private PendingTarget pendingStart;

    public Long pendingStartRoomId() {
        return pendingStart instanceof PendingTarget.Room room ? room.roomId() : null;
    }

    public Long pendingStartCorridorId() {
        return pendingStart instanceof PendingTarget.Corridor corridor ? corridor.corridorId() : null;
    }

    public String pendingStartTargetKey() {
        return pendingStart == null ? null : pendingStart.targetKey();
    }

    public boolean hasPendingStart() {
        return pendingStart != null;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public PendingTarget pendingStart() {
        return pendingStart;
    }

    public void selectPendingStart(PendingTarget target) {
        if (Objects.equals(pendingStart, target)) {
            return;
        }
        pendingStart = target;
        notifyListeners();
    }

    public void clear() {
        if (pendingStart == null) {
            return;
        }
        pendingStart = null;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
