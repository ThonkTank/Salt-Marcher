package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSelection;

import java.util.List;

final class DungeonEditorState {

    private Long currentMapId;
    private DungeonMapState currentState;
    private DungeonSelection currentSelection = DungeonSelection.none();
    private long loadRequestToken;
    private boolean syncingAreaSelection;
    private boolean syncingFeatureSelection;
    private DungeonSelectionRestoreRequest pendingSelectionRestore;
    private List<DungeonEncounterTableSummary> encounterTables = List.of();
    private List<DungeonEncounterSummary> encounters = List.of();

    Long currentMapId() {
        return currentMapId;
    }

    void setCurrentMapId(Long currentMapId) {
        this.currentMapId = currentMapId;
    }

    DungeonMapState currentState() {
        return currentState;
    }

    void setCurrentState(DungeonMapState currentState) {
        this.currentState = currentState;
    }

    DungeonSelection currentSelection() {
        return currentSelection;
    }

    void setCurrentSelection(DungeonSelection currentSelection) {
        this.currentSelection = currentSelection == null ? DungeonSelection.none() : currentSelection;
    }

    void runWhileSyncingAreaSelection(Runnable action) {
        syncingAreaSelection = true;
        try {
            action.run();
        } finally {
            syncingAreaSelection = false;
        }
    }

    void runWhileSyncingFeatureSelection(Runnable action) {
        syncingFeatureSelection = true;
        try {
            action.run();
        } finally {
            syncingFeatureSelection = false;
        }
    }

    long nextLoadRequestToken() {
        loadRequestToken += 1;
        return loadRequestToken;
    }

    long loadRequestToken() {
        return loadRequestToken;
    }

    boolean syncingAreaSelection() {
        return syncingAreaSelection;
    }

    boolean syncingFeatureSelection() {
        return syncingFeatureSelection;
    }

    DungeonSelectionRestoreRequest pendingSelectionRestore() {
        return pendingSelectionRestore;
    }

    void setPendingSelectionRestore(DungeonSelectionRestoreRequest pendingSelectionRestore) {
        this.pendingSelectionRestore = pendingSelectionRestore;
    }

    List<DungeonEncounterTableSummary> encounterTables() {
        return encounterTables;
    }

    void setEncounterTables(List<DungeonEncounterTableSummary> encounterTables) {
        this.encounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
    }

    List<DungeonEncounterSummary> encounters() {
        return encounters;
    }

    void setEncounters(List<DungeonEncounterSummary> encounters) {
        this.encounters = encounters == null ? List.of() : List.copyOf(encounters);
    }
}
