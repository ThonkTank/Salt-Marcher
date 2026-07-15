package saltmarcher.buildlogic.tasks

import java.io.File
import java.nio.file.FileVisitOption
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.PosixFilePermission
import java.util.EnumSet
import org.gradle.api.GradleException

internal fun executableName(command: String): String =
    if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) "$command.exe" else command

internal fun resolveExecutableOnPath(command: String): String? {
    for (directory in (System.getenv("PATH") ?: "").split(File.pathSeparatorChar).filter(String::isNotBlank)) {
        val candidate = Path.of(directory, executableName(command))
        if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
            return candidate.toString()
        }
    }
    return null
}

internal fun isJavafxRuntimeJar(file: File): Boolean =
    isJavafxRuntimeJarName(file.name)

internal fun isJavafxRuntimeJarName(fileName: String): Boolean =
    fileName.startsWith("javafx-") && fileName.endsWith(".jar")

internal fun resolvePackagedAppPayloadDir(appImageDir: Path): Path {
    val jpackagePayloadDir = appImageDir.resolve("lib").resolve("app")
    if (Files.isDirectory(jpackagePayloadDir)) {
        return jpackagePayloadDir
    }
    val fallbackPayloadDir = appImageDir.resolve("app")
    if (Files.isDirectory(fallbackPayloadDir)) {
        return fallbackPayloadDir
    }
    throw GradleException("Could not resolve packaged app payload directory under $appImageDir")
}

internal fun setExecutableFile(path: Path) {
    try {
        Files.setPosixFilePermissions(
            path,
            setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE,
                PosixFilePermission.GROUP_READ,
                PosixFilePermission.GROUP_EXECUTE,
                PosixFilePermission.OTHERS_READ,
                PosixFilePermission.OTHERS_EXECUTE
            )
        )
    } catch (_: UnsupportedOperationException) {
        // Launchers remain valid on filesystems without POSIX permission support.
    }
}

internal fun resolveJpackageExecutable(): String? {
    val javaHomeJpackage = Path.of(System.getProperty("java.home"), "bin", executableName("jpackage"))
    return if (Files.isRegularFile(javaHomeJpackage) && Files.isExecutable(javaHomeJpackage)) {
        javaHomeJpackage.toString()
    } else {
        resolveExecutableOnPath("jpackage")
    }
}

internal fun resolveDesktopDirectory(): Path {
    val userHome = Path.of(System.getProperty("user.home"))
    val xdgUserDirsFile = userHome.resolve(".config").resolve("user-dirs.dirs")
    if (Files.isRegularFile(xdgUserDirsFile)) {
        Files.readAllLines(xdgUserDirsFile)
            .asSequence()
            .map(String::trim)
            .filter { it.startsWith("XDG_DESKTOP_DIR=") }
            .map { it.substringAfter('=').trim().trim('"') }
            .map { it.replace("\$HOME", userHome.toString()) }
            .firstOrNull(String::isNotBlank)
            ?.let { return Path.of(it) }
    }
    val localizedDesktop = userHome.resolve("Schreibtisch")
    return if (Files.isDirectory(localizedDesktop)) localizedDesktop else userHome.resolve("Desktop")
}

internal fun copyRuntimeImage(sourceDir: Path, targetDir: Path) {
    Files.walkFileTree(
        sourceDir,
        EnumSet.of(FileVisitOption.FOLLOW_LINKS),
        Int.MAX_VALUE,
        object : SimpleFileVisitor<Path>() {
            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                Files.createDirectories(targetDir.resolve(sourceDir.relativize(dir).toString()))
                return FileVisitResult.CONTINUE
            }

            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                val resolvedSource = if (Files.isSymbolicLink(file)) file.toRealPath() else file
                val target = targetDir.resolve(sourceDir.relativize(file).toString())
                Files.createDirectories(target.parent)
                Files.copy(resolvedSource, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.COPY_ATTRIBUTES)
                return FileVisitResult.CONTINUE
            }

            override fun postVisitDirectory(dir: Path, exception: java.io.IOException?): FileVisitResult {
                exception?.let { throw it }
                val source = if (Files.isSymbolicLink(dir)) dir.toRealPath() else dir
                val target = targetDir.resolve(sourceDir.relativize(dir).toString())
                if (Files.exists(source, LinkOption.NOFOLLOW_LINKS)) {
                    try {
                        Files.setLastModifiedTime(target, Files.getLastModifiedTime(source))
                    } catch (_: UnsupportedOperationException) {
                        // Directory timestamps are optional for packaging.
                    }
                }
                return FileVisitResult.CONTINUE
            }
        }
    )
}
