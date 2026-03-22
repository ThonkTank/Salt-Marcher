package features.campaignstate.api;

public record DungeonPositionRef(
        Long mapId,
        CampaignDungeonLocationType locationType,
        Long roomId,
        Long corridorId,
        String locationKey,
        String heading
) {
}
