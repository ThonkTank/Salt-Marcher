package src.domain.party.published;

public final class PartyTravelTile {

    private final src.domain.party.roster.value.PartyTravelTile tile;

    public PartyTravelTile(
            int q,
            int r,
            int level
    ) {
        this(new src.domain.party.roster.value.PartyTravelTile(q, r, level));
    }

    public PartyTravelTile(src.domain.party.roster.value.PartyTravelTile tile) {
        this.tile = tile == null ? new src.domain.party.roster.value.PartyTravelTile(0, 0, 0) : tile;
    }

    public static PartyTravelTile fromInternal(src.domain.party.roster.value.PartyTravelTile tile) {
        return new PartyTravelTile(tile);
    }

    public src.domain.party.roster.value.PartyTravelTile toInternal() {
        return tile;
    }

    public int q() {
        return tile.q();
    }

    public int r() {
        return tile.r();
    }

    public int level() {
        return tile.level();
    }
}
