package entities;

public class WorldLocation {
    public Long LocationId;
    public Long TileId;
    public String Name;
    public String LocationType;  // city, dungeon, ruins, shrine, waypoint
    public String Description;
    public boolean IsDiscovered;
}
