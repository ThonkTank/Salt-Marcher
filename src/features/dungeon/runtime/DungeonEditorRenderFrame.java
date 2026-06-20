package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

public record DungeonEditorRenderFrame(
        DungeonEditorControlsSnapshot controls,
        DungeonEditorMapSurfaceSnapshot mapSurface,
        DungeonEditorStateSnapshot state,
        DungeonEditorPreparedFrameFacts preparedFacts,
        DungeonEditorStatePanelLabelNameDrafts.Draft statePanelLabelNameDraft,
        DungeonEditorStatePanelCorridorPointDrafts.Draft statePanelCorridorPointDraft
) {
    public DungeonEditorRenderFrame {
        controls = Objects.requireNonNull(controls, "controls");
        mapSurface = Objects.requireNonNull(mapSurface, "mapSurface");
        state = Objects.requireNonNull(state, "state");
        preparedFacts = Objects.requireNonNull(preparedFacts, "preparedFacts");
        statePanelLabelNameDraft = statePanelLabelNameDraft == null
                ? DungeonEditorStatePanelLabelNameDrafts.Draft.empty()
                : statePanelLabelNameDraft;
        statePanelCorridorPointDraft = statePanelCorridorPointDraft == null
                ? DungeonEditorStatePanelCorridorPointDrafts.Draft.empty()
                : statePanelCorridorPointDraft;
    }
}
