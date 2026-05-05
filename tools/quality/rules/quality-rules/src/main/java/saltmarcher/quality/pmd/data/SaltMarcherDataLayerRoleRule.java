package saltmarcher.quality.pmd.data;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.JavaSourceTextSupport;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class SaltMarcherDataLayerRoleRule extends AbstractJavaRule {
    private static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()) {
            return data;
        }

        // Repository/ and query/ role checks are bundle-owned now. The shared
        // data-layer PMD rule stays limited to the feature-root composition
        // role.
        if (sourceFacts.isDataRoot()) {
            validateNoConcreteSourceMechanics(node, data, sourceFacts);
        }
        return data;
    }

    private void validateNoConcreteSourceMechanics(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts
    ) {
        String codeText = JavaSourceTextSupport.stripCommentsAndStrings(sourceFacts.text());
        for (String token : CONCRETE_SOURCE_TOKENS) {
            if (codeText.contains(token)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data composition adapter code must not own concrete source mechanics such as '"
                                + token + "'. Move source-specific work into a source adapter under gateway/.");
            }
        }
    }
}
