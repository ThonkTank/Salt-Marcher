package src.domain.hex.published;

import java.util.List;

public record MoveHexPartyTokenCommand(
        long mapId,
        int q,
        int r,
        List<Long> partyTokenCharacterIds
) {

    public MoveHexPartyTokenCommand {
        partyTokenCharacterIds = partyTokenCharacterIds == null ? List.of() : List.copyOf(partyTokenCharacterIds);
    }
}
