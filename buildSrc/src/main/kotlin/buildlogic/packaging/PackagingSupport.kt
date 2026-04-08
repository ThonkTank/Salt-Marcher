package buildlogic.packaging

import java.io.File
import java.nio.file.FileVisitOption
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.SimpleFileVisitor
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.PosixFilePermission
import java.util.EnumSet
import org.gradle.api.Project
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.TaskProvider

data class PackagingConfig(
    val desktopAppName: String,
    val launcherName: String,
    val preloaderJvmArg: String,
    val jpackageModulePathArg: String,
    val jpackageAddModulesArg: String,
    val desktopIconRelativePath: String,
    val packageVersion: Provider<String>
)

class PackagingSupport(
    private val project: Project,
    val config: PackagingConfig
) {
    val localRuntimeImage = project.providers.provider {
        Paths.get(System.getProperty("java.home"))
    }
    val jpackageInputDir = project.layout.buildDirectory.dir("packaging/jpackage-input")
    val jpackageOutputDir = project.layout.buildDirectory.dir("packaging/jpackage")
    val jpackageTempDir = project.layout.buildDirectory.dir("packaging/tmp")
    val preparedRuntimeImageDir = project.layout.buildDirectory.dir("packaging/runtime-image")
    val packagedAppImageDir = jpackageOutputDir.map { it.dir(config.launcherName) }
    val packagedAppLibDir = packagedAppImageDir.map { it.dir("app") }
    val packagedAppRuntimeDir = packagedAppImageDir.map { it.dir("runtime") }
    val installedAppDir = project.providers.provider {
        Paths.get(System.getProperty("user.home"), ".local", "opt", config.launcherName)
    }
    val installedDesktopIcon = installedAppDir.map { it.resolve(config.desktopIconRelativePath) }
    val desktopEntryName = "${config.desktopAppName}.desktop"
    val desktopEntryContent = project.providers.provider {
        val execPath = installedAppDir.get().resolve("bin").resolve(config.launcherName)
        val iconPath = installedDesktopIcon.get()
        """
        [Desktop Entry]
        Version=1.0
        Type=Application
        Name=${config.desktopAppName}
        Comment=Launch Salt Marcher
        Exec=${execPath.toAbsolutePath()}
        Icon=${iconPath.toAbsolutePath()}
        Terminal=false
        Categories=Game;Utility;
        StartupNotify=true
        """.trimIndent() + "\n"
    }

    fun iconFile() = project.layout.projectDirectory.file("resources/${config.desktopIconRelativePath}")

    fun registerStageJpackageInputTask(): TaskProvider<Sync> = project.tasks.register("stageJpackageInput", Sync::class.java) {
        dependsOn(project.tasks.named("jar"))
        from(project.tasks.named("jar"))
        from(project.configurations.named("runtimeClasspath"))
        into(jpackageInputDir)
    }

    fun resolveDesktopDirectory(): Path {
        val process = try {
            ProcessBuilder("xdg-user-dir", "DESKTOP")
                .redirectErrorStream(true)
                .start()
        } catch (_: Exception) {
            null
        }
        val exitValue = process?.waitFor()
        if (exitValue == 0) {
            val path = process.inputStream.bufferedReader().use { it.readText() }.trim()
            if (path.isNotBlank()) {
                return Paths.get(path)
            }
        }
        return Paths.get(System.getProperty("user.home"), "Schreibtisch")
    }

    fun setExecutableDesktopFile(path: Path) {
        setExecutableFile(path)
    }

    fun setExecutableFile(path: Path) {
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
            // Non-POSIX filesystems still get a valid desktop entry without chmod support.
        }
    }

    fun resolveJpackageExecutable(): String? {
        val javaHomeJpackage = Paths.get(System.getProperty("java.home"), "bin", executableName("jpackage"))
        if (Files.isRegularFile(javaHomeJpackage) && Files.isExecutable(javaHomeJpackage)) {
            return javaHomeJpackage.toString()
        }

        val pathDirectories = (System.getenv("PATH") ?: "")
            .split(File.pathSeparatorChar)
            .filter { it.isNotBlank() }
        for (directory in pathDirectories) {
            val candidate = Paths.get(directory, executableName("jpackage"))
            if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
                return candidate.toString()
            }
        }
        return null
    }

    fun executableName(command: String): String {
        return if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
            "$command.exe"
        } else {
            command
        }
    }

    fun copyRuntimeImage(sourceDir: Path, targetDir: Path) {
        Files.walkFileTree(sourceDir, EnumSet.of(FileVisitOption.FOLLOW_LINKS), Int.MAX_VALUE, object : SimpleFileVisitor<Path>() {
            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                val target = targetDir.resolve(sourceDir.relativize(dir).toString())
                Files.createDirectories(target)
                return FileVisitResult.CONTINUE
            }

            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                val resolvedSource = if (Files.isSymbolicLink(file)) {
                    file.toRealPath()
                } else {
                    file
                }
                val target = targetDir.resolve(sourceDir.relativize(file).toString())
                Files.createDirectories(target.parent)
                Files.copy(
                    resolvedSource,
                    target,
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.COPY_ATTRIBUTES
                )
                return FileVisitResult.CONTINUE
            }

            override fun postVisitDirectory(dir: Path, exc: java.io.IOException?): FileVisitResult {
                if (exc != null) {
                    throw exc
                }
                val source = if (Files.isSymbolicLink(dir)) dir.toRealPath() else dir
                val target = targetDir.resolve(sourceDir.relativize(dir).toString())
                if (Files.exists(source, LinkOption.NOFOLLOW_LINKS)) {
                    try {
                        Files.setLastModifiedTime(target, Files.getLastModifiedTime(source))
                    } catch (_: UnsupportedOperationException) {
                        // Some filesystems do not support preserving directory timestamps.
                    }
                }
                return FileVisitResult.CONTINUE
            }
        })
    }
}
