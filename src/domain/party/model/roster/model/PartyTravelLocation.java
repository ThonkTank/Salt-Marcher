package src.domain.party.model.roster.model;

public sealed interface PartyTravelLocation
        permits PartyDungeonTravelLocation, PartyOverworldTravelLocation {
}
