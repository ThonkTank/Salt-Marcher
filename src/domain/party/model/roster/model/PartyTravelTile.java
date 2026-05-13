package src.domain.party.model.roster.model;

import java.util.Objects;

public final class PartyTravelTile {

    private final int q;
    private final int r;
    private final int level;

    public PartyTravelTile(int q, int r, int level) {
        this.q = q;
        this.r = r;
        this.level = level;
    }

    public int q() {
        return q;
    }

    public int r() {
        return r;
    }

    public int level() {
        return level;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PartyTravelTile tile)) {
            return false;
        }
        return q == tile.q && r == tile.r && level == tile.level;
    }

    @Override
    public int hashCode() {
        return Objects.hash(q, r, level);
    }
}
