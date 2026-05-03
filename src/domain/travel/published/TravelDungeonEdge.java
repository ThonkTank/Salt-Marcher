package src.domain.travel.published;

public record TravelDungeonEdge(
        TravelDungeonCell from,
        TravelDungeonCell to
) {

    public TravelDungeonEdge {
        from = from == null ? new TravelDungeonCell(0, 0, 0) : from;
        to = to == null ? from : to;
    }
}
