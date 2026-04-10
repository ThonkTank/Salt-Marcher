package features.party.api;

import features.party.PartyObject;
import features.party.input.CalculatePartyLevelInput;
import features.party.input.LoadActivePartyInput;
import features.party.input.LoadActivePartyLevelsForCompositionInput;
import features.party.input.LoadActivePartyLevelsInput;
import features.party.input.LoadAdventuringDayPartyInput;
import features.party.input.LoadPartySnapshotInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Public cross-feature read facade for party state.
 */
@SuppressWarnings("unused")
public final class PartyApi {
    private static final PartyObject PARTY_OBJECT = new PartyObject();

    private PartyApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PartyMemberSummary(
            Long id,
            String name,
            int level
    ) {}
    public record ActivePartyResult(ReadStatus status, List<PartyMemberSummary> members) {}
    public record PartySnapshotResult(
            ReadStatus status,
            List<PartyMemberSummary> members,
            List<PartyMemberSummary> available
    ) {}
    public record AdventuringDayPartySummary(
            List<Integer> activePartyLevels,
            int remainingToShortRest,
            int remainingToLongRest
    ) {}
    public record AdventuringDayPartyResult(ReadStatus status, AdventuringDayPartySummary summary) {}

    public static ActivePartyResult loadActiveParty() {
        LoadActivePartyInput.LoadedActivePartyInput result = PARTY_OBJECT.loadActiveParty(new LoadActivePartyInput());
        return new ActivePartyResult(
                mapStatus(result.status()),
                result.members().stream().map(PartyApi::toSummary).toList());
    }

    public static PartySnapshotResult loadPartySnapshot() {
        LoadPartySnapshotInput.LoadedPartySnapshotInput result = PARTY_OBJECT.loadPartySnapshot(new LoadPartySnapshotInput());
        return new PartySnapshotResult(
                mapStatus(result.status()),
                result.members().stream().map(PartyApi::toSummary).toList(),
                result.available().stream().map(PartyApi::toSummary).toList());
    }

    public static AdventuringDayPartyResult loadAdventuringDayParty() {
        LoadAdventuringDayPartyInput.LoadedAdventuringDayPartyInput result =
                PARTY_OBJECT.loadAdventuringDayParty(new LoadAdventuringDayPartyInput());
        return new AdventuringDayPartyResult(
                mapStatus(result.status()),
                result.summary() == null
                        ? null
                        : new AdventuringDayPartySummary(
                                result.summary().activePartyLevels(),
                                result.summary().remainingToShortRest(),
                                result.summary().remainingToLongRest()));
    }

    public static int calculatePartyLevel(List<PartyMemberSummary> party) {
        return PARTY_OBJECT.calculatePartyLevel(
                new CalculatePartyLevelInput(
                        party == null ? List.of() : party.stream().map(PartyMemberSummary::level).toList()))
                .level();
    }

    public static List<Integer> loadActivePartyLevels(Connection conn) throws SQLException {
        return PARTY_OBJECT.loadActivePartyLevels(new LoadActivePartyLevelsInput(conn)).levels();
    }

    public static List<Integer> loadActivePartyLevelsForComposition(Connection conn) throws SQLException {
        return PARTY_OBJECT.loadActivePartyLevelsForComposition(new LoadActivePartyLevelsForCompositionInput(conn)).levels();
    }

    private static ReadStatus mapStatus(LoadActivePartyInput.Status status) {
        return status == LoadActivePartyInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static ReadStatus mapStatus(LoadPartySnapshotInput.Status status) {
        return status == LoadPartySnapshotInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static ReadStatus mapStatus(LoadAdventuringDayPartyInput.Status status) {
        return status == LoadAdventuringDayPartyInput.Status.SUCCESS ? ReadStatus.SUCCESS : ReadStatus.STORAGE_ERROR;
    }

    private static PartyMemberSummary toSummary(LoadActivePartyInput.PartyMemberInput member) {
        return new PartyMemberSummary(member.id(), member.name(), member.level());
    }

    private static PartyMemberSummary toSummary(LoadPartySnapshotInput.CharacterInput member) {
        return new PartyMemberSummary(member.id(), member.name(), member.level());
    }
}
