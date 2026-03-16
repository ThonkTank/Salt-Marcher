package features.campaignstate.api;

public record DungeonPositionSummary(
        Long mapId,
        CampaignDungeonLocationType locationType,
        Long roomId,
        Long corridorId,
        String locationKey
) {
}
