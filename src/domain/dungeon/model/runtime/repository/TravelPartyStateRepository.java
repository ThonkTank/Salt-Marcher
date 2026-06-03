package src.domain.dungeon.model.runtime.repository;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;

public interface TravelPartyStateRepository {

    ActiveTravelStateData loadActiveTravelState();
}
