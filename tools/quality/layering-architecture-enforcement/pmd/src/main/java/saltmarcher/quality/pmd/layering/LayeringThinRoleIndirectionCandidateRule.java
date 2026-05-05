package saltmarcher.quality.pmd.layering;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.indirection.CeremonialIndirectionSupport;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class LayeringThinRoleIndirectionCandidateRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        CeremonialIndirectionSupport.Role role =
                CeremonialIndirectionSupport.candidateRole(sourceFacts).orElse(null);
        if (role == null) {
            return data;
        }

        CeremonialIndirectionSupport.Analysis analysis =
                CeremonialIndirectionSupport.analyze(node, sourceFacts);
        if (!analysis.ceremonial()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(node,
                "Thin-role indirection candidate [" + role.label() + "] '" + sourceFacts.relativePath()
                        + "': all non-constructor methods merely "
                        + String.join(", ", analysis.trivialDescriptions())
                        + "; report-only because " + role.reportOnlyReason() + ".");
        return data;
    }
}
