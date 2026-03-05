package importer.dev;

import entities.Creature;
import importer.CrawlerHttpUtils;
import importer.HtmlStatBlockParser;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Properties;

/**
 * Validiert HtmlStatBlockParser gegen 5 live Monster von DnD Beyond.
 * Schreibt keine Dateien — reine In-Memory-Verifikation.
 *
 * No JavaFX dependency — compile and run without --module-path.
 *
 * Compile + Run:
 *   javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/dev/DevStatBlockHarness.java
 *   java  -cp "out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" importer.dev.DevStatBlockHarness
 */
public class DevStatBlockHarness {

    public static void main(String[] args) throws Exception {
        Properties props = CrawlerHttpUtils.loadCrawlerProperties();
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty()) {
            System.err.println("cobalt.session fehlt in crawler.properties");
            System.exit(1);
        }
        long delayMs = CrawlerHttpUtils.parseDelayMs(props);

        // 5 Testmonster: mix aus old/new format, einfach/komplex, mit/ohne Legendary
        String[] slugs = {
            "16907-goblin",               // OLD: einfach, kein Legendary
            "16943-lich",                 // OLD: Legendary Actions (count=3)
            "5195047-goblin-boss",        // NEW: einfachster NEW-Fall
            "5194869-adult-black-dragon", // NEW: Legendary, Lair-Note im XP, fly+swim
            "5194887-ancient-red-dragon", // NEW: Multiattack, Breath Weapon (Recharge), komplex
        };

        HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

        int ok = 0;
        int fail = 0;

        for (String slug : slugs) {
            System.out.println("=".repeat(70));
            System.out.println("SLUG: " + slug);

            String body;
            try {
                body = CrawlerHttpUtils.get("https://www.dndbeyond.com/monsters/" + slug, http, session);
            } catch (Exception e) {
                System.err.println("  ÜBERSPRUNGEN: " + e.getMessage());
                fail++;
                continue;
            }
            System.out.println("HTTP: 200");

            Document page = Jsoup.parse(body);
            if (HtmlStatBlockParser.findStatBlock(page) == null) {
                System.err.println("  ERROR: No stat block element found");
                fail++;
                continue;
            }

            try {
                Creature c = HtmlStatBlockParser.parse(page);
                print(c);
                ok++;
            } catch (Exception e) {
                System.err.println("  PARSE ERROR: " + e.getMessage());
                e.printStackTrace(); // extra detail for manual debugging
                fail++;
            }

            System.out.println();
            Thread.sleep(delayMs);
        }

        System.out.println("=".repeat(70));
        System.out.printf("Result: %d OK, %d failed%n", ok, fail);
    }

    private static void print(Creature c) {
        System.out.printf("Name:        %s%n", c.Name);
        System.out.printf("Size/Type:   %s %s (%s)%n", c.Size, c.CreatureType, String.join(", ", c.Subtypes));
        System.out.printf("Alignment:   %s%n", c.Alignment);
        System.out.printf("CR/XP:       %s / %d XP%n", c.CR, c.XP);
        System.out.printf("AC:          %d  (%s)%n", c.AC, c.AcNotes);
        System.out.printf("HP:          %d  (%s)%n", c.HP, c.HitDice);
        System.out.printf("Speed:       walk=%d fly=%d swim=%d climb=%d burrow=%d%n",
                c.Speed, c.FlySpeed, c.SwimSpeed, c.ClimbSpeed, c.BurrowSpeed);
        System.out.printf("Abilities:   STR%d DEX%d CON%d INT%d WIS%d CHA%d%n",
                c.Str, c.Dex, c.Con, c.Intel, c.Wis, c.Cha);
        System.out.printf("Initiative:  %+d   PB: +%d%n", c.InitiativeBonus, c.ProficiencyBonus);
        System.out.printf("Saves:       %s%n", c.SavingThrows);
        System.out.printf("Skills:      %s%n", c.Skills);
        System.out.printf("Resistances: %s%n", c.DamageResistances);
        System.out.printf("Immunities:  %s%n", c.DamageImmunities);
        System.out.printf("CondImm:     %s%n", c.ConditionImmunities);
        System.out.printf("Senses:      %s  PP=%d%n", c.Senses, c.PassivePerception);
        System.out.printf("Languages:   %s%n", c.Languages);
        System.out.printf("Legendary:   count=%d%n", c.LegendaryActionCount);
        printActions("Traits",    c.Traits);
        printActions("Actions",   c.Actions);
        printActions("Bonus",     c.BonusActions);
        printActions("Reactions", c.Reactions);
        printActions("Legendary", c.LegendaryActions);
    }

    private static void printActions(String label, List<Creature.Action> list) {
        if (list == null || list.isEmpty()) return;
        System.out.printf("  [%s] %d Einträge:%n", label, list.size());
        for (Creature.Action a : list) {
            // 80 chars: action descriptions are short by D&D convention; item descriptions use 150.
            String desc = a.Description != null && a.Description.length() > 80
                ? a.Description.substring(0, 80) + "..."
                : a.Description;
            System.out.printf("    • %s → %s%n", a.Name, desc);
        }
    }
}
