package features.party.adapter.sqlite.repository;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import features.party.adapter.sqlite.mapper.PartyRosterMapper;
import features.party.adapter.sqlite.model.PartyRosterRecord;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;

abstract class AbstractPartyRosterRepository implements PartyRosterRepository {

    private final Supplier<PartyRosterRecord> loadRecord;
    private final Consumer<PartyRosterRecord> saveRecord;

    AbstractPartyRosterRepository(
            Supplier<PartyRosterRecord> loadRecord,
            Consumer<PartyRosterRecord> saveRecord
    ) {
        this.loadRecord = Objects.requireNonNull(loadRecord, "loadRecord");
        this.saveRecord = Objects.requireNonNull(saveRecord, "saveRecord");
    }

    @Override
    public final PartyRoster load() {
        try {
            PartyRosterRecord record = loadRecord.get();
            return PartyRosterMapper.toDomain(record == null ? PartyRosterRecord.empty() : record);
        } catch (RuntimeException failure) {
            throw storageFailure("load", failure);
        }
    }

    @Override
    public final void save(PartyRoster roster) {
        try {
            saveRecord.accept(PartyRosterMapper.toRecord(Objects.requireNonNull(roster, "roster")));
        } catch (RuntimeException failure) {
            throw storageFailure("save", failure);
        }
    }

    private static IllegalStateException storageFailure(String operation, RuntimeException failure) {
        if (failure instanceof IllegalStateException storageFailure) {
            return storageFailure;
        }
        return new IllegalStateException("Failed to " + operation + " Party roster.", failure);
    }
}
