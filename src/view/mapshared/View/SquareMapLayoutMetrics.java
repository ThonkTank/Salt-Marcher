package src.view.mapshared.View;

record SquareMapLayoutMetrics(double cellSize, double gap, double padding) {

    double totalWidth(int width) {
        return padding * 2 + width * cellSize + Math.max(0, width - 1) * gap;
    }

    double totalHeight(int height) {
        return padding * 2 + height * cellSize + Math.max(0, height - 1) * gap;
    }

    double originX(int q) {
        return padding + q * (cellSize + gap);
    }

    double originY(int r) {
        return padding + r * (cellSize + gap);
    }

    double centerX(int q) {
        return originX(q) + cellSize / 2.0;
    }

    double centerY(int r) {
        return originY(r) + cellSize / 2.0;
    }

    String key(int q, int r) {
        return q + ":" + r;
    }
}
