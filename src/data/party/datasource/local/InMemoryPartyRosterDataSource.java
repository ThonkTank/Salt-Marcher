package src.data.party.datasource.local;

import src.data.party.model.PartyRosterRecord;

public final class InMemoryPartyRosterDataSource {

    private PartyRosterRecord record = PartyRosterRecord.empty();

    public PartyRosterRecord load() {
        return record;
    }

    public void save(PartyRosterRecord nextRecord) {
        record = nextRecord == null ? PartyRosterRecord.empty() : nextRecord;
    }
}
