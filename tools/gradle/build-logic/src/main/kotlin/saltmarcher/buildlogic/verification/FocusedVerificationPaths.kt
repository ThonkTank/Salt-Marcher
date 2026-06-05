package saltmarcher.buildlogic.verification

import java.io.File
import java.security.MessageDigest
import org.gradle.api.tasks.util.PatternFilterable
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementUtilityTaskKind
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog

private const val FocusedVerificationPathsProperty = "saltmarcher.focusedVerificationPaths"
private const val FocusedDiagnosticSurfaceIdsProperty = "saltmarcher.focusedDiagnosticSurfaceIds"
private val IgnoredRepositoryScanSegments = setOf(".codex", ".git", ".gradle", "build")
private val BuildLogicSourceRoots = listOf("tools/gradle/build-logic/src/main/kotlin")
private val BuildHarnessSourceRoots = listOf("tools/gradle/build-harness/src/main/java")

data class FocusedVerificationSelection(
    val paths: List<String>,
    val surfaceIds: List<String>
)

object FocusedVerificationPaths {
    fun selection(): FocusedVerificationSelection = FocusedVerificationSelection(
        paths = selectedPathsFromSystem(),
        surfaceIds = selectedSurfaceIdsFromSystem()
    )

    fun selectedPaths(): List<String> = selection().paths

    private fun selectedPathsFromSystem(): List<String> = System.getProperty(FocusedVerificationPathsProperty)
        ?.split(',')
        .orEmpty()
        .map(String::trim)
        .map(::canonicalFocusedPath)
        .filter(String::isNotEmpty)
        .distinct()
        .also { paths ->
            require(paths.none(::isUnsafePath)) {
                "Focused verification paths must be repo-relative paths without '..' or glob syntax."
            }
        }

    fun propertyInput(selection: FocusedVerificationSelection = selection()): String = selection.paths.joinToString(",")

    fun hasSelection(selection: FocusedVerificationSelection = selection()): Boolean = selection.paths.isNotEmpty()

    fun focusedOutputKey(selection: FocusedVerificationSelection = selection()): String? {
        if (selection.paths.isEmpty()) {
            return null
        }
        val digest = MessageDigest.getInstance("SHA-256")
        selection.paths.sorted().forEach { path -> digest.update("path:$path\n".toByteArray()) }
        selection.surfaceIds.sorted().forEach { surfaceId -> digest.update("surface:$surfaceId\n".toByteArray()) }
        val hash = digest.digest()
            .take(6)
            .joinToString("") { byte -> "%02x".format(byte) }
        return "focused-$hash"
    }

    fun validateSelection(
        repoRootDir: File,
        activeDescriptors: List<EnforcementBundleDescriptor>,
        selection: FocusedVerificationSelection = selection()
    ) {
        if (selection.paths.isEmpty()) {
            return
        }

        val repoRoot = repoRootDir.canonicalFile
        val allowedRoots = allowedSourceRoots(activeDescriptors, selection)
        val selectedSurfaceRoots = selectedSurfaceRoots(activeDescriptors, selection)
        val inputSpecs = focusedInputSpecs(activeDescriptors)
        require(inputSpecs.isNotEmpty()) {
            "Focused verification paths require a selected filter-aware verification surface."
        }
        selectedSurfaceRoots.forEach { (surfaceId, roots) ->
            require(selection.paths.any { path -> pathIsUnderAnyRoot(repoRoot, path, roots) }) {
                "Focused verification surface '$surfaceId' has no focused path under its allowed roots: " +
                    roots.joinToString(", ") + "."
            }
        }

        selection.paths.forEach { path ->
            val selectedDirectory = File(repoRoot, path).canonicalFile
            require(selectedDirectory.toPath().startsWith(repoRoot.toPath())) {
                "Focused verification path '$path' must stay inside the repository root."
            }
            require(selectedDirectory.exists()) {
                "Focused verification path '$path' does not exist."
            }
            require(selectedDirectory.isDirectory) {
                "Focused verification path '$path' must be a package or resource directory, not a file."
            }
            require(allowedRoots.any { root -> selectedDirectoryIsUnderRoot(repoRoot, selectedDirectory, root) }) {
                "Focused verification path '$path' is outside the selected focused surface roots: " +
                    allowedRoots.joinToString(", ") + "."
            }
            require(pathContainsFocusedInput(repoRoot, selectedDirectory, inputSpecs)) {
                "Focused verification path '$path' does not contain inputs for the selected verification surface."
            }
        }
    }

    fun configureDefaultSourceFilter(filter: PatternFilterable, defaultIncludes: List<String>) {
        defaultIncludes.forEach(filter::include)
        filter.exclude("**/build/**")
    }

    fun configureFocusedSourceFilter(
        filter: PatternFilterable,
        sourceRoots: List<String>,
        selection: FocusedVerificationSelection = selection()
    ) {
        val focusedIncludes = sourceRootRelativeIncludes(sourceRoots, selection)
        if (focusedIncludes.isEmpty()) {
            if (hasSelection(selection)) {
                filter.include("__saltmarcher_no_focused_inputs__")
            }
            return
        }
        focusedIncludes.forEach(filter::include)
    }

    fun configureFocusedCompileSourceFilter(
        filter: PatternFilterable,
        sourceRoots: List<String>,
        defaultIncludes: List<String>,
        selection: FocusedVerificationSelection = selection()
    ) {
        configureFocusedSourceFilter(filter, sourceRoots, selection)
        if (hasSelection(selection) && selectionContainsPathUnderAnyRoot(sourceRoots, selection)) {
            defaultIncludes
                .filter(::isSupportSeamInclude)
                .forEach(filter::include)
        }
    }

    fun errorProneExcludedPathsPattern(selection: FocusedVerificationSelection = selection()): String? {
        if (selection.paths.isEmpty()) {
            return null
        }
        val includedPathExpression = selection.paths
            .joinToString("|") { path -> Regex.escape(path) }
        return "^(?!.*(^|/)($includedPathExpression)(/|$)).*"
    }

    fun configureClassFileFilter(
        filter: PatternFilterable,
        sourceRoots: List<String>,
        selection: FocusedVerificationSelection = selection()
    ) {
        selection.paths
            .filter { path ->
                sourceRoots.any { sourceRoot -> sourceRootRelativePath(path, sourceRoot) != null }
            }
            .flatMap { path -> listOf(path, "$path/**") }
            .distinct()
            .forEach(filter::include)
    }

    fun selectionContainsPathUnderAnyRoot(
        sourceRoots: List<String>,
        selection: FocusedVerificationSelection = selection()
    ): Boolean =
        selection.paths.any { selectedPath ->
            sourceRoots.any { sourceRoot -> sourceRootRelativePath(selectedPath, sourceRoot) != null }
        }

    private fun canonicalFocusedPath(value: String): String {
        val slashNormalized = value.replace('\\', '/')
        val withoutLeadingCurrentDirectory = slashNormalized.removePrefix("./")
        val trimmed = withoutLeadingCurrentDirectory.removeSuffix("/")
        require(trimmed == normalizePath(trimmed)) {
            "Focused verification path '$value' must use canonical repo-relative spelling."
        }
        return trimmed
    }

    private fun isUnsafePath(path: String): Boolean =
        path.isBlank() ||
            path.startsWith("/") ||
            path.contains("//") ||
            path.split('/').any { segment -> segment == "." || segment == ".." } ||
            path.any { character -> character == '*' || character == '?' || character == '[' || character == ']' }

    private fun sourceRootRelativeIncludes(
        sourceRoots: List<String>,
        selection: FocusedVerificationSelection
    ): List<String> = selection.paths
        .flatMap { selectedPath ->
            sourceRoots.mapNotNull { sourceRoot ->
                sourceRootRelativePath(selectedPath, sourceRoot)
            }
        }
        .flatMap { relativePath ->
            if (relativePath.isBlank()) {
                listOf("**")
            } else {
                listOf(relativePath, "$relativePath/**")
            }
        }
        .distinct()

    private fun sourceRootRelativePath(selectedPath: String, sourceRoot: String): String? {
        val normalizedRoot = sourceRoot.replace('\\', '/').removePrefix("./").removeSuffix("/")
        if (normalizedRoot.isBlank()) {
            return selectedPath
        }
        return when {
            selectedPath == normalizedRoot -> ""
            selectedPath.startsWith("$normalizedRoot/") -> selectedPath.removePrefix("$normalizedRoot/")
            else -> null
        }
    }

    private fun isSupportSeamInclude(include: String): Boolean {
        val normalizedInclude = normalizePath(include)
        return normalizedInclude == "api" ||
            normalizedInclude.startsWith("api/") ||
            normalizedInclude.startsWith("api**") ||
            normalizedInclude.startsWith("api/**")
    }

    fun selectedSurfaceIds(): List<String> = selection().surfaceIds

    private fun selectedSurfaceIdsFromSystem(): List<String> = System.getProperty(FocusedDiagnosticSurfaceIdsProperty)
        ?.split(',')
        .orEmpty()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .distinct()

    private fun selectedSurfaceRoots(
        activeDescriptors: List<EnforcementBundleDescriptor>,
        selection: FocusedVerificationSelection
    ): Map<String, List<String>> {
        val diagnosticSurfaceCatalog = standardEnforcementDiagnosticSurfaceCatalog()
        return selection.surfaceIds
            .associateWith { surfaceId ->
                val surface = diagnosticSurfaceCatalog.surface(surfaceId)
                (surface.focusSourceRoots + activeDescriptors
                    .filter { descriptor -> descriptor.bundleId in surface.bundleIds }
                    .flatMap { descriptor ->
                        descriptor.archunit?.sourceRoots.orEmpty() +
                            buildHarnessSourceRoots(descriptor)
                    })
                    .map(::normalizePath)
                    .filter(String::isNotEmpty)
                    .distinct()
            }
    }

    private fun allowedSourceRoots(
        activeDescriptors: List<EnforcementBundleDescriptor>,
        selection: FocusedVerificationSelection
    ): List<String> {
        val surfaceRoots = selectedSurfaceRoots(activeDescriptors, selection).values.flatten()
        return surfaceRoots.ifEmpty {
            activeDescriptors
                .flatMap { descriptor ->
                    descriptor.verificationSourceRoots +
                        descriptor.archunit?.sourceRoots.orEmpty() +
                        descriptor.jqassistant?.sourceRoots.orEmpty() +
                        BuildLogicSourceRoots +
                        buildHarnessSourceRoots(descriptor) +
                        descriptor.utilityTasks.flatMap { task -> utilityTaskSourceRoots(task.kind) } +
                        descriptor.buildHarnessTasks.flatMap { task ->
                            if (task.kind == BuildHarnessTaskKind.TOPOLOGY) {
                                listOf("bootstrap", "shell", "src")
                            } else {
                                emptyList()
                            }
                        }
                }
        }.map(::normalizePath)
            .filter(String::isNotEmpty)
            .distinct()
    }

    private fun focusedInputSpecs(activeDescriptors: List<EnforcementBundleDescriptor>): List<FocusedInputSpec> =
        activeDescriptors.flatMap { descriptor ->
            buildList {
                if (descriptor.verificationSourceRoots.isNotEmpty() && descriptor.verificationSourceIncludes.isNotEmpty()) {
                    descriptor.verificationSourceRoots.forEach { root ->
                        add(FocusedInputSpec(root, descriptor.verificationSourceIncludes))
                    }
                }
                descriptor.jqassistant?.let { task ->
                    add(FocusedInputSpec("", listOf(task.sourceConfigPath, "${task.rulesDirPath}/**")))
                    task.sourceRoots.forEach { root ->
                        add(FocusedInputSpec(root, task.sourceIncludes))
                    }
                }
                descriptor.archunit?.let { task ->
                    task.sourceRoots.forEach { root ->
                        add(FocusedInputSpec(root, task.sourceIncludes))
                    }
                }
                buildHarnessSourceRoots(descriptor).forEach { root ->
                    add(FocusedInputSpec(root, listOf("**/*.java")))
                }
                descriptor.utilityTasks.forEach { task ->
                    utilityTaskInputSpecs(task.kind).forEach(::add)
                }
                if (descriptor.buildHarnessTasks.any { task -> task.kind == BuildHarnessTaskKind.TOPOLOGY }) {
                    listOf("bootstrap", "shell", "src").forEach { root ->
                        add(FocusedInputSpec(root, listOf("**/*.java")))
                    }
                }
            }
        }

    private fun utilityTaskSourceRoots(kind: EnforcementUtilityTaskKind): List<String> = when (kind) {
        EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES -> listOf("resources", "shell", "src")
        EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS,
        EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER -> listOf("resources")
        EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS,
        EnforcementUtilityTaskKind.MANUAL_NODE_STYLING -> listOf("bootstrap", "shell", "src", "resources")
    }

    private fun utilityTaskInputSpecs(kind: EnforcementUtilityTaskKind): List<FocusedInputSpec> = when (kind) {
        EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES -> listOf(
            FocusedInputSpec("", listOf("resources/**", "shell/**", "src/**"))
        )
        EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS,
        EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER,
        EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS -> listOf(
            FocusedInputSpec("", listOf("**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.styl"))
        )
        EnforcementUtilityTaskKind.MANUAL_NODE_STYLING -> listOf(
            FocusedInputSpec("bootstrap", listOf("**/*.java")),
            FocusedInputSpec("shell", listOf("**/*.java")),
            FocusedInputSpec("src", listOf("**/*.java"))
        )
    }

    private fun buildHarnessSourceRoots(descriptor: EnforcementBundleDescriptor): List<String> =
        if (descriptor.buildHarnessTasks.isEmpty()) {
            emptyList()
        } else {
            BuildHarnessSourceRoots
        }

    private fun pathIsUnderAnyRoot(repoRoot: File, path: String, roots: List<String>): Boolean {
        val selectedDirectory = File(repoRoot, path).canonicalFile
        return roots.any { root -> selectedDirectoryIsUnderRoot(repoRoot, selectedDirectory, root) }
    }

    private fun selectedDirectoryIsUnderRoot(repoRoot: File, selectedDirectory: File, root: String): Boolean {
        val rootDirectory = File(repoRoot, root).canonicalFile
        return selectedDirectory.toPath().startsWith(rootDirectory.toPath())
    }

    private fun pathContainsFocusedInput(
        repoRoot: File,
        selectedDirectory: File,
        inputSpecs: List<FocusedInputSpec>
    ): Boolean = selectedDirectory.walkTopDown()
        .filter(File::isFile)
        .filterNot { file -> ignoredRepositoryScanSegment(repoRoot, file) }
        .map { file -> repoRoot.toPath().relativize(file.toPath()).toString().replace('\\', '/') }
        .any { relativePath -> inputSpecs.any { spec -> spec.matches(relativePath) } }

    private fun ignoredRepositoryScanSegment(repoRoot: File, file: File): Boolean =
        repoRoot.toPath()
            .relativize(file.toPath())
            .map { segment -> segment.toString() }
            .any(IgnoredRepositoryScanSegments::contains)

    private fun normalizePath(path: String): String = path
        .trim()
        .replace('\\', '/')
        .removePrefix("./")
        .removeSuffix("/")

    private data class FocusedInputSpec(
        val sourceRoot: String,
        val includes: List<String>
    ) {
        fun matches(relativePath: String): Boolean {
            val normalizedRoot = normalizePath(sourceRoot)
            val rootRelativePath = when {
                normalizedRoot.isBlank() -> relativePath
                relativePath == normalizedRoot -> ""
                relativePath.startsWith("$normalizedRoot/") -> relativePath.removePrefix("$normalizedRoot/")
                else -> return false
            }
            return includes.any { pattern -> antPatternMatches(pattern, rootRelativePath) }
        }
    }

    private fun antPatternMatches(pattern: String, path: String): Boolean =
        antPatternRegex(normalizePath(pattern)).matches(path)

    private fun antPatternRegex(pattern: String): Regex {
        val regex = StringBuilder("^")
        var index = 0
        while (index < pattern.length) {
            val character = pattern[index]
            if (character == '*' && index + 1 < pattern.length && pattern[index + 1] == '*') {
                if (index + 2 < pattern.length && pattern[index + 2] == '/') {
                    regex.append("(?:.*/)?")
                    index += 3
                } else {
                    regex.append(".*")
                    index += 2
                }
            } else {
                when (character) {
                    '*' -> regex.append("[^/]*")
                    '?' -> regex.append("[^/]")
                    else -> regex.append(Regex.escape(character.toString()))
                }
                index += 1
            }
        }
        regex.append('$')
        return Regex(regex.toString())
    }
}
