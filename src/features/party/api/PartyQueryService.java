package features.party.api;

import features.party.model.PlayerCharacter;
import features.party.service.PartyService;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Cross-feature read facade for party state.
 */
public final class PartyQueryService {

    private PartyQueryService() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record ActivePartyResult(ReadStatus status, List<PlayerCharacter> members) {}

    public static ActivePartyResult loadActiveParty() {
        PartyService.PartyListResult result = PartyService.getActivePartyResult();
        return new ActivePartyResult(
                mapStatus(result.status()),
                result.members());
    }

    public static int averageLevel(List<PlayerCharacter> party) {
        return PartyService.averageLevel(party);
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
}
