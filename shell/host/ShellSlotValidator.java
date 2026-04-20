package shell.host;

import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContributionSpec;
import shell.api.ShellSlot;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellStateTabSpec;
import shell.api.ShellTopBarSpec;

final class ShellSlotValidator {

    private ShellSlotValidator() {
    }

    static ShellSlotContent validate(ShellContributionSpec registrationSpec, ShellBinding binding) {
        ShellSlotContent slotContent = ShellSlotContent.from(binding);
        if (registrationSpec instanceof ShellLeftBarTabSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.COCKPIT_MAIN);
            forbidSlots(slotContent, registrationSpec.key(), ShellSlot.TOP_BAR, ShellSlot.COCKPIT_DETAILS);
            return slotContent;
        }
        if (registrationSpec instanceof ShellTopBarSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.TOP_BAR);
            forbidSlots(slotContent, registrationSpec.key(),
                    ShellSlot.COCKPIT_CONTROLS, ShellSlot.COCKPIT_MAIN, ShellSlot.COCKPIT_DETAILS, ShellSlot.COCKPIT_STATE);
            return slotContent;
        }
        if (registrationSpec instanceof ShellStateTabSpec) {
            requireSlot(slotContent, registrationSpec.key(), ShellSlot.COCKPIT_STATE);
            forbidSlots(slotContent, registrationSpec.key(),
                    ShellSlot.TOP_BAR, ShellSlot.COCKPIT_CONTROLS, ShellSlot.COCKPIT_MAIN, ShellSlot.COCKPIT_DETAILS);
            return slotContent;
        }
        throw new IllegalStateException("Unsupported shell contribution type: " + registrationSpec.getClass().getName());
    }

    private static void requireSlot(ShellSlotContent slotContent, ContributionKey key, ShellSlot requiredSlot) {
        if (!slotContent.contains(requiredSlot)) {
            throw new IllegalArgumentException("Contribution '" + key.value()
                    + "' must provide content for ShellSlot." + requiredSlot.name() + ".");
        }
    }

    private static void forbidSlots(ShellSlotContent slotContent, ContributionKey key, ShellSlot... forbiddenSlots) {
        for (ShellSlot forbiddenSlot : forbiddenSlots) {
            if (slotContent.contains(forbiddenSlot)) {
                throw new IllegalArgumentException("Contribution '" + key.value()
                        + "' must not provide content for ShellSlot." + forbiddenSlot.name() + ".");
            }
        }
    }
}
