package ui.components;

import ui.ThemeColors;
import javafx.scene.AccessibleRole;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;

public class DifficultyMeter extends Region {
    private final Canvas canvas = new Canvas();
    private int easyThreshold, mediumThreshold, hardThreshold, deadlyThreshold;
    private int adjustedXp;

    public DifficultyMeter() {
        getChildren().add(canvas);
        canvas.widthProperty().bind(widthProperty());
        canvas.heightProperty().bind(heightProperty());
        canvas.widthProperty().addListener(o -> draw());
        canvas.heightProperty().addListener(o -> draw());
        setPrefHeight(28);
        setMinHeight(28);
        setMaxHeight(28);
        setAccessibleRole(AccessibleRole.TEXT);
    }

    public void update(int easy, int medium, int hard, int deadly, int adjXp, String difficultyLabel) {
        this.easyThreshold   = easy;
        this.mediumThreshold = medium;
        this.hardThreshold   = hard;
        this.deadlyThreshold = deadly;
        this.adjustedXp      = adjXp;
        draw();

        setAccessibleText("XP: " + adjXp + " \u2014 " + difficultyLabel);
        notifyAccessibleAttributeChanged(javafx.scene.AccessibleAttribute.TEXT);
    }

    private void draw() {
        double w = canvas.getWidth();
        double h = canvas.getHeight();
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.clearRect(0, 0, w, h);

        double barH = 12;
        double barY = (h - barH) / 2;
        double pad = 12;
        double barW = w - pad * 2;

        if (deadlyThreshold <= 0 || barW <= 0) {
            gc.setFill(ThemeColors.BG_ELEVATED);
            gc.fillRoundRect(pad, barY, barW, barH, 6, 6);
            return;
        }

        double maxXp = deadlyThreshold * 1.5;
        int[] thresholds = { 0, easyThreshold, mediumThreshold, hardThreshold, deadlyThreshold };
        Color[] colors = { ThemeColors.BG_ELEVATED, ThemeColors.EASY, ThemeColors.MEDIUM, ThemeColors.HARD, ThemeColors.DEADLY };

        // Clip to rounded rect
        gc.save();
        gc.beginPath();
        gc.moveTo(pad + 3, barY);
        gc.arcTo(pad + barW, barY, pad + barW, barY + barH, 3);
        gc.arcTo(pad + barW, barY + barH, pad, barY + barH, 3);
        gc.arcTo(pad, barY + barH, pad, barY, 3);
        gc.arcTo(pad, barY, pad + barW, barY, 3);
        gc.closePath();
        gc.clip();

        for (int i = 0; i < thresholds.length; i++) {
            int startXp = thresholds[i];
            int endXp = (i < thresholds.length - 1) ? thresholds[i + 1] : (int) maxXp;
            double x1 = pad + (startXp / maxXp * barW);
            double x2 = pad + (endXp   / maxXp * barW);
            gc.setFill(colors[i]);
            gc.fillRect(x1, barY, x2 - x1, barH);
        }

        gc.restore();

        // Marker
        if (adjustedXp > 0) {
            double markerX = pad + (Math.min(adjustedXp, maxXp) / maxXp * barW);
            gc.setStroke(ThemeColors.TEXT_PRIMARY);
            gc.setLineWidth(2);
            gc.strokeLine(markerX, barY - 2, markerX, barY + barH + 2);

            double triSize = 5;
            double[] triX = { markerX - triSize, markerX + triSize, markerX };
            double[] triY = { barY - triSize - 2, barY - triSize - 2, barY - 1 };
            gc.setFill(ThemeColors.TEXT_PRIMARY);
            gc.fillPolygon(triX, triY, 3);
        }
    }
}
