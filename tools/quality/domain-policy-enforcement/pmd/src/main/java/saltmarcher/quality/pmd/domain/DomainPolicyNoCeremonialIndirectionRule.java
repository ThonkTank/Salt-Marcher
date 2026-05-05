package saltmarcher.quality.pmd.domain;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DomainPolicyNoCeremonialIndirectionRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!DomainCeremonialIndirectionSupport.isPolicySource(sourceFacts)) {
            return data;
        }

        DomainCeremonialIndirectionSupport.Analysis analysis =
                DomainCeremonialIndirectionSupport.analyze(sourceFacts);
        if (!analysis.ceremonial()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(node,
                "Domain policy role '" + sourceFacts.relativePath()
                        + "' is ceremonial indirection only: all non-constructor methods merely "
                        + String.join(", ", analysis.trivialDescriptions())
                        + ". Policy roles must contribute reusable policy instead of only relaying to "
                        + analysis.collaboratorTarget() + ".");
        return data;
    }
}
