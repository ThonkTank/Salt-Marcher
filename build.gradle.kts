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
import org.gradle.api.GradleException
import org.gradle.api.plugins.JavaApplication
import org.gradle.api.tasks.Sync
import org.gradle.jvm.application.tasks.CreateStartScripts

plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val appDisplayName = providers.gradleProperty("saltMarcherDisplayName").orElse("SaltMarcher")
val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val packageVersion = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("bootstrap.SaltMarcherPreloader")
val desktopIconRelativePath = providers.gradleProperty("saltMarcherDesktopIcon")
    .orElse("icons/saltmarcher.svg")
val stylesheetRelativePath = providers.gradleProperty("saltMarcherStylesheet")
    .orElse("saltmarcher.css")

val preloaderJvmArg = preloaderClassName.map { "-Djavafx.preloader=$it" }
val jpackageModulePathArg = "--module-path=\$APPDIR"
val jpackageAddModulesArg = "--add-modules=javafx.controls"

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

javafx {
    version = "21.0.2"
    modules = listOf("javafx.controls")
}

sourceSets {
    main {
        java {
            setSrcDirs(listOf("bootstrap", "shell", "src"))
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
    test {
        java {
            setSrcDirs(listOf("test"))
        }
    }
}

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

extensions.configure<JavaApplication> {
    mainClass = mainClassName
    applicationDefaultJvmArgs = listOf(preloaderJvmArg.get())
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = launcherName.get()
}

tasks.test {
    useJUnitPlatform()
}

val localRuntimeImage = providers.provider {
    Paths.get(System.getProperty("java.home"))
}
val jpackageInputDir = layout.buildDirectory.dir("packaging/jpackage-input")
val jpackageOutputDir = layout.buildDirectory.dir("packaging/jpackage")
val jpackageTempDir = layout.buildDirectory.dir("packaging/tmp")
val preparedRuntimeImageDir = layout.buildDirectory.dir("packaging/runtime-image")
val packagedAppImageDir = jpackageOutputDir.map { output -> output.dir(launcherName.get()) }
val packagedAppLibDir = packagedAppImageDir.map { image -> image.dir("app") }
val packagedAppRuntimeDir = packagedAppImageDir.map { image -> image.dir("runtime") }
val installedAppDir = providers.provider {
    Paths.get(System.getProperty("user.home"), ".local", "opt", launcherName.get())
}
val installedDesktopIcon = installedAppDir.map { installed -> installed.resolve(desktopIconRelativePath.get()) }
val desktopEntryFileName = providers.provider { "${launcherName.get()}.desktop" }
val desktopEntryContent = providers.provider {
    val execPath = installedAppDir.get().resolve("bin").resolve(launcherName.get())
    val iconPath = installedDesktopIcon.get()
    """
    [Desktop Entry]
    Version=1.0
    Type=Application
    Name=${appDisplayName.get()}
    Comment=Launch ${appDisplayName.get()}
    Exec=${execPath.toAbsolutePath()}
    Icon=${iconPath.toAbsolutePath()}
    Terminal=false
    Categories=Utility;Development;
    StartupNotify=true
    """.trimIndent() + "\n"
}

val stageJpackageInput by tasks.registering(Sync::class) {
    dependsOn(tasks.named("jar"))
    from(tasks.named("jar"))
    from(configurations.runtimeClasspath)
    into(jpackageInputDir)
}

val prepareRuntimeImage by tasks.registering {
    description = "Create a materialized runtime image for jpackage without external symlink dependencies."

    inputs.dir(localRuntimeImage)
    outputs.dir(preparedRuntimeImageDir)

    doLast {
        val sourceDir = localRuntimeImage.get().toRealPath()
        val targetDir = preparedRuntimeImageDir.get().asFile.toPath()

        delete(targetDir.toFile())
        Files.createDirectories(targetDir)
        copyRuntimeImage(sourceDir, targetDir)
    }
}

val packageAppImage by tasks.registering(Exec::class) {
    group = "distribution"
    description = "Build a self-contained Linux app image with jpackage."
    dependsOn(stageJpackageInput, prepareRuntimeImage)

    val mainJar = tasks.named<Jar>("jar").flatMap { it.archiveFileName }
    inputs.dir(jpackageInputDir)
    inputs.file(layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}"))
    inputs.dir(preparedRuntimeImageDir)
    outputs.dir(packagedAppImageDir)

    onlyIf {
        resolveJpackageExecutable() != null
    }

    doFirst {
        delete(packagedAppImageDir.get().asFile)
        delete(jpackageTempDir.get().asFile)
        jpackageOutputDir.get().asFile.mkdirs()
        jpackageTempDir.get().asFile.mkdirs()
        val jpackageExecutable = resolveJpackageExecutable()
            ?: error("jpackage executable not found")
        commandLine(
            jpackageExecutable,
            "--type", "app-image",
            "--dest", jpackageOutputDir.get().asFile.absolutePath,
            "--temp", jpackageTempDir.get().asFile.absolutePath,
            "--input", jpackageInputDir.get().asFile.absolutePath,
            "--name", launcherName.get(),
            "--app-version", packageVersion.get(),
            "--vendor", appDisplayName.get(),
            "--icon", layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}").asFile.absolutePath,
            "--runtime-image", preparedRuntimeImageDir.get().asFile.absolutePath,
            "--main-jar", mainJar.get(),
            "--main-class", mainClassName.get(),
            "--java-options", jpackageModulePathArg,
            "--java-options", jpackageAddModulesArg,
            "--java-options", preloaderJvmArg.get()
        )
    }
}

val packageAppImageFallback by tasks.registering {
    group = "distribution"
    description = "Build a self-contained Linux app image without jpackage when the tool is unavailable."
    dependsOn(stageJpackageInput, prepareRuntimeImage)

    inputs.dir(jpackageInputDir)
    inputs.dir(preparedRuntimeImageDir)
    inputs.file(layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}"))
    outputs.dir(packagedAppImageDir)

    onlyIf {
        resolveJpackageExecutable() == null
    }

    doLast {
        val appImageDir = packagedAppImageDir.get().asFile.toPath()
        val appLibDir = packagedAppLibDir.get().asFile.toPath()
        val appRuntimeDir = packagedAppRuntimeDir.get().asFile.toPath()
        val appBinDir = appImageDir.resolve("bin")
        val launcherFile = appBinDir.resolve(launcherName.get())

        delete(appImageDir.toFile())
        Files.createDirectories(appLibDir)
        Files.createDirectories(appRuntimeDir)
        Files.createDirectories(appBinDir)

        copy {
            from(jpackageInputDir)
            into(appLibDir.toFile())
        }
        copyRuntimeImage(preparedRuntimeImageDir.get().asFile.toPath(), appRuntimeDir)

        val launcherScript = """
            |#!/usr/bin/env sh
            |set -eu
            |
            |APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
            |exec "${'$'}APP_DIR/runtime/bin/java" \
            |  "${preloaderJvmArg.get()}" \
            |  --module-path "${'$'}APP_DIR/app" \
            |  --add-modules=javafx.controls \
            |  -cp "${'$'}APP_DIR/app/*" \
            |  ${mainClassName.get()} \
            |  "${'$'}@"
            |""".trimMargin()
        Files.writeString(launcherFile, launcherScript)
        setExecutableFile(launcherFile)
    }
}

val installAppImage by tasks.registering {
    group = "distribution"
    description = "Install the packaged app image into ~/.local/opt/${launcherName.get()}."
    dependsOn(packageAppImage, packageAppImageFallback)

    inputs.dir(packagedAppImageDir)
    inputs.file(layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}"))
    outputs.dir(installedAppDir)

    doLast {
        val sourceDir = packagedAppImageDir.get().asFile.toPath()
        val targetDir = installedAppDir.get()
        val stagingDir = targetDir.resolveSibling("${targetDir.fileName}.tmp")

        delete(stagingDir.toFile())
        copy {
            from(sourceDir)
            into(stagingDir)
        }

        val iconTarget = stagingDir.resolve(desktopIconRelativePath.get())
        Files.createDirectories(iconTarget.parent)
        Files.copy(
            layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}").asFile.toPath(),
            iconTarget,
            StandardCopyOption.REPLACE_EXISTING
        )

        delete(targetDir.toFile())
        Files.move(stagingDir, targetDir, StandardCopyOption.REPLACE_EXISTING)
    }
}

val installDesktopEntries by tasks.registering {
    group = "distribution"
    description = "Install desktop shortcut entries for the packaged SaltMarcher app."
    dependsOn(installAppImage)

    inputs.property("desktopEntryContent", desktopEntryContent)
    outputs.files(
        providers.provider {
            val desktopDir = resolveDesktopDirectory()
            listOf(
                desktopDir.resolve(desktopEntryFileName.get()).toFile(),
                Paths.get(
                    System.getProperty("user.home"),
                    ".local",
                    "share",
                    "applications",
                    desktopEntryFileName.get()
                ).toFile()
            )
        }
    )

    doLast {
        val desktopDir = resolveDesktopDirectory()
        val desktopFile = desktopDir.resolve(desktopEntryFileName.get())
        val applicationsFile = Paths.get(
            System.getProperty("user.home"),
            ".local",
            "share",
            "applications",
            desktopEntryFileName.get()
        )

        Files.createDirectories(desktopDir)
        Files.createDirectories(applicationsFile.parent)
        Files.writeString(desktopFile, desktopEntryContent.get())
        Files.writeString(applicationsFile, desktopEntryContent.get())
        setExecutableFile(desktopFile)
        setExecutableFile(applicationsFile)
    }
}

tasks.register("installDesktopApp") {
    group = "distribution"
    description = "Build, install, and register SaltMarcher as a desktop application."
    dependsOn(installDesktopEntries)
}

tasks.register("checkArchitecture") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs architecture checks from the external build harness."
    dependsOn(gradle.includedBuild("build-harness").task(":check"))
}

val checkNoCompiledArtifactsInSource by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if compiled .class artifacts are present in bootstrap/, shell/ or src/."
    val sourceRoots = listOf("bootstrap", "shell", "src")
        .map { layout.projectDirectory.dir(it).asFile.toPath() }
        .filter(Files::exists)

    doLast {
        val offendingFiles = sourceRoots.flatMap { sourceRoot ->
            Files.walk(sourceRoot).use { paths ->
                paths
                    .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".class") }
                    .map { path -> layout.projectDirectory.asFile.toPath().relativize(path).toString().replace('\\', '/') }
                    .toList()
            }
        }.sorted()

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Compiled artifacts found in source directories.\n" +
                    "Remove them with: find bootstrap shell src -name '*.class' -delete\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkDesktopPackagingInputs by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Validate main class, icon, stylesheet, and launcher metadata required for desktop packaging."

    doLast {
        val mainClassPath = mainClassName.get().replace('.', '/') + ".java"
        val preloaderClassPath = preloaderClassName.get().replace('.', '/') + ".java"
        val sourceRoots = listOf("bootstrap", "shell", "src")
        val mainClassPresent = sourceRoots.any { root ->
            val candidate = layout.projectDirectory.file("$root/${mainClassPath.removePrefix("$root/")}").asFile
            candidate.isFile
        }
        val preloaderClassPresent = sourceRoots.any { root ->
            val candidate = layout.projectDirectory.file("$root/${preloaderClassPath.removePrefix("$root/")}").asFile
            candidate.isFile
        }
        if (!mainClassPresent) {
            throw GradleException("Desktop packaging main class not found: ${mainClassName.get()}")
        }
        if (!preloaderClassPresent) {
            throw GradleException("Desktop packaging preloader class not found: ${preloaderClassName.get()}")
        }

        val iconFile = layout.projectDirectory.file("resources/${desktopIconRelativePath.get()}").asFile
        if (!iconFile.isFile) {
            throw GradleException("Desktop icon is missing: ${iconFile.absolutePath}")
        }

        val stylesheetFile = layout.projectDirectory.file("resources/${stylesheetRelativePath.get()}").asFile
        if (!stylesheetFile.isFile) {
            throw GradleException("Desktop stylesheet is missing: ${stylesheetFile.absolutePath}")
        }

        val launcher = launcherName.get()
        if (!launcher.matches(Regex("[a-z0-9-]+"))) {
            throw GradleException("Launcher name must match [a-z0-9-]+ but was '$launcher'.")
        }
    }
}

tasks.named("check") {
    dependsOn("checkArchitecture")
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkDesktopPackagingInputs)
}

tasks.named("build") {
    dependsOn("checkArchitecture")
    dependsOn(checkDesktopPackagingInputs)
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
        // Non-POSIX filesystems still get valid launchers and desktop entries without chmod support.
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
            val source = if (Files.isSymbolicLink(dir)) {
                dir.toRealPath()
            } else {
                dir
            }
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
