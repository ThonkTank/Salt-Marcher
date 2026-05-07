package src.view.statetabs.encounter;

import java.util.Objects;
import java.util.function.Consumer;

final class EncounterStateIntentHandler {

    private final EncounterStateContributionModel presentationModel;
    private Consumer<EncounterStatePublishedEvent> publishedEventListener = ignored -> { };

    EncounterStateIntentHandler(EncounterStateContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<EncounterStatePublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(EncounterStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        EncounterStateViewInputEvent.Input input = event.input();
        if (input instanceof EncounterStateViewInputEvent.BuilderInput builderInput) {
            publishBuilder(builderInput.action());
            return;
        }
        if (input instanceof EncounterStateViewInputEvent.DetailSelectionInput detail) {
            presentationModel.selectCreatureDetail(detail.creatureId());
            return;
        }
        if (input instanceof EncounterStatePublishedEvent.Mutation mutation) {
            publish(new EncounterStatePublishedEvent(mutation));
        }
    }

    private void publishBuilder(EncounterStateViewInputEvent.BuilderInput.BuilderAction action) {
        if (action instanceof EncounterStatePublishedEvent.Mutation mutation) {
            publish(new EncounterStatePublishedEvent(mutation));
        }
    }

    private void publish(EncounterStatePublishedEvent event) {
        publishedEventListener.accept(Objects.requireNonNull(event, "event"));
    }
}
