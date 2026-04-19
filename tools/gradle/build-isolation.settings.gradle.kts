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

val rawIsolationId = System.getenv("SALTMARCHER_GRADLE_ISOLATION_ID")?.nonBlankOrNull()
    ?: System.getenv("CODEX_THREAD_ID")?.nonBlankOrNull()

if (rawIsolationId != null) {
    val repositoryRoot = findRepositoryRoot(settingsDir)
    val isolationId = stablePathSegment(rawIsolationId)
    val buildPath = settingsDir.canonicalFile
        .relativeToOrSelf(repositoryRoot)
        .path
        .replace(File.separatorChar, '-')
        .let { relativePath -> if (relativePath.isBlank() || relativePath == ".") "root" else stablePathSegment(relativePath) }
    val isolatedBuildRoot = File(repositoryRoot, "build/isolated-gradle/$isolationId/$buildPath")
    val isolatedProjectCacheRoot = File(repositoryRoot, ".gradle/isolated-gradle/$isolationId/$buildPath")

    gradle.startParameter.setProjectCacheDir(isolatedProjectCacheRoot)
    gradle.beforeProject {
        val projectSegment = path.removePrefix(":")
            .replace(':', '-')
            .ifEmpty { "root" }
        layout.buildDirectory.set(if (path == ":") isolatedBuildRoot else File(isolatedBuildRoot, projectSegment))
    }
}
