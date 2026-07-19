package features.travel;

import features.dungeon.api.DungeonTravelContextModel;
import features.hex.api.HexTravelModel;
import features.party.api.PartyTravelPositionsModel;
import features.travel.adapter.javafx.TravelStateContribution;
import features.travel.api.TravelContextApi;
import features.travel.api.TravelContextModel;
import features.travel.application.TravelContextApplicationService;
import features.travel.application.TravelContextPublishedState;
import java.util.Objects;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

public final class TravelFeature {

    private TravelFeature() {
    }

    public static Component create(
            PartyTravelPositionsModel partyPositions,
            DungeonTravelContextModel dungeonContexts,
            HexTravelModel hexContexts,
            UiDispatcher uiDispatcher
    ) {
        TravelContextPublishedState publishedState = new TravelContextPublishedState(
                Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
        TravelContextApplicationService application = new TravelContextApplicationService(
                partyPositions,
                dungeonContexts,
                hexContexts,
                publishedState);
        return new Component(
                application,
                publishedState.model(),
                new TravelStateContribution(publishedState.model()));
    }

    public record Component(
            TravelContextApi api,
            TravelContextModel model,
            ShellContribution contribution
    ) {
        public Component {
            api = Objects.requireNonNull(api, "api");
            model = Objects.requireNonNull(model, "model");
            contribution = Objects.requireNonNull(contribution, "contribution");
        }

        public void start() {
            ((TravelContextApplicationService) api).start();
        }
    }
}
