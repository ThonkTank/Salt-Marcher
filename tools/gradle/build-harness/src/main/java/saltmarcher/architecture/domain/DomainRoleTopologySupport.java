package saltmarcher.architecture.domain;

import java.util.List;
import saltmarcher.architecture.SourceFile;

public final class DomainRoleTopologySupport {

    private DomainRoleTopologySupport() {
    }

    public static boolean isDomainSource(SourceFile sourceFile) {
        return isDomainSource(sourceFile.relativeSegments());
    }

    public static boolean isDomainSource(List<String> segments) {
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1));
    }

    public static boolean isModelRoleDirectFile(List<String> segments, String role) {
        return segments.size() == 7
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "model".equals(segments.get(3))
                && role.equals(segments.get(5));
    }

    public static boolean isModelRoleSource(SourceFile sourceFile, String role) {
        return isModelRoleSource(sourceFile.relativeSegments(), role);
    }

    public static boolean isModelRoleSource(List<String> segments, String role) {
        return segments.size() >= 7
                && "src".equals(segments.get(0))
                && "domain".equals(segments.get(1))
                && "model".equals(segments.get(3))
                && role.equals(segments.get(5));
    }

    public static boolean hasRoleSuffix(SourceFile sourceFile, String suffix) {
        return sourceFile.fileName().endsWith(suffix + ".java");
    }
}
