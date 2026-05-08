package src.domain.party.published;

public final class PartyDungeonTravelLocationKind {

    public static final PartyDungeonTravelLocationKind TILE =
            new PartyDungeonTravelLocationKind(src.domain.party.roster.value.PartyDungeonTravelLocationKind.TILE);
    public static final PartyDungeonTravelLocationKind TRANSITION =
            new PartyDungeonTravelLocationKind(src.domain.party.roster.value.PartyDungeonTravelLocationKind.TRANSITION);

    private final src.domain.party.roster.value.PartyDungeonTravelLocationKind kind;

    private PartyDungeonTravelLocationKind(src.domain.party.roster.value.PartyDungeonTravelLocationKind kind) {
        this.kind = kind;
    }

    public static PartyDungeonTravelLocationKind fromInternal(
            src.domain.party.roster.value.PartyDungeonTravelLocationKind kind
    ) {
        return kind == src.domain.party.roster.value.PartyDungeonTravelLocationKind.TRANSITION ? TRANSITION : TILE;
    }

    public src.domain.party.roster.value.PartyDungeonTravelLocationKind toInternal() {
        return kind;
    }

    public String name() {
        return kind.name();
    }

    public static PartyDungeonTravelLocationKind valueOf(String value) {
        return "TRANSITION".equals(value) ? TRANSITION : TILE;
    }

    @Override
    public String toString() {
        return kind.name();
    }
}
