package saltmarcher.buildlogic.verification

import org.gradle.api.tasks.util.PatternFilterable

private const val FocusedVerificationPathsProperty = "saltmarcher.focusedVerificationPaths"

internal object FocusedVerificationPaths {
    fun selectedPaths(): List<String> = System.getProperty(FocusedVerificationPathsProperty)
        ?.split(',')
        .orEmpty()
        .map(String::trim)
        .map { value -> value.replace('\\', '/').removePrefix("./").removeSuffix("/") }
        .filter(String::isNotEmpty)
        .distinct()
        .also { paths ->
            require(paths.none(::isUnsafePath)) {
                "Focused verification paths must be repo-relative paths without '..' or glob syntax."
            }
        }

    fun propertyInput(): String = selectedPaths().joinToString(",")

    fun configureDefaultSourceFilter(filter: PatternFilterable, defaultIncludes: List<String>) {
        defaultIncludes.forEach(filter::include)
        filter.exclude("**/build/**")
    }

    fun configureFocusedSourceFilter(filter: PatternFilterable, sourceRoots: List<String>) {
        val focusedIncludes = sourceRootRelativeIncludes(sourceRoots)
        if (focusedIncludes.isEmpty()) {
            return
        }
        focusedIncludes.forEach(filter::include)
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

    private fun isUnsafePath(path: String): Boolean =
        path.isBlank() ||
            path.startsWith("/") ||
            path.split('/').any { segment -> segment == ".." } ||
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
}
