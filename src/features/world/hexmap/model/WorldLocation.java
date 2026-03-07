package features.world.hexmap.model;

public record WorldLocation(
        Long locationId,
        Long tileId,
        String name,
        WorldLocationType locationType,
        String description,
        boolean discovered
) {}
