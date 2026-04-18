package src.data.party.gateway.local;

import src.data.party.model.PartyRosterRecord;

public final class InMemoryPartyRosterGateway {

    private PartyRosterRecord record = PartyRosterRecord.empty();

    public PartyRosterRecord load() {
        return record;
    }

    public void save(PartyRosterRecord nextRecord) {
        record = nextRecord == null ? PartyRosterRecord.empty() : nextRecord;
    }
}
