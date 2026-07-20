package features.travel.application;

import features.travel.api.TravelContextModel;
import features.travel.api.TravelContextSnapshot;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class TravelContextPublishedState {

    private final PublishedState<TravelContextSnapshot> contexts;
    private final TravelContextModel model;
    private TravelContextSnapshot latest = TravelContextSnapshot.none(0L);
    private long publicationRevision;

    public TravelContextPublishedState(UiDispatcher dispatcher) {
        contexts = new PublishedState<>(latest, dispatcher);
        model = new TravelContextModel(contexts::current, contexts::subscribe);
    }

    public TravelContextModel model() {
        return model;
    }

    synchronized void publishIfChanged(TravelContextSnapshot candidate) {
        TravelContextSnapshot safeCandidate = candidate == null
                ? TravelContextSnapshot.none(latest.partyPositionRevision())
                : candidate;
        if (latest.sameContext(safeCandidate)) {
            return;
        }
        publicationRevision = Math.incrementExact(publicationRevision);
        latest = safeCandidate.withPublicationRevision(publicationRevision);
        contexts.publish(latest);
    }
}
