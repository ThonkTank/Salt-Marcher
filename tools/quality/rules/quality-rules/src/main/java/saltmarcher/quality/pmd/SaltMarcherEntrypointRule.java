package saltmarcher.quality.pmd;

import java.util.List;
import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherEntrypointRule extends AbstractJavaRule {

    private static final Set<String> ALLOWED_SHELL_SLOTS = Set.of(
            "TOP_BAR",
            "COCKPIT_CONTROLS",
            "COCKPIT_MAIN",
            "COCKPIT_DETAILS",
            "COCKPIT_STATE"
    );

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (sourceFacts.isViewRoot()) {
            checkViewRoot(node, data, sourceFacts);
        }
        if (sourceFacts.isDataRoot()) {
            checkPersistenceRoot(node, data, sourceFacts);
        }
        if (sourceFacts.isDataModel() && sourceFacts.fileName().contains("PersistenceSchema")) {
            checkPersistenceSchema(node, data, sourceFacts);
        }
        return data;
    }

    private void checkViewRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedViewRootFileName())) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must be named '" + sourceFacts.expectedViewRootFileName() + "'.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "Root view entrypoint must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node, "Root view entrypoint must declare a public no-arg constructor.");
        }
        if (!sourceFacts.text().contains("ShellViewContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must implement shell.host.ShellViewContribution.");
        }
        if (!sourceFacts.hasRegistrationSpecMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must declare ShellContributionSpec registrationSpec().");
        }
        if (!sourceFacts.hasCreateScreenMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must declare ShellScreen createScreen(ShellRuntimeContext).");
        }
        if (!sourceFacts.hasSlotContentMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must declare ShellScreen.slotContent().");
        }

        ContributionSpecKind specKind = detectContributionSpecKind(sourceFacts.text());
        if (specKind == ContributionSpecKind.UNKNOWN) {
            asCtx(data).addViolationWithMessage(node,
                    "Root view entrypoint must construct exactly one allowed contribution spec type.");
            return;
        }

        Set<String> usedSlots = sourceFacts.usedShellSlots();
        for (String slot : usedSlots) {
            if (!ALLOWED_SHELL_SLOTS.contains(slot)) {
                asCtx(data).addViolationWithMessage(node,
                        "Root view entrypoint uses unsupported shell slot '" + slot + "'.");
            }
        }
        if (sourceFacts.text().contains("defaultLanding") && specKind != ContributionSpecKind.TAB) {
            asCtx(data).addViolationWithMessage(node, "defaultLanding only applies to ShellTabSpec contributions.");
        }
        switch (specKind) {
            case TAB -> validateTabSlots(node, data, usedSlots, sourceFacts.text());
            case TOP_BAR -> {
                if (!usedSlots.equals(Set.of("TOP_BAR"))) {
                    asCtx(data).addViolationWithMessage(node, "ShellTopBarSpec must provide only TOP_BAR content.");
                }
            }
            case RUNTIME_STATE -> {
                if (!usedSlots.equals(Set.of("COCKPIT_STATE"))) {
                    asCtx(data).addViolationWithMessage(node,
                            "ShellRuntimeStateSpec must provide only COCKPIT_STATE content.");
                }
            }
            case UNKNOWN -> {
            }
        }
    }

    private void checkPersistenceRoot(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedPersistenceRootFileName())) {
            asCtx(data).addViolationWithMessage(node,
                    "Root persistence entrypoint must be named '" + sourceFacts.expectedPersistenceRootFileName() + "'.");
        }
        if (!sourceFacts.hasExplicitPublicFinalClass()) {
            asCtx(data).addViolationWithMessage(node, "Root persistence entrypoint must be declared public final.");
        }
        if (!sourceFacts.hasExplicitPublicNoArgConstructor()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root persistence entrypoint must declare a public no-arg constructor.");
        }
        if (!sourceFacts.text().contains("PersistenceContribution")) {
            asCtx(data).addViolationWithMessage(node,
                    "Root persistence entrypoint must implement shell.host.PersistenceContribution.");
        }
        if (!sourceFacts.hasPersistenceRegisterMethod()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root persistence entrypoint must declare register(PersistenceRegistry.Builder).");
        }
    }

    private void checkPersistenceSchema(ASTCompilationUnit node, Object data, SaltMarcherSourceFacts sourceFacts) {
        if (!sourceFacts.fileName().equals(sourceFacts.expectedPersistenceSchemaFileName())) {
            asCtx(data).addViolationWithMessage(node,
                    "Persistence schema must be named '" + sourceFacts.expectedPersistenceSchemaFileName() + "'.");
        }
    }

    private void validateTabSlots(ASTCompilationUnit node, Object data, Set<String> usedSlots, String sourceText) {
        if (!usedSlots.contains("COCKPIT_MAIN")) {
            asCtx(data).addViolationWithMessage(node, "ShellTabSpec must provide COCKPIT_MAIN content.");
        }
        if (usedSlots.contains("TOP_BAR") || usedSlots.contains("COCKPIT_DETAILS")) {
            asCtx(data).addViolationWithMessage(node,
                    "ShellTabSpec must not provide TOP_BAR or COCKPIT_DETAILS content.");
        }
        if (sourceText.contains("ShellTabMode.RUNTIME") && usedSlots.contains("COCKPIT_STATE")) {
            asCtx(data).addViolationWithMessage(node,
                    "ShellTabSpec with ShellTabMode.RUNTIME must not provide COCKPIT_STATE content.");
        }
    }

    private static ContributionSpecKind detectContributionSpecKind(String sourceText) {
        int matches = 0;
        ContributionSpecKind result = ContributionSpecKind.UNKNOWN;
        if (sourceText.contains("new ShellTabSpec(")) {
            matches++;
            result = ContributionSpecKind.TAB;
        }
        if (sourceText.contains("new ShellTopBarSpec(")) {
            matches++;
            result = ContributionSpecKind.TOP_BAR;
        }
        if (sourceText.contains("new ShellRuntimeStateSpec(")) {
            matches++;
            result = ContributionSpecKind.RUNTIME_STATE;
        }
        return matches == 1 ? result : ContributionSpecKind.UNKNOWN;
    }

    private enum ContributionSpecKind {
        TAB,
        TOP_BAR,
        RUNTIME_STATE,
        UNKNOWN
    }
}
