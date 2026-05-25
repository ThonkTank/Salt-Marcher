package src.domain.party;

import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartySnapshotResult;

final class PartyRosterPublishedModelsServiceAssembly {

    private final PartyPublishedModelChannelServiceAssembly<PartySnapshotResult> partySnapshot =
            new PartyPublishedModelChannelServiceAssembly<>(PartySnapshotProjectionServiceAssembly.failedSnapshotResult());
    private final PartyPublishedModelChannelServiceAssembly<ActivePartyResult> activeParty =
            new PartyPublishedModelChannelServiceAssembly<>(PartySnapshotProjectionServiceAssembly.failedActivePartyResult());
    private final PartyPublishedModelChannelServiceAssembly<ActivePartyCompositionResult> activePartyComposition =
            new PartyPublishedModelChannelServiceAssembly<>(
                    PartySnapshotProjectionServiceAssembly.failedActivePartyCompositionResult());
    private final PartySnapshotModel partySnapshotModel = new PartySnapshotModel(
            partySnapshot::current,
            partySnapshot::subscribe);
    private final ActivePartyModel activePartyModel = new ActivePartyModel(
            activeParty::current,
            activeParty::subscribe);
    private final ActivePartyCompositionModel activePartyCompositionModel =
            new ActivePartyCompositionModel(activePartyComposition::current, activePartyComposition::subscribe);

    PartySnapshotModel partySnapshotModel() {
        return partySnapshotModel;
    }

    ActivePartyModel activePartyModel() {
        return activePartyModel;
    }

    ActivePartyCompositionModel activePartyCompositionModel() {
        return activePartyCompositionModel;
    }

    void replaceRepositoryBackedState(PartyPublishedReadbackServiceAssembly readback) {
        partySnapshot.replace(readback.readSnapshotResult());
        activeParty.replace(readback.readActivePartyResult());
        activePartyComposition.replace(readback.readActivePartyCompositionResult());
    }

    void publishRepositoryBackedState(PartyPublishedReadbackServiceAssembly readback) {
        partySnapshot.publish(readback.readSnapshotResult());
        activeParty.publish(readback.readActivePartyResult());
        activePartyComposition.publish(readback.readActivePartyCompositionResult());
    }
}
