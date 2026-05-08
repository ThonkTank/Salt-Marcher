package saltmarcher.architecture.data.query;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DataQueryForeignPublishedPayloadSurfaceRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        DataQueryPublishedCarrierAnalysis.analyze(context).blockerViolations()
                .forEach(violation -> violations.add(violation.source(), violation.rule(), violation.details()));
    }
}
