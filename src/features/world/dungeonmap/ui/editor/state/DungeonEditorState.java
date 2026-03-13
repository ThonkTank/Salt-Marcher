package features.world.dungeonmap.ui.editor.state;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableSummary;

import java.util.List;

public final class DungeonEditorState {

    private Long currentMapId;
    private DungeonMapState currentState;
    private DungeonSelection currentSelection = DungeonSelection.none();
    private long loadRequestToken;
    private boolean syncingAreaSelection;
    private boolean syncingFeatureSelection;
    private DungeonSelectionRestoreRequest pendingSelectionRestore;
    private List<DungeonEncounterTableSummary> encounterTables = List.of();
    private List<DungeonEncounterSummary> encounters = List.of();

    public Long currentMapId() {
        return currentMapId;
    }

    public void setCurrentMapId(Long currentMapId) {
        this.currentMapId = currentMapId;
    }

    public DungeonMapState currentState() {
        return currentState;
    }

    public void setCurrentState(DungeonMapState currentState) {
        this.currentState = currentState;
    }

    public DungeonSelection currentSelection() {
        return currentSelection;
    }

    public void setCurrentSelection(DungeonSelection currentSelection) {
        this.currentSelection = currentSelection == null ? DungeonSelection.none() : currentSelection;
    }

    public void runWhileSyncingAreaSelection(Runnable action) {
        syncingAreaSelection = true;
        try {
            action.run();
        } finally {
            syncingAreaSelection = false;
        }
    }

    public void runWhileSyncingFeatureSelection(Runnable action) {
        syncingFeatureSelection = true;
        try {
            action.run();
        } finally {
            syncingFeatureSelection = false;
        }
    }

    public long nextLoadRequestToken() {
        loadRequestToken += 1;
        return loadRequestToken;
    }

    public long loadRequestToken() {
        return loadRequestToken;
    }

    public boolean syncingAreaSelection() {
        return syncingAreaSelection;
    }

    public boolean syncingFeatureSelection() {
        return syncingFeatureSelection;
    }

    public DungeonSelectionRestoreRequest pendingSelectionRestore() {
        return pendingSelectionRestore;
    }

    public void setPendingSelectionRestore(DungeonSelectionRestoreRequest pendingSelectionRestore) {
        this.pendingSelectionRestore = pendingSelectionRestore;
    }

    public List<DungeonEncounterTableSummary> encounterTables() {
        return encounterTables;
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> encounterTables) {
        this.encounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
    }

    public List<DungeonEncounterSummary> encounters() {
        return encounters;
    }

    public void setEncounters(List<DungeonEncounterSummary> encounters) {
        this.encounters = encounters == null ? List.of() : List.copyOf(encounters);
    }
}
