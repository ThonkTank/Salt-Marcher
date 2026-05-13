package saltmarcher.quality.pmd.support;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

public final class SaltMarcherSourceFacts {
    static final Pattern REGISTRATION_SPEC_METHOD_PATTERN =
            Pattern.compile("\\bShellContributionSpec\\s+registrationSpec\\s*\\(\\s*\\)");
    static final Pattern BIND_METHOD_PATTERN =
            Pattern.compile("\\bShellBinding\\s+bind\\s*\\(\\s*(?:final\\s+)?(?:shell\\.api\\.)?ShellRuntimeContext\\s+\\w+\\s*\\)");
    static final Pattern SERVICE_REGISTER_METHOD_PATTERN =
            Pattern.compile("\\bvoid\\s+register\\s*\\(\\s*(?:final\\s+)?(?:shell\\.api\\.)?ServiceRegistry\\.Builder\\s+\\w+\\s*\\)");
    static final Pattern SHELL_SLOT_USAGE_PATTERN =
            Pattern.compile("\\bShellSlot\\.([A-Z_]+)\\b");
    static final Pattern INSTANCE_FIELD_DECLARATION_PATTERN =
            Pattern.compile("(?m)^ {4}(?:private|protected|public)\\s+(?!static\\b)(?!final\\s+class\\b)(?!class\\b|interface\\b|enum\\b|record\\b)[^\\n;()]+;");
    static final Pattern EXPOSED_EXECUTABLE_DECLARATION_PATTERN =
            Pattern.compile("(?m)^ {4}(?:public|protected)\\s+[^\\n=;{}]*\\(");
    static final Pattern IMPORT_PATTERN =
            Pattern.compile("(?m)^\\s*import\\s+([^;]+);");
    static final Pattern SERVICE_REGISTER_CALL_PATTERN =
            Pattern.compile("\\bregister\\s*\\(\\s*([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\.class\\s*,");
    static final Pattern NEW_TYPE_PATTERN =
            Pattern.compile("\\bnew\\s+([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\(");
    private static final Set<String> ACTIVE_VIEW_AREAS = Set.of("leftbartabs", "statetabs", "dropdowns");
    private static final Set<String> SLOTCONTENT_SLOTS = Set.of(
            "controls", "main", "state", "details", "topbar", "primitives");

    private final String absolutePath;
    private final String relativePath;
    private final List<String> segments;
    private final String fileName;
    private final String simpleName;
    private final String text;
    private final ViewUnitKind viewUnitKind;
    private final ViewRole viewRole;
    private final boolean recognizedViewSource;

    private SaltMarcherSourceFacts(String absolutePath, String relativePath, List<String> segments, String fileName, String text) {
        this.absolutePath = absolutePath;
        this.relativePath = relativePath;
        this.segments = segments;
        this.fileName = fileName;
        this.simpleName = fileName.endsWith(".java") ? fileName.substring(0, fileName.length() - 5) : fileName;
        this.text = text;
        this.viewUnitKind = classifyViewUnitKind();
        this.viewRole = ViewRole.fromFileName(fileName);
        this.recognizedViewSource = viewUnitKind != ViewUnitKind.NONE && viewRole.isAllowedIn(viewUnitKind);
    }

    public static SaltMarcherSourceFacts from(ASTCompilationUnit node) {
        TextDocument textDocument = node.getAstInfo().getTextDocument();
        String absolutePath = textDocument.getFileId().getAbsolutePath().replace('\\', '/');
        String relativePath = relativizeToSourceRoot(absolutePath);
        List<String> segments = List.of(relativePath.split("/"));
        return new SaltMarcherSourceFacts(absolutePath, relativePath, segments, segments.get(segments.size() - 1), textDocument.getText().toString());
    }

    private static String relativizeToSourceRoot(String absolutePath) {
        Path normalizedPath = Paths.get(absolutePath).normalize();
        int nameCount = normalizedPath.getNameCount();
        for (int index = 0; index < nameCount; index++) {
            String segment = normalizedPath.getName(index).toString();
            if (segment.equals("bootstrap") || segment.equals("shell") || segment.equals("src")) {
                return normalizedPath.subpath(index, nameCount).toString().replace('\\', '/');
            }
        }
        return normalizedPath.toString().replace('\\', '/');
    }

    public String absolutePath() {
        return absolutePath;
    }

    public String relativePath() {
        return relativePath;
    }

    public String fileName() {
        return fileName;
    }

    public String simpleName() {
        return simpleName;
    }

    public String text() {
        return text;
    }

    public boolean isUnderMainSourceRoots() {
        return startsWith("bootstrap") || startsWith("shell") || startsWith("src");
    }

    public boolean isViewSource() {
        return startsWith("src", "view");
    }

    public boolean isViewBinderSource() {
        return viewUnitKind == ViewUnitKind.ACTIVE_ROOT && viewRole == ViewRole.BINDER;
    }

    public boolean isViewSupportModelSource() {
        return false;
    }

    public boolean isViewIntentHandlerSource() {
        return viewUnitKind == ViewUnitKind.ACTIVE_ROOT && viewRole == ViewRole.INTENT_HANDLER;
    }

    public boolean isViewPublishedEventSource() {
        return viewUnitKind == ViewUnitKind.ACTIVE_ROOT && viewRole == ViewRole.PUBLISHED_EVENT;
    }

    public boolean isViewInputEventSource() {
        return viewUnitKind != ViewUnitKind.NONE && viewRole == ViewRole.VIEW_INPUT_EVENT;
    }

    public boolean isViewModelSource() {
        return viewUnitKind != ViewUnitKind.NONE
                && (viewRole == ViewRole.LEGACY_VIEW_MODEL
                || viewRole == ViewRole.CONTRIBUTION_MODEL
                || viewRole == ViewRole.CONTENT_MODEL);
    }

    public boolean isViewPanelSource() {
        return viewUnitKind != ViewUnitKind.NONE && viewRole == ViewRole.VIEW;
    }

    public boolean isRecognizedViewSource() {
        return recognizedViewSource;
    }

    public boolean isKnownForbiddenViewRoleSource() {
        return isViewSource()
                && viewUnitKind != ViewUnitKind.NONE
                && !recognizedViewSource
                && viewRole != ViewRole.UNKNOWN;
    }

    public boolean isUnknownViewRoleSource() {
        return isViewSource()
                && viewUnitKind != ViewUnitKind.NONE
                && viewRole == ViewRole.UNKNOWN;
    }

    public boolean isMisplacedViewSource() {
        return isViewSource() && viewUnitKind == ViewUnitKind.NONE;
    }

    public boolean isLegacyViewSource() {
        return isViewSource() && !recognizedViewSource;
    }

    private boolean isDiscoverableViewContributionRole() {
        return viewUnitKind == ViewUnitKind.ACTIVE_ROOT && viewRole == ViewRole.CONTRIBUTION;
    }

    private boolean isActiveViewRootSource() {
        return viewUnitKind == ViewUnitKind.ACTIVE_ROOT;
    }

    private boolean isSlotcontentSource() {
        return viewUnitKind == ViewUnitKind.REUSABLE_SLOTCONTENT;
    }

    private boolean isDiscoverableViewContributionArea() {
        return isActiveViewRootSource();
    }

    private ViewUnitKind classifyViewUnitKind() {
        if (!isViewSource()) {
            return ViewUnitKind.NONE;
        }
        if (segments.size() == 5 && ACTIVE_VIEW_AREAS.contains(segments.get(2))) {
            return ViewUnitKind.ACTIVE_ROOT;
        }
        if (segments.size() == 6
                && "slotcontent".equals(segments.get(2))
                && SLOTCONTENT_SLOTS.contains(segments.get(3))) {
            return ViewUnitKind.REUSABLE_SLOTCONTENT;
        }
        return ViewUnitKind.NONE;
    }

    public boolean isDomainSource() {
        return startsWith("src", "domain");
    }

    public boolean isDomainRoot() {
        return isDomainSource() && segments.size() == 4;
    }

    public boolean isDomainApplicationSource() {
        return isDomainSource() && segments.size() >= 5 && segments.get(3).equals("application");
    }

    public boolean isDomainApplicationServiceRootSource() {
        return isDomainRoot() && simpleName.endsWith("ApplicationService");
    }

    public boolean isDomainUseCaseSource() {
        return isDomainApplicationSource() && simpleName.endsWith("UseCase");
    }

    public boolean isNamedDomainModuleSource() {
        return isDomainSource()
                && segments.size() >= 5
                && !Set.of("published", "application").contains(segments.get(3));
    }

    public boolean isDomainServiceSource() {
        return isNamedDomainRoleSource("service");
    }

    public boolean isDomainPolicySource() {
        return isNamedDomainRoleSource("policy");
    }

    public boolean isDomainFactorySource() {
        return isNamedDomainRoleSource("factory");
    }

    public boolean isDataSource() {
        return startsWith("src", "data");
    }

    public boolean isDataRoot() {
        return isDataSource() && segments.size() == 4;
    }

    public boolean isDataServiceContributionSource() {
        return isDataRoot() && simpleName.endsWith("ServiceContribution");
    }

    public boolean isDataModel() {
        return startsWith("src", "data") && segments.size() >= 5 && segments.get(3).equals("model");
    }

    public boolean isDataPersistenceSchemaSource() {
        return isDataModel() && isExpectedPersistenceSchemaFileName();
    }

    public boolean isDataSourceModelRecordSource() {
        return isDataModel() && simpleName.endsWith("Record");
    }

    public boolean isDomainPublishedSource() {
        return isDomainSource() && segments.size() >= 5 && segments.get(3).equals("published");
    }

    public String featureName() {
        if (startsWith("src", "view") || startsWith("src", "domain") || startsWith("src", "data")) {
            if (startsWith("src", "view") && segments.size() >= 4) {
                return segments.get(3);
            }
            return segments.size() >= 3 ? segments.get(2) : "";
        }
        return "";
    }

    public Set<String> usedShellSlots() {
        Matcher matcher = SHELL_SLOT_USAGE_PATTERN.matcher(text);
        Set<String> result = new LinkedHashSet<>();
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result;
    }

    public boolean hasExplicitPublicFinalClass() {
        return text.contains("public final class " + simpleName);
    }

    public boolean hasExplicitPublicNoArgConstructor() {
        return text.contains("public " + simpleName + "()");
    }

    public boolean hasRegistrationSpecMethod() {
        return REGISTRATION_SPEC_METHOD_PATTERN.matcher(text).find();
    }

    public boolean hasBindMethod() {
        return BIND_METHOD_PATTERN.matcher(text).find();
    }

    public boolean implementsType(String qualifiedType) {
        String classHeader = topLevelClassHeader();
        if (classHeader.isBlank() || !classHeader.contains("implements")) {
            return false;
        }
        String suffix = classHeader.substring(classHeader.indexOf("implements") + "implements".length());
        String trimmedQualifiedType = qualifiedType.trim();
        String simpleName = trimmedQualifiedType.substring(trimmedQualifiedType.lastIndexOf('.') + 1);
        for (String token : suffix.split(",")) {
            String candidate = token.replace("{", "").trim();
            if (candidate.isBlank()) {
                continue;
            }
            String resolved = resolveTypeLiteral(candidate);
            if (trimmedQualifiedType.equals(resolved) || simpleName.equals(candidate)) {
                return true;
            }
        }
        return false;
    }

    public List<String> constructedTypes() {
        Matcher matcher = NEW_TYPE_PATTERN.matcher(text);
        List<String> constructedTypes = new ArrayList<>();
        while (matcher.find()) {
            constructedTypes.add(resolveTypeLiteral(matcher.group(1)));
        }
        return constructedTypes;
    }

    public boolean hasInstanceFields() {
        return topLevelMemberDeclarations().stream()
                .anyMatch(line -> INSTANCE_FIELD_DECLARATION_PATTERN.matcher(line).find());
    }

    public List<String> exposedExecutableDeclarations() {
        List<String> declarations = new ArrayList<>();
        for (String line : topLevelMemberDeclarations()) {
            Matcher matcher = EXPOSED_EXECUTABLE_DECLARATION_PATTERN.matcher(line);
            if (matcher.find()) {
                declarations.add(matcher.group().trim());
            }
        }
        return declarations;
    }

    private List<String> topLevelMemberDeclarations() {
        String body = topLevelClassBody();
        List<String> declarations = new ArrayList<>();
        int depth = 1;
        for (String line : body.split("\\R")) {
            String stripped = line.strip();
            if (depth == 1 && isMemberDeclarationStart(stripped)) {
                declarations.add(stripped);
            }
            depth = updateBraceDepth(line, depth);
        }
        return declarations;
    }

    private String topLevelClassBody() {
        int classIndex = text.indexOf("public final class " + simpleName);
        if (classIndex < 0) {
            return text;
        }
        int bodyStart = text.indexOf('{', classIndex);
        if (bodyStart < 0) {
            return "";
        }
        int depth = 0;
        for (int index = bodyStart; index < text.length(); index++) {
            char character = text.charAt(index);
            if (character == '{') {
                depth++;
            } else if (character == '}') {
                depth--;
                if (depth == 0) {
                    return text.substring(bodyStart + 1, index);
                }
            }
        }
        return text.substring(bodyStart + 1);
    }

    private String topLevelClassHeader() {
        int classIndex = text.indexOf("public final class " + simpleName);
        if (classIndex < 0) {
            return "";
        }
        int bodyStart = text.indexOf('{', classIndex);
        if (bodyStart < 0) {
            return text.substring(classIndex);
        }
        return text.substring(classIndex, bodyStart);
    }

    private static boolean isMemberDeclarationStart(String line) {
        return line.startsWith("public ")
                || line.startsWith("protected ")
                || line.startsWith("private ");
    }

    private static int updateBraceDepth(String line, int currentDepth) {
        int depth = currentDepth;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < line.length(); index++) {
            char character = line.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character == '\\') {
                escaped = inString || inChar;
                continue;
            }
            if (character == '"' && !inChar) {
                inString = !inString;
                continue;
            }
            if (character == '\'' && !inString) {
                inChar = !inChar;
                continue;
            }
            if (inString || inChar) {
                continue;
            }
            if (character == '{') {
                depth++;
            } else if (character == '}') {
                depth--;
            }
        }
        return Math.max(0, depth);
    }

    public boolean hasServiceRegisterMethod() {
        return SERVICE_REGISTER_METHOD_PATTERN.matcher(text).find();
    }

    public List<String> registeredServiceTypes() {
        Matcher matcher = SERVICE_REGISTER_CALL_PATTERN.matcher(text);
        List<String> serviceTypes = new ArrayList<>();
        while (matcher.find()) {
            serviceTypes.add(resolveTypeLiteral(matcher.group(1)));
        }
        return serviceTypes;
    }

    public String expectedServiceRootFileName() {
        return toPascalCaseSuffix(featureName(), "ServiceContribution") + ".java";
    }

    public boolean isExpectedServiceRootFileName() {
        return isFeatureFileName("ServiceContribution");
    }

    public String expectedPersistenceSchemaFileName() {
        return toPascalCaseSuffix(featureName(), "PersistenceSchema") + ".java";
    }

    public boolean isExpectedPersistenceSchemaFileName() {
        return isFeatureFileName("PersistenceSchema");
    }

    private boolean startsWith(String... prefix) {
        if (segments.size() < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (!segments.get(index).equals(prefix[index])) {
                return false;
            }
        }
        return true;
    }

    private boolean isNamedDomainRoleSource(String roleSegment) {
        return isNamedDomainModuleSource()
                && segments.subList(3, segments.size() - 1).contains(roleSegment);
    }

    static String toPascalCaseSuffix(String featureName, String suffix) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (char character : featureName.toCharArray()) {
            if (!Character.isLetterOrDigit(character)) {
                capitalizeNext = true;
                continue;
            }
            result.append(capitalizeNext ? Character.toUpperCase(character) : character);
            capitalizeNext = false;
        }
        result.append(suffix);
        return result.toString();
    }

    private boolean isFeatureFileName(String suffix) {
        String fullSuffix = suffix + ".java";
        if (!fileName().endsWith(fullSuffix)) {
            return false;
        }
        String prefix = fileName().substring(0, fileName().length() - fullSuffix.length());
        return normalizeFeatureToken(prefix).equals(normalizeFeatureToken(featureName()));
    }

    private static String normalizeFeatureToken(String value) {
        StringBuilder normalized = new StringBuilder();
        for (char character : value.toCharArray()) {
            if (Character.isLetterOrDigit(character)) {
                normalized.append(Character.toLowerCase(character));
            }
        }
        return normalized.toString();
    }

    static List<String> orderedSetOf(String... values) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            result.add(value.toUpperCase(Locale.ROOT));
        }
        return result;
    }

    private String resolveTypeLiteral(String literal) {
        if (literal.startsWith("src.") || literal.startsWith("shell.")) {
            return literal;
        }
        String topLevelName = literal;
        String nestedSuffix = "";
        int nestedSeparator = literal.indexOf('.');
        if (nestedSeparator >= 0 && Character.isUpperCase(literal.charAt(0))) {
            topLevelName = literal.substring(0, nestedSeparator);
            nestedSuffix = literal.substring(nestedSeparator);
        }
        String resolvedTopLevel = resolveSimpleType(topLevelName);
        return resolvedTopLevel == null ? literal : resolvedTopLevel + nestedSuffix;
    }

    private String resolveSimpleType(String simpleName) {
        Map<String, String> explicitImports = explicitImportsBySimpleName();
        if (explicitImports.containsKey(simpleName)) {
            return explicitImports.get(simpleName);
        }
        for (String importedType : importedTypes()) {
            if (importedType.endsWith(".*")) {
                return importedType.substring(0, importedType.length() - 2) + "." + simpleName;
            }
        }
        String packageName = relativePath.replaceAll("/[^/]+\\.java$", "").replace('/', '.');
        return packageName.isBlank() ? simpleName : packageName + "." + simpleName;
    }

    private Map<String, String> explicitImportsBySimpleName() {
        Map<String, String> importsBySimpleName = new LinkedHashMap<>();
        for (String importedType : importedTypes()) {
            if (importedType.endsWith(".*")) {
                continue;
            }
            int separator = importedType.lastIndexOf('.');
            if (separator < 0 || separator == importedType.length() - 1) {
                continue;
            }
            importsBySimpleName.put(importedType.substring(separator + 1), importedType);
        }
        return importsBySimpleName;
    }

    private List<String> importedTypes() {
        Matcher matcher = IMPORT_PATTERN.matcher(text);
        List<String> imports = new ArrayList<>();
        while (matcher.find()) {
            imports.add(matcher.group(1).trim());
        }
        return imports;
    }

    private enum ViewUnitKind {
        NONE,
        ACTIVE_ROOT,
        REUSABLE_SLOTCONTENT
    }

    private enum ViewRole {
        CONTRIBUTION,
        BINDER,
        CONTRIBUTION_MODEL,
        CONTENT_MODEL,
        INTENT_HANDLER,
        VIEW_INPUT_EVENT,
        PUBLISHED_EVENT,
        INSPECTOR_ENTRY,
        LEGACY_VIEW_MODEL,
        PROJECTOR,
        VIEW,
        UNKNOWN;

        private static ViewRole fromFileName(String fileName) {
            if (fileName.endsWith("Contribution.java")) {
                return CONTRIBUTION;
            }
            if (fileName.endsWith("Binder.java")) {
                return BINDER;
            }
            if (fileName.endsWith("ContributionModel.java")) {
                return CONTRIBUTION_MODEL;
            }
            if (fileName.endsWith("ContentModel.java")) {
                return CONTENT_MODEL;
            }
            if (fileName.endsWith("IntentHandler.java")) {
                return INTENT_HANDLER;
            }
            if (fileName.endsWith("ViewInputEvent.java")) {
                return VIEW_INPUT_EVENT;
            }
            if (fileName.endsWith("PublishedEvent.java")) {
                return PUBLISHED_EVENT;
            }
            if (fileName.endsWith("InspectorEntry.java")) {
                return INSPECTOR_ENTRY;
            }
            if (fileName.endsWith("ViewModel.java") || fileName.endsWith("PresentationModel.java")) {
                return LEGACY_VIEW_MODEL;
            }
            if (fileName.endsWith("Projector.java")) {
                return PROJECTOR;
            }
            if (fileName.endsWith("View.java")) {
                return VIEW;
            }
            return UNKNOWN;
        }

        private boolean isAllowedIn(ViewUnitKind unitKind) {
            return switch (unitKind) {
                case NONE -> false;
                case ACTIVE_ROOT -> switch (this) {
                    case CONTRIBUTION, BINDER, CONTRIBUTION_MODEL, INTENT_HANDLER, VIEW_INPUT_EVENT, VIEW -> true;
                    default -> false;
                };
                case REUSABLE_SLOTCONTENT -> switch (this) {
                    case CONTENT_MODEL, VIEW_INPUT_EVENT, VIEW -> true;
                    default -> false;
                };
            };
        }
    }
}
