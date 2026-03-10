package features.party.api;

import features.party.model.PlayerCharacter;
import features.party.service.PartyService;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Public cross-feature read facade for party state.
 */
public final class PartyApi {

    private PartyApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PartyMember(Long id, String name, int level) {}
    public record ActivePartyResult(ReadStatus status, List<PartyMember> members) {}
    public record PartySnapshotResult(ReadStatus status, List<PartyMember> members, List<PartyMember> available) {}

    public static ActivePartyResult loadActiveParty() {
        PartyService.PartyListResult result = PartyService.getActivePartyResult();
        return new ActivePartyResult(
                mapStatus(result.status()),
                mapMembers(result.members()));
    }

    public static PartySnapshotResult loadPartySnapshot() {
        PartyService.PartySnapshotResult result = PartyService.loadPartySnapshot();
        return new PartySnapshotResult(
                mapStatus(result.status()),
                mapMembers(result.members()),
                mapMembers(result.available()));
    }

    public static int calculatePartyLevel(List<PartyMember> party) {
        return party == null || party.isEmpty()
                ? 1
                : (int) Math.round(party.stream().mapToInt(PartyMember::level).average().orElse(1));
    }

    public static List<Integer> loadActivePartyLevels(Connection conn) throws SQLException {
        return PartyService.loadActivePartyLevels(conn);
    }

    public static List<Integer> loadActivePartyLevelsForComposition(Connection conn) throws SQLException {
        return PartyService.loadActivePartyLevelsForComposition(conn);
    }

    private static ReadStatus mapStatus(PartyService.ReadStatus status) {
        return status == PartyService.ReadStatus.SUCCESS
                ? ReadStatus.SUCCESS
                : ReadStatus.STORAGE_ERROR;
    }

    private static List<PartyMember> mapMembers(List<PlayerCharacter> party) {
        if (party == null || party.isEmpty()) {
            return List.of();
        }
        return party.stream()
                .map(pc -> new PartyMember(pc.Id, pc.Name, pc.Level))
                .toList();
    }
}
