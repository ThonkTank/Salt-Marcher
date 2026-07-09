package saltmarcher.buildlogic.verification

import java.io.File
import java.security.MessageDigest
import org.gradle.api.tasks.util.PatternFilterable

private const val FocusedVerificationPathsProperty = "saltmarcher.focusedVerificationPaths"

object FocusedVerificationPaths {
    fun selectedPaths(): List<String> = System.getProperty(FocusedVerificationPathsProperty)
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

    fun propertyInput(): String = selectedPaths().joinToString(",")

    fun hasSelection(): Boolean = selectedPaths().isNotEmpty()

    fun focusedOutputKey(): String? {
        val paths = selectedPaths()
        if (paths.isEmpty()) {
            return null
        }
        val digest = MessageDigest.getInstance("SHA-256")
        paths.sorted().forEach { path -> digest.update("path:$path\n".toByteArray()) }
        return digest.digest()
            .take(6)
            .joinToString("") { byte -> "%02x".format(byte) }
            .let { hash -> "focused-$hash" }
    }

    fun validateSelection(repoRootDir: File) {
        val paths = selectedPaths()
        if (paths.isEmpty()) {
            return
        }

        val repoRoot = repoRootDir.canonicalFile
        paths.forEach { path ->
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
        }
    }

    fun configureDefaultSourceFilter(filter: PatternFilterable, defaultIncludes: List<String>) {
        defaultIncludes.forEach(filter::include)
        filter.exclude("**/build/**")
    }

    fun configureFocusedSourceFilter(filter: PatternFilterable, sourceRoots: List<String>) {
        val focusedIncludes = sourceRootRelativeIncludes(sourceRoots)
        if (focusedIncludes.isEmpty()) {
            if (hasSelection()) {
                filter.include("__saltmarcher_no_focused_inputs__")
            }
            return
        }
        focusedIncludes.forEach(filter::include)
    }

    fun configureFocusedCompileSourceFilter(
        filter: PatternFilterable,
        sourceRoots: List<String>,
        defaultIncludes: List<String>
    ) {
        configureFocusedSourceFilter(filter, sourceRoots)
        if (hasSelection() && selectionContainsPathUnderAnyRoot(sourceRoots)) {
            defaultIncludes
                .filter(::isSupportSeamInclude)
                .forEach(filter::include)
        }
    }

    fun errorProneExcludedPathsPattern(): String? {
        val paths = selectedPaths()
        if (paths.isEmpty()) {
            return null
        }
        val includedPathExpression = paths
            .joinToString("|") { path -> Regex.escape(path) }
        return "^(?!.*(^|/)($includedPathExpression)(/|$)).*"
    }

    fun selectionContainsPathUnderAnyRoot(sourceRoots: List<String>): Boolean =
        selectedPaths().any { selectedPath ->
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

    private fun sourceRootRelativeIncludes(sourceRoots: List<String>): List<String> = selectedPaths()
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

    private fun normalizePath(path: String): String = path
        .trim()
        .replace('\\', '/')
        .removePrefix("./")
        .removeSuffix("/")
}
