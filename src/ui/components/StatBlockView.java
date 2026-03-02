package ui.components;

import entities.Creature;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.scene.control.TextArea;
import javafx.scene.layout.StackPane;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.stage.Window;
import repositories.CreatureRepository;

import java.util.List;

public final class StatBlockView {
    private StatBlockView() {}

    public static void showAsync(Long creatureId, Window owner) {
        Task<Creature> task = new Task<>() {
            @Override protected Creature call() {
                return CreatureRepository.getCreature(creatureId);
            }
        };
        task.setOnSucceeded(e -> { if (task.getValue() != null) show(task.getValue(), owner); });
        task.setOnFailed(e -> System.err.println("Stat-Block laden fehlgeschlagen: " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-stat-block");
        t.setDaemon(true);
        t.start();
    }

    public static void show(Creature c, Window owner) {
        TextArea area = new TextArea(formatStatBlock(c));
        area.setEditable(false);
        area.setWrapText(true);
        area.getStyleClass().add("stat-block");

        Stage stage = new Stage();
        stage.initOwner(owner);
        stage.initModality(Modality.NONE);
        stage.setTitle(c.Name);
        Scene scene = new Scene(new StackPane(area), 560, 660);
        scene.getStylesheets().add(
                StatBlockView.class.getResource("/salt-marcher.css").toExternalForm());
        stage.setScene(scene);
        stage.show();
    }

    public static String formatStatBlock(Creature c) {
        StringBuilder sb = new StringBuilder();
        sb.append(c.Name).append("\n");

        StringBuilder meta = new StringBuilder();
        if (notEmpty(c.Size))         meta.append(c.Size).append(" ");
        if (notEmpty(c.CreatureType)) meta.append(c.CreatureType);
        if (c.Subtypes != null && !c.Subtypes.isEmpty())
            meta.append(" (").append(String.join(", ", c.Subtypes)).append(")");
        if (notEmpty(c.Alignment))    meta.append(", ").append(c.Alignment);
        if (!meta.isEmpty())          sb.append(meta).append("\n");

        sb.append("\u2500".repeat(52)).append("\n");
        sb.append(String.format("CR: %-8s  XP: %,d%n", c.CR, c.XP));
        sb.append(String.format("AC: %-8d  HP: %d%s%n", c.AC, c.HP,
                notEmpty(c.HitDice) ? "  (" + c.HitDice + ")" : ""));

        StringBuilder speed = new StringBuilder("Speed: ").append(c.Speed).append(" ft.");
        if (c.FlySpeed    > 0) speed.append(", fly ").append(c.FlySpeed).append(" ft.");
        if (c.SwimSpeed   > 0) speed.append(", swim ").append(c.SwimSpeed).append(" ft.");
        if (c.ClimbSpeed  > 0) speed.append(", climb ").append(c.ClimbSpeed).append(" ft.");
        if (c.BurrowSpeed > 0) speed.append(", burrow ").append(c.BurrowSpeed).append(" ft.");
        sb.append(speed).append("\n");

        sb.append("\u2500".repeat(52)).append("\n");
        sb.append(String.format("STR %-3d  DEX %-3d  CON %-3d  INT %-3d  WIS %-3d  CHA %-3d%n",
                c.Str, c.Dex, c.Con, c.Intel, c.Wis, c.Cha));
        sb.append("\u2500".repeat(52)).append("\n");

        appendLine(sb, "Saves",       c.SavingThrows);
        appendLine(sb, "Skills",      c.Skills);
        appendLine(sb, "Immunities",  c.DamageImmunities);
        appendLine(sb, "Resistances", c.DamageResistances);
        appendLine(sb, "Cond.Imm.",   c.ConditionImmunities);
        appendLine(sb, "Senses",      c.Senses);
        appendLine(sb, "Languages",   c.Languages);
        if (c.LegendaryActionCount > 0)
            sb.append(String.format("Legendary    %d actions%n", c.LegendaryActionCount));

        appendActions(sb, "Traits",            c.Traits);
        appendActions(sb, "Actions",           c.Actions);
        appendActions(sb, "Bonus Actions",     c.BonusActions);
        appendActions(sb, "Reactions",         c.Reactions);
        appendActions(sb, "Legendary Actions", c.LegendaryActions);

        return sb.toString();
    }

    private static void appendLine(StringBuilder sb, String label, String value) {
        if (!notEmpty(value)) return;
        sb.append(String.format("%-14s %s%n", label, value));
    }

    private static void appendActions(StringBuilder sb, String label, List<Creature.Action> list) {
        if (list == null || list.isEmpty()) return;
        sb.append("\n[ ").append(label).append(" ]\n");
        for (Creature.Action a : list) {
            sb.append("\u2022 ").append(a.Name).append("\n");
            if (notEmpty(a.Description)) {
                String[] words = a.Description.split(" ");
                StringBuilder line = new StringBuilder("  ");
                for (String w : words) {
                    if (line.length() + w.length() + 1 > 70) {
                        sb.append(line).append("\n");
                        line = new StringBuilder("  ");
                    }
                    if (line.length() > 2) line.append(" ");
                    line.append(w);
                }
                if (line.length() > 2) sb.append(line).append("\n");
            }
        }
    }

    private static boolean notEmpty(String s) { return s != null && !s.isBlank(); }
}
