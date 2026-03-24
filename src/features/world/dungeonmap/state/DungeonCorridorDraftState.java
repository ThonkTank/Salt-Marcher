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

    public record PendingStart(
            PendingTarget target,
            int levelZ,
            String displayLabel
    ) {
        public PendingStart {
            displayLabel = displayLabel == null || displayLabel.isBlank()
                    ? defaultDisplayLabel(target)
                    : displayLabel;
        }

        private static String defaultDisplayLabel(PendingTarget target) {
            if (target instanceof PendingTarget.Room room && room.roomId() != null) {
                return "Raum " + room.roomId();
            }
            if (target instanceof PendingTarget.Corridor corridor && corridor.corridorId() != null) {
                return "Korridor " + corridor.corridorId();
            }
            return "Ziel";
        }
    }

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private PendingStart pendingStart;

    public Long pendingStartRoomId() {
        return pendingStart != null && pendingStart.target() instanceof PendingTarget.Room room ? room.roomId() : null;
    }

    public Long pendingStartCorridorId() {
        return pendingStart != null && pendingStart.target() instanceof PendingTarget.Corridor corridor ? corridor.corridorId() : null;
    }

    public String pendingStartTargetKey() {
        return pendingStart == null ? null : pendingStart.target().targetKey();
    }

    public int pendingStartLevel() {
        return pendingStart == null ? 0 : pendingStart.levelZ();
    }

    public String pendingStartDisplayLabel() {
        return pendingStart == null ? null : pendingStart.displayLabel();
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
        return pendingStart == null ? null : pendingStart.target();
    }

    public PendingStart pendingStartDetails() {
        return pendingStart;
    }

    public void selectPendingStart(PendingTarget target, int levelZ, String displayLabel) {
        PendingStart next = target == null ? null : new PendingStart(target, levelZ, displayLabel);
        if (Objects.equals(pendingStart, next)) {
            return;
        }
        pendingStart = next;
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
