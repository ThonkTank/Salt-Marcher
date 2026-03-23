package features.world.dungeonmap.state;

import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;

import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

public final class DungeonTransitionDraftState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private String name = "";
    private DungeonTransitionEditRequest.DestinationType destinationType = DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE;
    private boolean bidirectional;
    private Long targetDungeonMapId;
    private Long targetTransitionId;
    private Long targetOverworldTileId;
    private Long preparedTransitionId;
    private String placementError;

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public String name() {
        return name;
    }

    public DungeonTransitionEditRequest.DestinationType destinationType() {
        return destinationType;
    }

    public boolean bidirectional() {
        return bidirectional;
    }

    public Long targetDungeonMapId() {
        return targetDungeonMapId;
    }

    public Long targetTransitionId() {
        return targetTransitionId;
    }

    public Long targetOverworldTileId() {
        return targetOverworldTileId;
    }

    public Long preparedTransitionId() {
        return preparedTransitionId;
    }

    public String displayStatus() {
        if (placementError != null && !placementError.isBlank()) {
            return placementError;
        }
        if (preparedTransitionId != null) {
            return "Vorbereiteten Übergang platzieren";
        }
        return switch (destinationType) {
            case OVERWORLD_TILE -> targetOverworldTileId == null || targetOverworldTileId <= 0
                    ? "Overworld-Tile-ID eintragen"
                    : "Zum Platzieren Feld anklicken";
            case DUNGEON_MAP -> targetDungeonMapId == null || targetDungeonMapId <= 0
                    ? "Zielkarte wählen"
                    : bidirectional || (targetTransitionId != null && targetTransitionId > 0)
                    ? "Zum Platzieren Feld anklicken"
                    : "Ziel-Übergang eintragen";
        };
    }

    public void setName(String name) {
        String next = name == null ? "" : name.trim();
        if (Objects.equals(this.name, next)) {
            return;
        }
        this.name = next;
        placementError = null;
        notifyListeners();
    }

    public void setDestinationType(DungeonTransitionEditRequest.DestinationType destinationType) {
        DungeonTransitionEditRequest.DestinationType next = destinationType == null
                ? DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE
                : destinationType;
        if (this.destinationType == next) {
            return;
        }
        this.destinationType = next;
        this.preparedTransitionId = null;
        placementError = null;
        notifyListeners();
    }

    public void setBidirectional(boolean bidirectional) {
        if (this.bidirectional == bidirectional) {
            return;
        }
        this.bidirectional = bidirectional;
        placementError = null;
        notifyListeners();
    }

    public void setTargetDungeonMapId(Long targetDungeonMapId) {
        if (Objects.equals(this.targetDungeonMapId, targetDungeonMapId)) {
            return;
        }
        this.targetDungeonMapId = targetDungeonMapId;
        placementError = null;
        notifyListeners();
    }

    public void setTargetTransitionId(Long targetTransitionId) {
        if (Objects.equals(this.targetTransitionId, targetTransitionId)) {
            return;
        }
        this.targetTransitionId = targetTransitionId;
        placementError = null;
        notifyListeners();
    }

    public void setTargetOverworldTileId(Long targetOverworldTileId) {
        if (Objects.equals(this.targetOverworldTileId, targetOverworldTileId)) {
            return;
        }
        this.targetOverworldTileId = targetOverworldTileId;
        placementError = null;
        notifyListeners();
    }

    public void setPreparedTransitionId(Long preparedTransitionId) {
        if (Objects.equals(this.preparedTransitionId, preparedTransitionId)) {
            return;
        }
        this.preparedTransitionId = preparedTransitionId;
        placementError = null;
        notifyListeners();
    }

    public void showPlacementError(String message) {
        String next = message == null || message.isBlank() ? null : message.trim();
        if (Objects.equals(placementError, next)) {
            return;
        }
        placementError = next;
        notifyListeners();
    }

    public void clearPlacementError() {
        if (placementError == null) {
            return;
        }
        placementError = null;
        notifyListeners();
    }

    public DungeonTransitionEditRequest createRequest() {
        return new DungeonTransitionEditRequest(
                name,
                destinationType,
                targetDungeonMapId,
                targetTransitionId,
                null,
                targetOverworldTileId,
                bidirectional);
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
