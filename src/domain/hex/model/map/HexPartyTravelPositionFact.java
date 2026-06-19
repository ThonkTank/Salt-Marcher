package src.domain.hex.model.map;

import java.util.List;

public record HexPartyTravelPositionFact(
        boolean available,
        long mapId,
        long tileId,
        List<Long> characterIds,
        String unavailableText
) {

    public HexPartyTravelPositionFact {
        characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
        unavailableText = unavailableText == null ? "" : unavailableText.trim();
    }

    public static HexPartyTravelPositionFact unavailable(String unavailableText) {
        return new HexPartyTravelPositionFact(false, 0L, 0L, List.of(), unavailableText);
    }

    public static HexPartyTravelPositionFact active(
            long mapId,
            long tileId,
            List<Long> characterIds
    ) {
        return new HexPartyTravelPositionFact(true, mapId, tileId, characterIds, "");
    }
}
