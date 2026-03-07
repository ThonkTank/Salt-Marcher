package features.campaignstate.model;

/**
 * Singleton campaign state — exactly one row in the DB (campaign_id = 1).
 * Use CampaignStateRepository.get() / upsert() to read or update.
 * MapId, PartyTileId, CalendarId, and CurrentPhaseId are nullable FKs.
 */
public class CampaignState {
    public long CampaignId;
    public Long MapId;
    public Long PartyTileId;
    public Long CalendarId;
    public long CurrentEpochDay;
    public Long CurrentPhaseId;
    public String CurrentWeather;
    public String Notes;
}
