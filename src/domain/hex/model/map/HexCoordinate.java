package src.domain.hex.model.map;

public record HexCoordinate(int q, int r) {

    public boolean insideRadius(int radius) {
        if (radius < 0) {
            return false;
        }
        int s = -q - r;
        return Math.max(Math.max(Math.abs(q), Math.abs(r)), Math.abs(s)) <= radius;
    }

}
