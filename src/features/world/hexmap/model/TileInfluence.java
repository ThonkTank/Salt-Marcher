package features.world.hexmap.model;

public record TileInfluence(Long tileId, Long factionId, int influence, TileControlType controlType) {}
