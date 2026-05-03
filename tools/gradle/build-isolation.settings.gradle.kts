import java.io.File
import java.security.MessageDigest

fun String.nonBlankOrNull(): String? = trim().takeIf { it.isNotEmpty() }

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

val repositoryRootForBuildCache = findRepositoryRoot(settingsDir)

buildCache {
    local {
        isEnabled = true
        directory = File(repositoryRootForBuildCache, ".gradle/shared-build-cache")
    }
}

val rawIsolationId = System.getenv("SALTMARCHER_GRADLE_INVOCATION_ID")?.nonBlankOrNull()
    ?: System.getenv("SALTMARCHER_GRADLE_ISOLATION_ID")?.nonBlankOrNull()
    ?: System.getenv("CODEX_THREAD_ID")?.nonBlankOrNull()
val explicitIsolationSegment = System.getenv("SALTMARCHER_GRADLE_ISOLATION_SEGMENT")?.nonBlankOrNull()
val explicitBuildRoot = System.getenv("SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT")?.nonBlankOrNull()
val explicitProjectCacheRoot = System.getenv("SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT")?.nonBlankOrNull()

if (rawIsolationId != null) {
    val repositoryRoot = repositoryRootForBuildCache
    val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
        ?.nonBlankOrNull()
        ?.let(::File)
        ?.canonicalFile
    val settingsRoot = settingsDir.canonicalFile
    val isRootSettingsBuild = settingsRoot == repositoryRoot
    val buildPathBase = if (includedBuildRoot != null && settingsRoot.toPath().startsWith(includedBuildRoot.toPath())) {
        includedBuildRoot
    } else {
        repositoryRoot
    }
    val isolationId = explicitIsolationSegment ?: stablePathSegment(rawIsolationId)
    val buildPath = settingsRoot
        .relativeToOrSelf(buildPathBase)
        .path
        .replace(File.separatorChar, '-')
        .let { relativePath -> if (relativePath.isBlank() || relativePath == ".") "root" else stablePathSegment(relativePath) }
    val isolatedBuildRootBase = explicitBuildRoot?.let(::File)
        ?: File(repositoryRoot, "build/isolated-gradle/$isolationId")
    val isolatedProjectCacheRootBase = explicitProjectCacheRoot?.let(::File)
        ?: File(repositoryRoot, ".gradle/isolated-gradle/$isolationId")
    val isolatedBuildRoot = File(isolatedBuildRootBase, buildPath)
    val isolatedProjectCacheRoot = File(isolatedProjectCacheRootBase, buildPath)

    if (!isRootSettingsBuild || gradle.startParameter.projectCacheDir == null) {
        gradle.startParameter.setProjectCacheDir(isolatedProjectCacheRoot)
    }
    gradle.beforeProject {
        val projectSegment = path.removePrefix(":")
            .replace(':', '-')
            .ifEmpty { "root" }
        layout.buildDirectory.set(if (path == ":") isolatedBuildRoot else File(isolatedBuildRoot, projectSegment))
    }
}
