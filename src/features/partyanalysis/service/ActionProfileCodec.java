package features.partyanalysis.service;

import java.util.ArrayList;
import java.util.List;

final class ActionProfileCodec {
    private ActionProfileCodec() {
        throw new AssertionError("No instances");
    }

    static String encodeMultiattackProfile(List<MultiattackComponent> components) {
        if (components == null || components.isEmpty()) {
            return null;
        }
        List<String> encoded = new ArrayList<>();
        for (MultiattackComponent component : components) {
            if (component == null || component.actionId() <= 0 || component.count() <= 0) {
                continue;
            }
            encoded.add(component.actionId() + "x" + component.count());
        }
        return encoded.isEmpty() ? null : String.join(";", encoded);
    }

    static List<MultiattackComponent> decodeMultiattackProfile(String profile) {
        if (profile == null || profile.isBlank()) {
            return List.of();
        }
        List<MultiattackComponent> components = new ArrayList<>();
        for (String token : profile.split(";")) {
            if (token.isBlank()) {
                continue;
            }
            int split = token.indexOf('x');
            if (split <= 0 || split >= token.length() - 1) {
                continue;
            }
            try {
                long actionId = Long.parseLong(token.substring(0, split));
                int count = Integer.parseInt(token.substring(split + 1));
                if (actionId > 0 && count > 0) {
                    components.add(new MultiattackComponent(actionId, count));
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return List.copyOf(components);
    }

    static String encodeSpellOptions(List<EncodedSpellOption> spellOptions) {
        if (spellOptions == null || spellOptions.isEmpty()) {
            return null;
        }
        List<String> encoded = new ArrayList<>();
        for (EncodedSpellOption option : spellOptions) {
            if (option == null) {
                continue;
            }
            encoded.add(safe(option.poolKey())
                    + "|" + option.spellLevel()
                    + "|" + safe(option.castingChannel())
                    + "|" + option.expectedDamagePerUse()
                    + "|" + (option.maxUses() == null ? "" : option.maxUses()));
        }
        return encoded.isEmpty() ? null : String.join(";", encoded);
    }

    static List<EncodedSpellOption> decodeSpellOptions(String profile) {
        if (profile == null || profile.isBlank()) {
            return List.of();
        }
        List<EncodedSpellOption> options = new ArrayList<>();
        for (String token : profile.split(";")) {
            if (token.isBlank()) {
                continue;
            }
            String[] parts = token.split("\\|", -1);
            if (parts.length < 5) {
                continue;
            }
            try {
                options.add(new EncodedSpellOption(
                        parts[0],
                        Integer.parseInt(parts[1]),
                        parts[2],
                        Double.parseDouble(parts[3]),
                        parts[4].isBlank() ? null : Integer.parseInt(parts[4])));
            } catch (NumberFormatException ignored) {
            }
        }
        return List.copyOf(options);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    record MultiattackComponent(long actionId, int count) {}

    record EncodedSpellOption(
            String poolKey,
            int spellLevel,
            String castingChannel,
            double expectedDamagePerUse,
            Integer maxUses
    ) {}
}
