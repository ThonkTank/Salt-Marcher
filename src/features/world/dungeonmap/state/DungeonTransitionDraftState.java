package features.world.dungeonmap.state;

import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;

import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

public final class DungeonTransitionDraftState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private String description = "";
    private DungeonTransitionEditRequest.DestinationType destinationType = DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE;
    private boolean bidirectional;
    private Long targetDungeonMapId;
    private Long targetTransitionId;
    private Long targetOverworldMapId;
    private Long targetOverworldTileId;
    private Long preparedTransitionId;
    private String placementError;

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public String description() {
        return description;
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

    public Long targetOverworldMapId() {
        return targetOverworldMapId;
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
                    ? "Overworld-Ziel wählen"
                    : "Zum Platzieren Feld anklicken";
            case DUNGEON_MAP -> targetDungeonMapId == null || targetDungeonMapId <= 0
                    ? "Zielkarte wählen"
                    : bidirectional || (targetTransitionId != null && targetTransitionId > 0)
                    ? "Zum Platzieren Feld anklicken"
                    : "Ziel-Übergang wählen";
        };
    }

    public void setDescription(String description) {
        String next = description == null ? "" : description.trim();
        if (Objects.equals(this.description, next)) {
            return;
        }
        this.description = next;
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
        this.targetTransitionId = null;
        this.targetDungeonMapId = null;
        this.targetOverworldMapId = null;
        this.targetOverworldTileId = null;
        placementError = null;
        notifyListeners();
    }

    public void setBidirectional(boolean bidirectional) {
        if (this.bidirectional == bidirectional) {
            return;
        }
        this.bidirectional = bidirectional;
        if (bidirectional) {
            this.targetTransitionId = null;
        }
        placementError = null;
        notifyListeners();
    }

    public void setTargetDungeonMapId(Long targetDungeonMapId) {
        if (Objects.equals(this.targetDungeonMapId, targetDungeonMapId)) {
            return;
        }
        this.targetDungeonMapId = targetDungeonMapId;
        this.targetTransitionId = null;
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

    public void setOverworldTarget(Long targetOverworldMapId, Long targetOverworldTileId) {
        if (Objects.equals(this.targetOverworldMapId, targetOverworldMapId)
                && Objects.equals(this.targetOverworldTileId, targetOverworldTileId)) {
            return;
        }
        this.targetOverworldMapId = targetOverworldMapId;
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
                description,
                destinationType,
                targetDungeonMapId,
                targetTransitionId,
                targetOverworldMapId,
                targetOverworldTileId,
                bidirectional);
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
