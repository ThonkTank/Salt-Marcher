package saltmarcher.quality.pmd.data;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataQueryNoSourceMechanicsRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots() || !DataQueryPmdSupport.isQuery(sourceFacts)) {
            return data;
        }

        String sanitizedSourceText = DataQueryPmdSupport.codeTextWithoutCommentsAndStrings(sourceFacts.text());
        for (String token : DataQueryPmdSupport.CONCRETE_SOURCE_TOKENS) {
            if (sanitizedSourceText.contains(token)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data query/ code must not own concrete source mechanics such as '"
                                + token + "'. Move source-specific work into a source adapter under gateway/.");
            }
        }
        return data;
    }
}
