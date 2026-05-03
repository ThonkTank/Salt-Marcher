import java.io.File
import java.security.MessageDigest
import org.gradle.api.Project
import org.gradle.api.initialization.Settings
import org.gradle.kotlin.dsl.closureOf

fun String?.nonBlankOrNull(): String? = this?.trim()?.takeIf(String::isNotEmpty)

fun String.sha256Prefix(): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(toByteArray(Charsets.UTF_8))
    return digest.take(6).joinToString(separator = "") { byte -> "%02x".format(byte) }
}

fun stablePathSegment(rawValue: String): String {
    val sanitized = rawValue
        .replace(Regex("[^A-Za-z0-9._-]+"), "-")
        .trim('-', '.', '_')
        .take(48)
        .ifEmpty { "agent" }
    return "$sanitized-${rawValue.sha256Prefix()}"
}

fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}

val saltmarcherRepoRoot = System.getenv("SALTMARCHER_REPO_ROOT")
    .nonBlankOrNull()
    ?.let(::File)
    ?.canonicalFile
    ?: System.getProperty("saltmarcher.repoRootDir")
        .nonBlankOrNull()
        ?.let(::File)
        ?.canonicalFile
    ?: findRepositoryRoot(gradle.startParameter.currentDir)

System.setProperty("saltmarcher.repoRootDir", saltmarcherRepoRoot.absolutePath)

System.getenv("SALTMARCHER_ENFORCEMENT_BUNDLE_CATALOG")
    .nonBlankOrNull()
    ?.let(::File)
    ?.takeIf(File::isFile)
    ?.also { catalogFile ->
        System.setProperty("saltmarcher.enforcementBundleCatalogFile", catalogFile.absolutePath)
    }

gradle.settingsEvaluated(closureOf<Settings> {
    buildCache {
        local {
            isEnabled = true
            directory = File(saltmarcherRepoRoot, ".gradle/shared-build-cache")
        }
    }

    val rawIsolationId = System.getenv("SALTMARCHER_GRADLE_INVOCATION_ID").nonBlankOrNull()
        ?: System.getenv("SALTMARCHER_GRADLE_ISOLATION_ID").nonBlankOrNull()
        ?: System.getenv("CODEX_THREAD_ID").nonBlankOrNull()
    val explicitIsolationSegment = System.getenv("SALTMARCHER_GRADLE_ISOLATION_SEGMENT").nonBlankOrNull()
    val explicitBuildRoot = System.getenv("SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT").nonBlankOrNull()
    val explicitProjectCacheRoot = System.getenv("SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT").nonBlankOrNull()

    if (rawIsolationId != null) {
        val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
            .nonBlankOrNull()
            ?.let(::File)
            ?.canonicalFile
        val settingsRoot = settingsDir.canonicalFile
        val isRootSettingsBuild = settingsRoot == saltmarcherRepoRoot
        val buildPathBase = if (includedBuildRoot != null && settingsRoot.toPath().startsWith(includedBuildRoot.toPath())) {
            includedBuildRoot
        } else {
            saltmarcherRepoRoot
        }
        val isolationId = explicitIsolationSegment ?: stablePathSegment(rawIsolationId)
        val buildPath = settingsRoot
            .relativeToOrSelf(buildPathBase)
            .path
            .replace(File.separatorChar, '-')
            .let { relativePath -> if (relativePath.isBlank() || relativePath == ".") "root" else stablePathSegment(relativePath) }
        val isolatedBuildRootBase = explicitBuildRoot?.let(::File)
            ?: File(saltmarcherRepoRoot, "build/isolated-gradle/$isolationId")
        val isolatedProjectCacheRootBase = explicitProjectCacheRoot?.let(::File)
            ?: File(saltmarcherRepoRoot, ".gradle/isolated-gradle/$isolationId")
        val isolatedBuildRoot = File(isolatedBuildRootBase, buildPath)
        val isolatedProjectCacheRoot = File(isolatedProjectCacheRootBase, buildPath)

        if (!isRootSettingsBuild || gradle.startParameter.projectCacheDir == null) {
            gradle.startParameter.setProjectCacheDir(isolatedProjectCacheRoot)
        }
        gradle.beforeProject(closureOf<Project> {
            val projectSegment = path.removePrefix(":")
                .replace(':', '-')
                .ifEmpty { "root" }
            layout.buildDirectory.set(
                if (path == ":") isolatedBuildRoot else File(isolatedBuildRoot, projectSegment)
            )
        })
    }
})
