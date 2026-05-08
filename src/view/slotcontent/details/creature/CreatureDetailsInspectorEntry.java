package src.view.slotcontent.details.creature;

import javafx.scene.Node;
import shell.api.InspectorEntrySpec;
import src.domain.creatures.published.CreatureDetailResult;

public final class CreatureDetailsInspectorEntry {

    private CreatureDetailsInspectorEntry() {
    }

    public static InspectorEntrySpec create(
            long creatureId,
            CreatureDetailResult detailResult
    ) {
        return new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> content(detailResult),
                null);
    }

    private static Node content(CreatureDetailResult detailResult) {
        CreatureDetailsView detailView = new CreatureDetailsView();
        CreatureDetailsContentModel presentationModel =
                new CreatureDetailsContentModel(detailResult);
        detailView.bind(presentationModel);
        presentationModel.load();
        return detailView;
    }
}
