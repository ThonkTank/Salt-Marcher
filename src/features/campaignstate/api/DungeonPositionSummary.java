package features.campaignstate.api;

public record DungeonPositionSummary(
        Long mapId,
        Integer levelZ,
        CampaignDungeonLocationType locationType,
        Long roomId,
        Long corridorId,
        String locationKey,
        String heading
) {
}
