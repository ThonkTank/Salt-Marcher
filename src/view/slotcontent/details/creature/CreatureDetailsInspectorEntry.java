package src.view.slotcontent.details.creature;

import java.util.Objects;
import java.util.function.Function;
import javafx.scene.Node;
import shell.api.InspectorEntrySpec;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.LoadCreatureDetailQuery;

public final class CreatureDetailsInspectorEntry {

    private CreatureDetailsInspectorEntry() {
    }

    public static InspectorEntrySpec create(
            long creatureId,
            Function<LoadCreatureDetailQuery, CreatureDetailResult> detailLoader
    ) {
        Function<LoadCreatureDetailQuery, CreatureDetailResult> loader =
                Objects.requireNonNull(detailLoader, "detailLoader");
        return new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> content(creatureId, loader),
                null);
    }

    private static Node content(
            long creatureId,
            Function<LoadCreatureDetailQuery, CreatureDetailResult> detailLoader
    ) {
        CreatureDetailsView detailView = new CreatureDetailsView();
        CreatureDetailsViewModel viewModel =
                new CreatureDetailsViewModel(detailLoader.apply(new LoadCreatureDetailQuery(creatureId)));
        viewModel.connect(detailView::setLoadingText, detailView::setErrorText, detailView::showDetail);
        return detailView;
    }
}
