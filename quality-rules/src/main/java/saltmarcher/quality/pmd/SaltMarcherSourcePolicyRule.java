package saltmarcher.quality.pmd;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherSourcePolicyRule extends AbstractJavaRule {

    private static final Set<String> DOMAIN_BANNED_TOKENS = Set.of(
            "javafx.",
            "javax.json",
            "jakarta.json",
            "com.fasterxml.jackson",
            "org.json",
            "java.sql.",
            "javax.sql.",
            "java.net.http",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file."
    );

    private static final Set<String> VIEW_LEGACY_SHELL_TYPES = Set.of(
            "shell.host.AppShell",
            "shell.host.AppView",
            "shell.host.ShellServices",
            "shell.panel.DetailsNavigator",
            "shell.panel.SceneRegistry",
            "shell.host.InspectorPane",
            "shell.panel.ScenePane",
            "shell.host.RuntimeStatePane"
    );

    private static final Set<String> LEGACY_PERSISTENCE_TYPES = Set.of(
            "shell.host.RuntimeServiceProvider",
            "shell.host.RuntimeServiceRegistry"
    );

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()) {
            return data;
        }

        if (sourceFacts.text().contains("setStyle(")) {
            asCtx(data).addViolationWithMessage(node,
                    "Inline JavaFX styling via setStyle(...) is forbidden. Define styling in a stylesheet under resources/ instead.");
        }

        if (sourceFacts.isViewSource()) {
            for (String legacyType : VIEW_LEGACY_SHELL_TYPES) {
                if (sourceFacts.text().contains(legacyType)) {
                    asCtx(data).addViolationWithMessage(node,
                            "View code must not use legacy shell wiring type '" + legacyType + "'.");
                }
            }
        }

        if (sourceFacts.isDomainSource()) {
            for (String token : DOMAIN_BANNED_TOKENS) {
                if (sourceFacts.text().contains(token)) {
                    asCtx(data).addViolationWithMessage(node,
                            "Domain code must not reference '" + token + "'.");
                }
            }
        }

        for (String legacyType : LEGACY_PERSISTENCE_TYPES) {
            if (sourceFacts.text().contains(legacyType)) {
                asCtx(data).addViolationWithMessage(node,
                        "Legacy runtime-service persistence wiring is forbidden. Use shell.host.PersistenceContribution and shell.host.PersistenceRegistry instead.");
            }
        }

        return data;
    }
}
