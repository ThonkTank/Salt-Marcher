package src.view.slotcontent.details.creature;

import java.util.Objects;
import java.util.function.Function;
import javafx.scene.Node;
import shell.api.InspectorEntrySpec;
import src.domain.creatures.published.CreatureDetailResult;

public final class CreatureDetailsInspectorEntry {

    private CreatureDetailsInspectorEntry() {
    }

    public static InspectorEntrySpec create(
            long creatureId,
            Function<Long, CreatureDetailResult> detailLoader
    ) {
        Function<Long, CreatureDetailResult> loader =
                Objects.requireNonNull(detailLoader, "detailLoader");
        return new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> content(creatureId, loader),
                null);
    }

    private static Node content(
            long creatureId,
            Function<Long, CreatureDetailResult> detailLoader
    ) {
        CreatureDetailsView detailView = new CreatureDetailsView();
        CreatureDetailsPresentationModel presentationModel =
                new CreatureDetailsPresentationModel(detailLoader.apply(creatureId));
        detailView.bind(presentationModel);
        return detailView;
    }
}
