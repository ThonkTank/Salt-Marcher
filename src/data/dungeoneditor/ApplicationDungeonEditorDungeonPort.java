package src.data.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;

final class ApplicationDungeonEditorDungeonPort implements DungeonEditorDungeonPort {

    private DungeonMapCatalogResponse currentCatalog;
    private @Nullable DungeonSnapshot currentCommittedSnapshot;
    private @Nullable DungeonInspectorSnapshot currentInspector;
    private DungeonAuthoredMutationResult currentMutation;

    ApplicationDungeonEditorDungeonPort(
            DungeonMapCatalogModel catalogModel,
            DungeonAuthoredReadModel authoredReadModel,
            DungeonAuthoredMutationModel authoredMutationModel
    ) {
        currentCatalog = catalogModel.current();
        applyReadResult(authoredReadModel.current());
        currentMutation = authoredMutationModel.current();
        catalogModel.subscribe(response -> currentCatalog = response);
        authoredReadModel.subscribe(this::applyReadResult);
        authoredMutationModel.subscribe(result -> currentMutation = result);
    }

    @Override
    public DungeonEditorDungeonFacts currentFacts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return DungeonEditorDungeonFactsMapper.facts(
                currentCatalog,
                currentCommittedSnapshot,
                currentInspector,
                currentMutation,
                mapId,
                selection,
                preview);
    }

    @Override
    public DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId) {
        return DungeonEditorDungeonFactsMapper.facts(
                currentCatalog,
                currentCommittedSnapshot,
                currentInspector,
                currentMutation,
                mapId,
                DungeonEditorSessionValues.Selection.empty(),
                DungeonEditorSessionValues.Preview.none());
    }

    private void applyReadResult(@Nullable DungeonAuthoredReadResult result) {
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            currentCommittedSnapshot = committedSnapshot.snapshot();
        } else if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            currentInspector = selectionInspector.inspector();
        }
    }
}
