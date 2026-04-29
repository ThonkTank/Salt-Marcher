import com.github.spotbugs.snom.Confidence
import com.github.spotbugs.snom.Effort
import com.github.spotbugs.snom.SpotBugsTask
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
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.jvm.application.tasks.CreateStartScripts

plugins {
    java
    application
    pmd
    id("com.github.spotbugs") version "6.5.0"
    id("saltmarcher.quality-conventions")
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("org.sonarqube") version "7.2.3.7755"
}

val appDisplayName = providers.gradleProperty("saltMarcherDisplayName").orElse("SaltMarcher")
val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val packageVersion = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("bootstrap.SaltMarcherPreloader")
val desktopIconSourceRelativePath = providers.gradleProperty("saltMarcherDesktopIconSource")
    .orElse("icons/salt-marcher.svg")
val desktopEntryIconRelativePath = providers.gradleProperty("saltMarcherDesktopEntryIcon")
    .orElse(desktopIconSourceRelativePath)
val windowIconRelativePath = providers.gradleProperty("saltMarcherWindowIcon")
    .orElse("icons/salt-marcher.png")
val startupWmClass = providers.gradleProperty("saltMarcherStartupWmClass")
    .orElse("bootstrap.SaltMarcherApp")
val stylesheetRelativePath = providers.gradleProperty("saltMarcherStylesheet")
    .orElse("salt-marcher.css")
val sonarOrganization = providers.gradleProperty("sonarOrganization")
    .orElse(providers.environmentVariable("SONAR_ORGANIZATION"))
val sonarProjectKey = providers.gradleProperty("sonarProjectKey")
    .orElse(providers.environmentVariable("SONAR_PROJECT_KEY"))

val preloaderJvmArg = preloaderClassName.map { "-Djavafx.preloader=$it" }
val javafxModuleDirName = "javafx"
val jpackageModulePathArg = "--module-path=\$APPDIR/$javafxModuleDirName"
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

apply(from = "tools/quality/enforcement-bundles.gradle.kts")

val focusedEnforcementBundleMode = extra["saltmarcherFocusedEnforcementBundleMode"] as Boolean
@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val rootHostScriptsByBundleId = extra["saltmarcherRootHostScriptsByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .map(rootHostScriptsByBundleId::getValue)
    .forEach { scriptPath ->
        apply(from = scriptPath)
    }
if (!focusedEnforcementBundleMode) {
    apply(from = "tools/quality/documentation-enforcement/root-host.gradle.kts")
}

dependencies {
    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    pmd("net.sourceforge.pmd:pmd-ant:7.23.0")
    pmd("net.sourceforge.pmd:pmd-java:7.23.0")
    pmd("saltmarcher.quality:quality-rules:1.0-SNAPSHOT")
    spotbugsPlugins("com.h3xstream.findsecbugs:findsecbugs-plugin:1.14.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

pmd {
    toolVersion = "7.23.0"
    isConsoleOutput = true
    isIgnoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(layout.projectDirectory.file("tools/quality/config/pmd/complexity-ruleset.xml"))
}

spotbugs {
    ignoreFailures = false
    effort = Effort.MAX
    reportLevel = Confidence.MEDIUM
}

tasks.withType<SpotBugsTask>().configureEach {
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Quality and architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        create("html") {
            required.set(true)
        }
        create("xml") {
            required.set(true)
        }
    }
}

tasks.matching { it.name == "spotbugsTest" }.configureEach {
    enabled = false
}

sonar {
    properties {
        property("sonar.sources", "bootstrap,shell,src")
        property("sonar.tests", "test")
        property("sonar.exclusions", "build/**,tools/gradle/build-harness/**,salt-marcher/**")
        sonarOrganization.orNull?.let { property("sonar.organization", it) }
        sonarProjectKey.orNull?.let { property("sonar.projectKey", it) }
    }
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
    exclude("architecture/**")
}

val architectureRulesetFile = layout.projectDirectory.file("tools/quality/config/pmd/architecture-ruleset.xml")
val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

val architectureTest by tasks.registering(Test::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run only architecture-focused test suites."
    dependsOn(tasks.named("classes"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    include("architecture/**")
    exclude("architecture/view/binder/**")
    exclude("architecture/view/contribution/**")
    exclude("architecture/view/contributionmodel/**")
    exclude("architecture/view/viewlayer/**")
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val pmdArchitectureMain by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run SaltMarcher source-level architecture rules against production Java sources."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(architectureRulesetFile)
    source = files("bootstrap", "shell", "src").asFileTree
    include("**/*.java")
    classpath = files()

    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val localRuntimeImage = providers.provider {
    Paths.get(System.getProperty("java.home"))
}
val jpackageInputDir = layout.buildDirectory.dir("packaging/jpackage-input")
val jpackageOutputDir = layout.buildDirectory.dir("packaging/jpackage")
val jpackageTempDir = layout.buildDirectory.dir("packaging/tmp")
val preparedRuntimeImageDir = layout.buildDirectory.dir("packaging/runtime-image")
val packagedAppImageDir = jpackageOutputDir.map { output -> output.dir(launcherName.get()) }
val packagedAppRuntimeDir = packagedAppImageDir.map { image -> image.dir("runtime") }
val installedAppDir = providers.provider {
    Paths.get(System.getProperty("user.home"), ".local", "opt", launcherName.get())
}
val installedDesktopIcon = installedAppDir.map { installed -> installed.resolve(desktopEntryIconRelativePath.get()) }
val generatedWindowIconFile = layout.buildDirectory.file("generated/window-icon/${windowIconRelativePath.get()}")
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
    StartupWMClass=${startupWmClass.get()}
    """.trimIndent() + "\n"
}

val stageJpackageInput by tasks.registering(Sync::class) {
    dependsOn(tasks.named("jar"))
    from(tasks.named("jar"))
    from({
        configurations.runtimeClasspath.get().filterNot(::isJavafxRuntimeJar)
    })
    from({
        configurations.runtimeClasspath.get().filter(::isJavafxRuntimeJar)
    }) {
        into(javafxModuleDirName)
    }
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
    dependsOn(stageJpackageInput, prepareRuntimeImage, tasks.named("renderDesktopIconPng"))

    val mainJar = tasks.named<Jar>("jar").flatMap { it.archiveFileName }
    inputs.dir(jpackageInputDir)
    inputs.file(generatedWindowIconFile)
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
            "--icon", generatedWindowIconFile.get().asFile.absolutePath,
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
    inputs.file(layout.projectDirectory.file("resources/${desktopIconSourceRelativePath.get()}"))
    outputs.dir(packagedAppImageDir)

    onlyIf {
        resolveJpackageExecutable() == null
    }

    doLast {
        val appImageDir = packagedAppImageDir.get().asFile.toPath()
        val appLibDir = appImageDir.resolve("app")
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
            |  --module-path "${'$'}APP_DIR/app/$javafxModuleDirName" \
            |  --add-modules=javafx.controls \
            |  -cp "${'$'}APP_DIR/app/*" \
            |  ${mainClassName.get()} \
            |  "${'$'}@"
            |""".trimMargin()
        Files.writeString(launcherFile, launcherScript)
        setExecutableFile(launcherFile)
    }
}

val checkDesktopAppImageLayout by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Validate the packaged desktop app image keeps JavaFX on a dedicated module path."
    dependsOn(packageAppImage, packageAppImageFallback)

    inputs.dir(packagedAppImageDir)

    doLast {
        val appImageDir = packagedAppImageDir.get().asFile.toPath()
        val appPayloadDir = resolvePackagedAppPayloadDir(appImageDir)
        val javafxModuleDir = appPayloadDir.resolve(javafxModuleDirName)
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

        val expectedJavafxJarNames = configurations.runtimeClasspath.get()
            .map(File::getName)
            .filter(::isJavafxRuntimeJarName)
            .sorted()
        if (javafxJarNames != expectedJavafxJarNames) {
            throw GradleException(
                "Packaged JavaFX module directory does not match runtime JavaFX jars.\n" +
                    "Expected: $expectedJavafxJarNames\n" +
                    "Actual: $javafxJarNames"
            )
        }

        val jpackageConfigFile = appImageDir.resolve("lib").resolve("app").resolve("${launcherName.get()}.cfg")
        if (Files.isRegularFile(jpackageConfigFile)) {
            val configText = Files.readString(jpackageConfigFile)
            val configLines = configText.lineSequence().toList()
            if ("java-options=$jpackageModulePathArg" !in configLines) {
                throw GradleException("Packaged jpackage config is missing the dedicated JavaFX module path: $jpackageConfigFile")
            }
            if ("java-options=--module-path=\$APPDIR" in configLines) {
                throw GradleException("Packaged jpackage config still points the module path at the whole app directory: $jpackageConfigFile")
            }
            val classpathLines = configLines
                .asSequence()
                .filter { it.startsWith("app.classpath=") }
                .toList()
            val javafxClasspathLines = classpathLines.filter { line ->
                isJavafxRuntimeJarName(line.substringAfterLast('/'))
            }
            val misplacedJavafxClasspathLines = javafxClasspathLines.filterNot { line ->
                line.startsWith("app.classpath=\$APPDIR/$javafxModuleDirName/")
            }
            if (misplacedJavafxClasspathLines.isNotEmpty()) {
                throw GradleException(
                    "Packaged jpackage config must only reference JavaFX jars from the dedicated module directory.\n" +
                        misplacedJavafxClasspathLines.joinToString(separator = "\n")
                )
            }
            return@doLast
        }

        val launcherFile = appImageDir.resolve("bin").resolve(launcherName.get())
        if (!Files.isRegularFile(launcherFile)) {
            throw GradleException("Packaged launcher not found: $launcherFile")
        }
        val launcherText = Files.readString(launcherFile)
        val expectedFallbackModulePath = "--module-path \"${'$'}APP_DIR/app/$javafxModuleDirName\""
        if (!launcherText.contains(expectedFallbackModulePath)) {
            throw GradleException("Fallback launcher is missing the dedicated JavaFX module path: $launcherFile")
        }
        if (launcherText.contains("--module-path \"${'$'}APP_DIR/app\"")) {
            throw GradleException("Fallback launcher still points the module path at the whole app directory: $launcherFile")
        }
    }
}

val installAppImage by tasks.registering {
    group = "distribution"
    description = "Install the packaged app image into ~/.local/opt/${launcherName.get()}."
    dependsOn(checkDesktopAppImageLayout)

    inputs.dir(packagedAppImageDir)
    inputs.file(layout.projectDirectory.file("resources/${desktopIconSourceRelativePath.get()}"))
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

        val iconTarget = stagingDir.resolve(desktopEntryIconRelativePath.get())
        Files.createDirectories(iconTarget.parent)
        Files.copy(
            layout.projectDirectory.file("resources/${desktopIconSourceRelativePath.get()}").asFile.toPath(),
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

fun isJavafxRuntimeJar(file: File): Boolean {
    return isJavafxRuntimeJarName(file.name)
}

fun isJavafxRuntimeJarName(fileName: String): Boolean {
    return fileName.startsWith("javafx-") && fileName.endsWith(".jar")
}

fun resolvePackagedAppPayloadDir(appImageDir: Path): Path {
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
