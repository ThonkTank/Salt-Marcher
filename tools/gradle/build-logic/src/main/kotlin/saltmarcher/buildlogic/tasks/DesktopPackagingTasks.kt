package saltmarcher.buildlogic.tasks

import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.api.file.FileSystemOperations
import org.gradle.work.DisableCachingByDefault
import javax.inject.Inject

@DisableCachingByDefault(because = "Copies the local JDK runtime image from java.home.")
abstract class PrepareRuntimeImageTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val runtimeImageDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun prepare() {
        val sourceDir = runtimeImageDirectory.get().asFile.toPath().toRealPath()
        val targetDir = outputDirectory.get().asFile.toPath()
        deleteRecursively(targetDir)
        Files.createDirectories(targetDir)
        copyRuntimeImage(sourceDir, targetDir)
    }
}

@DisableCachingByDefault(because = "Uses external jpackage and host-local runtime metadata.")
abstract class PackageAppImageTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val jpackageInputDirectory: DirectoryProperty

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val windowIconFile: RegularFileProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val runtimeImageDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val destinationRootDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val tempDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:Input
    abstract val launcherName: Property<String>

    @get:Input
    abstract val packageVersion: Property<String>

    @get:Input
    abstract val appDisplayName: Property<String>

    @get:Input
    abstract val mainJarFileName: Property<String>

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderJvmArg: Property<String>

    @get:Input
    abstract val modulePathArg: Property<String>

    @get:Input
    abstract val addModulesArg: Property<String>

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun packageImage() {
        val jpackageExecutable = resolveJpackageExecutable()
            ?: throw GradleException("jpackage executable not found")
        deleteRecursively(outputDirectory.get().asFile.toPath())
        deleteRecursively(tempDirectory.get().asFile.toPath())
        Files.createDirectories(destinationRootDirectory.get().asFile.toPath())
        Files.createDirectories(tempDirectory.get().asFile.toPath())
        val outputBuffer = ByteArrayOutputStream()
        val execResult = execOperations.exec {
            executable = jpackageExecutable
            args(
                "--type", "app-image",
                "--dest", destinationRootDirectory.get().asFile.absolutePath,
                "--temp", tempDirectory.get().asFile.absolutePath,
                "--input", jpackageInputDirectory.get().asFile.absolutePath,
                "--name", launcherName.get(),
                "--app-version", packageVersion.get(),
                "--vendor", appDisplayName.get(),
                "--icon", windowIconFile.get().asFile.absolutePath,
                "--runtime-image", runtimeImageDirectory.get().asFile.absolutePath,
                "--main-jar", mainJarFileName.get(),
                "--main-class", mainClassName.get(),
                "--java-options", modulePathArg.get(),
                "--java-options", addModulesArg.get(),
                "--java-options", preloaderJvmArg.get()
            )
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }
        if (execResult.exitValue != 0) {
            val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
            val suffix = if (outputText.isBlank()) "" else "\n$outputText"
            throw GradleException("jpackage failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}

@DisableCachingByDefault(because = "Produces a host-local fallback app image with filesystem mutation.")
abstract class PackageAppImageFallbackTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val inputDirectory: DirectoryProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val runtimeImageDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:Input
    abstract val launcherName: Property<String>

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderJvmArg: Property<String>

    @get:Input
    abstract val javafxModuleDirName: Property<String>

    @get:Input
    abstract val addModulesArg: Property<String>

    @get:Inject
    protected abstract val fileSystemOperations: FileSystemOperations

    @TaskAction
    fun packageFallback() {
        val appImageDir = outputDirectory.get().asFile.toPath()
        val appLibDir = appImageDir.resolve("app")
        val appRuntimeDir = appImageDir.resolve("runtime")
        val appBinDir = appImageDir.resolve("bin")
        val launcherFile = appBinDir.resolve(launcherName.get())

        deleteRecursively(appImageDir)
        Files.createDirectories(appLibDir)
        Files.createDirectories(appRuntimeDir)
        Files.createDirectories(appBinDir)

        fileSystemOperations.copy {
            from(inputDirectory)
            into(appLibDir.toFile())
        }
        copyRuntimeImage(runtimeImageDirectory.get().asFile.toPath(), appRuntimeDir)

        val launcherScript = """
            |#!/usr/bin/env sh
            |set -eu
            |
            |APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
            |exec "${'$'}APP_DIR/runtime/bin/java" \
            |  "${preloaderJvmArg.get()}" \
            |  --module-path "${'$'}APP_DIR/app/${javafxModuleDirName.get()}" \
            |  ${addModulesArg.get()} \
            |  -cp "${'$'}APP_DIR/app/*" \
            |  ${mainClassName.get()} \
            |  "${'$'}@"
            |""".trimMargin()
        Files.writeString(launcherFile, launcherScript)
        setExecutableFile(launcherFile)
    }
}

@DisableCachingByDefault(because = "Validates packaged files in host-local app image outputs.")
abstract class CheckDesktopAppImageLayoutTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val appImageDirectory: DirectoryProperty

    @get:Input
    abstract val expectedJavafxJarNames: ListProperty<String>

    @get:Input
    abstract val launcherName: Property<String>

    @get:Input
    abstract val modulePathArg: Property<String>

    @get:Input
    abstract val javafxModuleDirName: Property<String>

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun checkLayout() {
        val appImageDir = appImageDirectory.get().asFile.toPath()
        val appPayloadDir = resolvePackagedAppPayloadDir(appImageDir)
        val javafxModuleDir = appPayloadDir.resolve(javafxModuleDirName.get())
        if (!Files.isDirectory(javafxModuleDir)) {
            throw GradleException("Packaged app image is missing JavaFX module directory: $javafxModuleDir")
        }

        val misplacedJavafxJars = Files.list(appPayloadDir).use { paths ->
            paths
                .filter(Files::isRegularFile)
                .map(Path::getFileName)
                .map(Path::toString)
                .filter(::isJavafxRuntimeJarName)
                .sorted()
                .toList()
        }
        if (misplacedJavafxJars.isNotEmpty()) {
            throw GradleException(
                "JavaFX jars must not live in the packaged app root payload.\n" +
                    misplacedJavafxJars.joinToString(separator = "\n") { " - $it" }
            )
        }

        val javafxJarNames = Files.list(javafxModuleDir).use { paths ->
            paths
                .filter(Files::isRegularFile)
                .map(Path::getFileName)
                .map(Path::toString)
                .filter(::isJavafxRuntimeJarName)
                .sorted()
                .toList()
        }
        if (javafxJarNames.isEmpty()) {
            throw GradleException("Packaged JavaFX module directory is empty: $javafxModuleDir")
        }

        if (javafxJarNames != expectedJavafxJarNames.get()) {
            throw GradleException(
                "Packaged JavaFX module directory does not match runtime JavaFX jars.\n" +
                    "Expected: ${expectedJavafxJarNames.get()}\n" +
                    "Actual: $javafxJarNames"
            )
        }

        val jpackageConfigFile = appImageDir.resolve("lib").resolve("app").resolve("${launcherName.get()}.cfg")
        if (Files.isRegularFile(jpackageConfigFile)) {
            val configText = Files.readString(jpackageConfigFile)
            val configLines = configText.lineSequence().toList()
            if ("java-options=${modulePathArg.get()}" !in configLines) {
                throw GradleException("Packaged jpackage config is missing the dedicated JavaFX module path: $jpackageConfigFile")
            }
            if ("java-options=--module-path=\$APPDIR" in configLines) {
                throw GradleException("Packaged jpackage config still points the module path at the whole app directory: $jpackageConfigFile")
            }
            val classpathLines = configLines.asSequence().filter { it.startsWith("app.classpath=") }.toList()
            val javafxClasspathLines = classpathLines.filter { line -> isJavafxRuntimeJarName(line.substringAfterLast('/')) }
            val misplacedJavafxClasspathLines = javafxClasspathLines.filterNot { line ->
                line.startsWith("app.classpath=\$APPDIR/${javafxModuleDirName.get()}/")
            }
            if (misplacedJavafxClasspathLines.isNotEmpty()) {
                throw GradleException(
                    "Packaged jpackage config must only reference JavaFX jars from the dedicated module directory.\n" +
                        misplacedJavafxClasspathLines.joinToString(separator = "\n")
                )
            }
        } else {
            val launcherFile = appImageDir.resolve("bin").resolve(launcherName.get())
            if (!Files.isRegularFile(launcherFile)) {
                throw GradleException("Packaged launcher not found: $launcherFile")
            }
            val launcherText = Files.readString(launcherFile)
            val expectedFallbackModulePath = "--module-path \"${'$'}APP_DIR/app/${javafxModuleDirName.get()}\""
            if (!launcherText.contains(expectedFallbackModulePath)) {
                throw GradleException("Fallback launcher is missing the dedicated JavaFX module path: $launcherFile")
            }
            if (launcherText.contains("--module-path \"${'$'}APP_DIR/app\"")) {
                throw GradleException("Fallback launcher still points the module path at the whole app directory: $launcherFile")
            }
        }

        val markerPath = successMarker.get().asFile.toPath()
        Files.createDirectories(markerPath.parent)
        Files.writeString(markerPath, "passed\n")
    }
}

@DisableCachingByDefault(because = "Installs into a user-local application directory outside the build tree.")
abstract class InstallAppImageTask : DefaultTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceDirectory: DirectoryProperty

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val desktopIconSourceFile: RegularFileProperty

    @get:Input
    abstract val desktopEntryIconRelativePath: Property<String>

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:Inject
    protected abstract val fileSystemOperations: FileSystemOperations

    @TaskAction
    fun install() {
        val sourceDir = sourceDirectory.get().asFile.toPath()
        val targetDir = outputDirectory.get().asFile.toPath()
        val stagingDir = targetDir.resolveSibling("${targetDir.fileName}.tmp")

        deleteRecursively(stagingDir)
        fileSystemOperations.copy {
            from(sourceDir)
            into(stagingDir.toFile())
        }

        val iconTarget = stagingDir.resolve(desktopEntryIconRelativePath.get())
        Files.createDirectories(iconTarget.parent)
        Files.copy(
            desktopIconSourceFile.get().asFile.toPath(),
            iconTarget,
            java.nio.file.StandardCopyOption.REPLACE_EXISTING
        )

        deleteRecursively(targetDir)
        Files.move(stagingDir, targetDir, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
    }
}

@DisableCachingByDefault(because = "Installs desktop entries into user-local desktop/application directories.")
abstract class InstallDesktopEntriesTask : DefaultTask() {

    @get:Input
    abstract val desktopEntryContent: Property<String>

    @get:OutputFile
    abstract val desktopFile: RegularFileProperty

    @get:OutputFile
    abstract val applicationsFile: RegularFileProperty

    @TaskAction
    fun install() {
        val desktopPath = desktopFile.get().asFile.toPath()
        val applicationsPath = applicationsFile.get().asFile.toPath()

        Files.createDirectories(desktopPath.parent)
        Files.createDirectories(applicationsPath.parent)
        Files.writeString(desktopPath, desktopEntryContent.get())
        Files.writeString(applicationsPath, desktopEntryContent.get())
        setExecutableFile(desktopPath)
        setExecutableFile(applicationsPath)
    }
}

private fun deleteRecursively(path: Path) {
    if (!Files.exists(path)) {
        return
    }
    path.toFile().deleteRecursively()
}
