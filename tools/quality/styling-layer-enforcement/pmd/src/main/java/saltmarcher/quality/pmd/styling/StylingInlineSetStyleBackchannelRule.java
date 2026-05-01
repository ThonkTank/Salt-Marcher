package saltmarcher.quality.pmd.styling;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class StylingInlineSetStyleBackchannelRule extends AbstractJavaRule {

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

        return data;
    }
}
