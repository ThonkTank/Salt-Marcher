package saltmarcher.quality.pmd.domain;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.indirection.CeremonialIndirectionSupport;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DomainServiceNoCeremonialIndirectionRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (CeremonialIndirectionSupport.substantiveRole(sourceFacts).orElse(null)
                != CeremonialIndirectionSupport.Role.DOMAIN_SERVICE) {
            return data;
        }

        CeremonialIndirectionSupport.Analysis analysis =
                CeremonialIndirectionSupport.analyze(node, sourceFacts);
        if (!analysis.ceremonial()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(node,
                "Domain service role '" + sourceFacts.relativePath()
                        + "' is ceremonial indirection only: all non-constructor methods merely "
                        + String.join(", ", analysis.trivialDescriptions())
                        + ". Service roles must contribute domain behavior instead of only relaying to "
                        + analysis.collaboratorTarget() + ".");
        return data;
    }
}
