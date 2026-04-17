import java.io.File
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URI
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
import java.util.zip.ZipInputStream
import net.ltgt.gradle.errorprone.errorprone
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
    id("net.ltgt.errorprone") version "5.1.0"
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("org.sonarqube") version "7.2.3.7755"
}

val appDisplayName = providers.gradleProperty("saltMarcherDisplayName").orElse("SaltMarcher")
val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val packageVersion = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("bootstrap.SaltMarcherPreloader")
val desktopIconRelativePath = providers.gradleProperty("saltMarcherDesktopIcon")
    .orElse("icons/salt-marcher.png")
val stylesheetRelativePath = providers.gradleProperty("saltMarcherStylesheet")
    .orElse("salt-marcher.css")
val lizardVersion = "1.21.3"
val cpdVersion = "7.23.0"
val ckjmExtVersion = "2.10"
val sonarOrganization = providers.gradleProperty("sonarOrganization")
    .orElse(providers.environmentVariable("SONAR_ORGANIZATION"))
val sonarProjectKey = providers.gradleProperty("sonarProjectKey")
    .orElse(providers.environmentVariable("SONAR_PROJECT_KEY"))

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
    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    errorprone("com.google.errorprone:error_prone_core:2.48.0")
    errorprone("com.uber.nullaway:nullaway:0.13.1")
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
    ruleSetFiles = files(layout.projectDirectory.file("config/pmd/complexity-ruleset.xml"))
}

tasks.withType<Pmd>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

sonar {
    properties {
        property("sonar.sources", "bootstrap,shell,src")
        property("sonar.tests", "test")
        property("sonar.exclusions", "build/**,build-harness/**,salt-marcher/**")
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
}

tasks.withType<JavaCompile>().configureEach {
    options.errorprone.enabled.set(false)
}

tasks.named<JavaCompile>("compileJava") {
    options.errorprone.enabled.set(true)
    options.errorprone.disableWarningsInGeneratedCode.set(true)
    options.errorprone.disable("StringConcatToTextBlock")
    options.errorprone.error("NullAway")
    options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
    options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
}

val lizardRequirementsFile = layout.projectDirectory.file("config/lizard/requirements.txt")
val lizardVenvDir = layout.buildDirectory.dir("tools/lizard-venv")
val lizardReadyMarker = layout.buildDirectory.file("tools/lizard-venv/.lizard-ready")
val lizardReportFile = layout.buildDirectory.file("reports/lizard/main.txt")
val cpdToolDir = layout.buildDirectory.dir("tools/pmd-cpd")
val cpdReadyMarker = layout.buildDirectory.file("tools/pmd-cpd/.cpd-ready")
val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
val ckjmToolDir = layout.buildDirectory.dir("tools/ckjm")
val ckjmLibDir = layout.buildDirectory.dir("tools/ckjm/lib")
val ckjmReadyMarker = layout.buildDirectory.file("tools/ckjm/.ckjm-ready")
val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")
val ckjmConfiguration = configurations.detachedConfiguration(
    dependencies.create("gr.spinellis.ckjm:ckjm_ext:$ckjmExtVersion"),
    dependencies.create("org.apache.bcel:bcel:6.11.0"),
    dependencies.create("org.apache.ant:ant:1.10.15"),
    dependencies.create("org.apache.commons:commons-math3:3.6.1")
).apply {
    isTransitive = true
}

val setupLizard by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Create a build-local Python environment with the pinned Lizard version."

    inputs.file(lizardRequirementsFile)
    outputs.file(lizardReadyMarker)

    doLast {
        val requirementsPath = lizardRequirementsFile.asFile.toPath()
        val venvPath = lizardVenvDir.get().asFile.toPath()
        val readyMarkerPath = lizardReadyMarker.get().asFile.toPath()

        delete(venvPath.toFile())

        runCommandOrThrow(
            layout.projectDirectory.asFile.toPath(),
            "python3",
            "-m",
            "venv",
            venvPath.toString()
        )

        val venvPython = resolveVenvPythonExecutable(venvPath)
        runCommandOrThrow(
            layout.projectDirectory.asFile.toPath(),
            venvPython.toString(),
            "-m",
            "pip",
            "install",
            "--requirement",
            requirementsPath.toString()
        )

        Files.createDirectories(readyMarkerPath.parent)
        Files.writeString(readyMarkerPath, Files.readString(requirementsPath))
    }
}

val lizardMain by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run Lizard complexity checks against production Java sources."
    dependsOn(setupLizard)

    inputs.files(
        fileTree("bootstrap") { include("**/*.java") },
        fileTree("shell") { include("**/*.java") },
        fileTree("src") { include("**/*.java") }
    )
    inputs.file(lizardRequirementsFile)
    outputs.file(lizardReportFile)

    doLast {
        val venvPython = resolveVenvPythonExecutable(lizardVenvDir.get().asFile.toPath())
        val reportPath = lizardReportFile.get().asFile.toPath()
        val outputBuffer = ByteArrayOutputStream()
        val exitCode = runCommand(
            layout.projectDirectory.asFile.toPath(),
            outputBuffer,
            venvPython.toString(),
            "-m",
            "lizard",
            "-l",
            "java",
            "-C",
            "15",
            "bootstrap",
            "shell",
            "src"
        )

        val outputText = String(outputBuffer.toByteArray(), Charsets.UTF_8)
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, outputText)

        if (exitCode != 0 && outputText.isNotBlank()) {
            println(outputText.trimEnd())
        }

        if (exitCode != 0) {
            throw GradleException(
                "Lizard complexity violations were found. See the report at: file://${reportPath.toAbsolutePath()}"
            )
        }
    }
}

val setupCpd by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Download and extract a build-local PMD distribution for CPD."

    inputs.property("cpdVersion", cpdVersion)
    outputs.file(cpdReadyMarker)

    doLast {
        val toolRoot = cpdToolDir.get().asFile.toPath()
        val readyMarkerPath = cpdReadyMarker.get().asFile.toPath()
        val distributionUrl = URI(
            "https://github.com/pmd/pmd/releases/download/pmd_releases%2F$cpdVersion/pmd-dist-$cpdVersion-bin.zip"
        ).toURL()

        delete(toolRoot.toFile())
        Files.createDirectories(toolRoot)

        downloadAndExtractZip(distributionUrl, toolRoot)

        val distributionRoot = resolvePmdDistributionRoot(toolRoot)
        if (!Files.isDirectory(distributionRoot.resolve("lib"))) {
            throw GradleException("Extracted CPD distribution is missing lib/: $distributionRoot")
        }

        Files.createDirectories(readyMarkerPath.parent)
        Files.writeString(readyMarkerPath, cpdVersion)
    }
}

val cpdMain by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run PMD CPD duplicate-code checks against production Java sources."
    dependsOn(setupCpd)

    inputs.files(
        fileTree("bootstrap") { include("**/*.java") },
        fileTree("shell") { include("**/*.java") },
        fileTree("src") { include("**/*.java") }
    )
    inputs.property("cpdVersion", cpdVersion)
    outputs.file(cpdReportFile)

    doLast {
        val reportPath = cpdReportFile.get().asFile.toPath()
        val toolRoot = resolvePmdDistributionRoot(cpdToolDir.get().asFile.toPath())
        val javaExecutable = resolveJavaExecutable()
        val classpath = toolRoot.resolve("lib").resolve("*").toString()
        val outputBuffer = ByteArrayOutputStream()
        Files.createDirectories(reportPath.parent)

        val exitCode = runCommand(
            layout.projectDirectory.asFile.toPath(),
            outputBuffer,
            javaExecutable.toString(),
            "-cp",
            classpath,
            "net.sourceforge.pmd.cli.PmdCli",
            "cpd",
            "--minimum-tokens",
            "80",
            "--language",
            "java",
            "--format",
            "text",
            "--report-file",
            reportPath.toString(),
            "--dir",
            "bootstrap",
            "--dir",
            "shell",
            "--dir",
            "src"
        )

        val outputText = String(outputBuffer.toByteArray(), Charsets.UTF_8).trim()
        if (exitCode != 0) {
            val reportText = if (Files.exists(reportPath)) {
                Files.readString(reportPath).trim()
            } else {
                ""
            }
            if (reportText.isNotBlank()) {
                println(reportText)
            }
            if (outputText.isNotBlank()) {
                println(outputText)
            }
            throw GradleException(
                "CPD duplicate-code violations were found. See the report at: file://${reportPath.toAbsolutePath()}"
            )
        }

        if (!Files.exists(reportPath)) {
            Files.writeString(reportPath, "")
        }
    }
}

val setupCkjm by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Resolve build-local CKJM ext libraries for OO metrics reporting."

    inputs.files(ckjmConfiguration)
    outputs.file(ckjmReadyMarker)

    doLast {
        val toolRoot = ckjmToolDir.get().asFile.toPath()
        val libDir = ckjmLibDir.get().asFile.toPath()
        val readyMarkerPath = ckjmReadyMarker.get().asFile.toPath()
        val resolvedFiles = ckjmConfiguration.resolve().sortedBy { it.name }

        delete(toolRoot.toFile())
        Files.createDirectories(libDir)
        resolvedFiles.forEach { file ->
            Files.copy(
                file.toPath(),
                libDir.resolve(file.name),
                StandardCopyOption.REPLACE_EXISTING
            )
        }

        Files.createDirectories(readyMarkerPath.parent)
        Files.writeString(readyMarkerPath, resolvedFiles.joinToString(separator = "\n") { it.name })
    }
}

val ckjmMain by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run CKJM ext OO metrics against compiled production classes and write reports."
    dependsOn(tasks.named("classes"))
    dependsOn(setupCkjm)

    inputs.files(
        fileTree(layout.buildDirectory.dir("classes/java/main")) {
            include("**/*.class")
        }
    )
    inputs.property("ckjmExtVersion", ckjmExtVersion)
    outputs.files(ckjmReportFile, ckjmSummaryFile)

    doLast {
        val classesDir = layout.buildDirectory.dir("classes/java/main").get().asFile.toPath()
        val libDir = ckjmLibDir.get().asFile.toPath()
        val reportPath = ckjmReportFile.get().asFile.toPath()
        val summaryPath = ckjmSummaryFile.get().asFile.toPath()

        val classFiles = Files.walk(classesDir).use { paths ->
            paths
                .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".class") }
                .sorted()
                .map(Path::toString)
                .toList()
        }

        Files.createDirectories(reportPath.parent)
        if (classFiles.isEmpty()) {
            Files.writeString(reportPath, "")
            Files.writeString(summaryPath, "# CKJM Summary\n\nNo compiled production classes were found.\n")
            return@doLast
        }

        val classpath = Files.list(libDir).use { paths ->
            val ckjmEntries = paths
                .filter { path -> Files.isRegularFile(path) }
                .sorted()
                .map(Path::toString)
                .toList()
            val runtimeEntries = sourceSets.getByName("main").runtimeClasspath.files
                .map(File::toString)
                .sorted()
            (ckjmEntries + runtimeEntries)
                .distinct()
                .joinToString(File.pathSeparator)
        }

        val outputBuffer = ByteArrayOutputStream()
        val command = mutableListOf(
            resolveJavaExecutable().toString(),
            "-cp",
            classpath,
            "gr.spinellis.ckjm.MetricsFilter"
        )
        command.addAll(classFiles)
        val exitCode = runCommand(
            layout.projectDirectory.asFile.toPath(),
            outputBuffer,
            *command.toTypedArray()
        )

        val outputText = String(outputBuffer.toByteArray(), Charsets.UTF_8)
        Files.writeString(reportPath, outputText)
        Files.writeString(summaryPath, summarizeCkjmOutput(outputText))

        if (exitCode != 0) {
            val suffix = if (outputText.isBlank()) "" else "\n${outputText.trimEnd()}"
            throw GradleException("CKJM ext failed with exit code $exitCode.$suffix")
        }
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
    dependsOn(lizardMain)
    dependsOn(cpdMain)
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

fun resolveJavaExecutable(): Path {
    val javaPath = Paths.get(System.getProperty("java.home"), "bin", executableName("java"))
    if (!Files.isRegularFile(javaPath) || !Files.isExecutable(javaPath)) {
        throw GradleException("Java executable not found: $javaPath")
    }
    return javaPath
}

fun resolveVenvPythonExecutable(venvPath: Path): Path {
    val scriptPath = if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
        venvPath.resolve("Scripts").resolve(executableName("python"))
    } else {
        venvPath.resolve("bin").resolve(executableName("python"))
    }
    if (!Files.isRegularFile(scriptPath) || !Files.isExecutable(scriptPath)) {
        throw GradleException("Lizard virtualenv Python executable not found: $scriptPath")
    }
    return scriptPath
}

fun resolvePmdDistributionRoot(toolRoot: Path): Path {
    val directories = Files.list(toolRoot).use { paths ->
        paths.filter(Files::isDirectory).toList()
    }
    if (directories.size != 1) {
        throw GradleException("Expected exactly one extracted PMD directory in $toolRoot but found ${directories.size}.")
    }
    return directories.single()
}

fun downloadAndExtractZip(sourceUrl: java.net.URL, destinationDir: Path) {
    sourceUrl.openStream().use { input: InputStream ->
        ZipInputStream(input).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val target = destinationDir.resolve(Paths.get(entry.name)).normalize()
                if (!target.startsWith(destinationDir)) {
                    throw GradleException("Unsafe zip entry path: ${entry.name}")
                }
                if (entry.isDirectory) {
                    Files.createDirectories(target)
                } else {
                    Files.createDirectories(target.parent)
                    Files.copy(zip, target, StandardCopyOption.REPLACE_EXISTING)
                }
                zip.closeEntry()
            }
        }
    }
}

fun downloadFile(sourceUrl: java.net.URL, destinationFile: Path) {
    Files.createDirectories(destinationFile.parent)
    sourceUrl.openStream().use { input ->
        Files.copy(input, destinationFile, StandardCopyOption.REPLACE_EXISTING)
    }
}

fun runCommand(workingDirectory: Path, outputBuffer: ByteArrayOutputStream, vararg command: String): Int {
    val process = ProcessBuilder(*command)
        .directory(workingDirectory.toFile())
        .redirectErrorStream(true)
        .start()
    process.inputStream.use { input -> outputBuffer.writeBytes(input.readAllBytes()) }
    return process.waitFor()
}

fun runCommandOrThrow(workingDirectory: Path, vararg command: String) {
    val outputBuffer = ByteArrayOutputStream()
    val exitCode = runCommand(workingDirectory, outputBuffer, *command)
    if (exitCode != 0) {
        val outputText = String(outputBuffer.toByteArray(), Charsets.UTF_8).trim()
        val commandText = command.joinToString(" ")
        val suffix = if (outputText.isBlank()) {
            ""
        } else {
            "\n$outputText"
        }
        throw GradleException("Command failed with exit code $exitCode: $commandText$suffix")
    }
}

fun summarizeCkjmOutput(outputText: String): String {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    if (rawLines.isEmpty()) {
        return "# CKJM Summary\n\nNo CKJM output was produced.\n"
    }

    data class CkjmMetricRow(
        val className: String,
        val wmc: Double,
        val cbo: Double,
        val rfc: Double,
        val lcom: Double,
        val maxCc: Double?
    )

    fun parseDouble(parts: List<String>, index: Int): Double? {
        return parts.getOrNull(index)?.toDoubleOrNull()
    }

    val metricRows = rawLines.mapNotNull { line ->
        val parts = line.split(Regex("\\s+"))
        val className = parts.firstOrNull() ?: return@mapNotNull null
        val wmc = parseDouble(parts, 1) ?: return@mapNotNull null
        val cbo = parseDouble(parts, 4) ?: return@mapNotNull null
        val rfc = parseDouble(parts, 5) ?: return@mapNotNull null
        val lcom = parseDouble(parts, 6) ?: return@mapNotNull null
        CkjmMetricRow(
            className = className,
            wmc = wmc,
            cbo = cbo,
            rfc = rfc,
            lcom = lcom,
            maxCc = parseDouble(parts, 19)
        )
    }

    if (metricRows.isEmpty()) {
        val preview = rawLines.take(20).joinToString(separator = "\n") { "- `$it`" }
        return buildString {
            appendLine("# CKJM Summary")
            appendLine()
            appendLine("CKJM produced output, but the rows did not match the expected metric format.")
            appendLine()
            appendLine("## Raw Preview")
            appendLine(preview)
            if (rawLines.size > 20) {
                appendLine()
                appendLine("...and ${rawLines.size - 20} more rows.")
            }
        }
    }

    fun topSection(
        title: String,
        selector: (CkjmMetricRow) -> Double?,
        rows: List<CkjmMetricRow> = metricRows
    ): String {
        val topRows = rows
            .mapNotNull { row -> selector(row)?.let { value -> row to value } }
            .sortedByDescending { (_, value) -> value }
            .take(5)
        if (topRows.isEmpty()) {
            return ""
        }
        return buildString {
            appendLine("## $title")
            appendLine()
            topRows.forEach { (row, value) ->
                appendLine("- `${row.className}`: ${"%.2f".format(value)}")
            }
            appendLine()
        }
    }

    return buildString {
        appendLine("# CKJM Summary")
        appendLine()
        appendLine("- Analysed classes: ${metricRows.size}")
        appendLine("- Raw rows: ${rawLines.size}")
        appendLine()
        append(topSection("Highest WMC", { it.wmc }))
        append(topSection("Highest CBO", { it.cbo }))
        append(topSection("Highest RFC", { it.rfc }))
        append(topSection("Highest LCOM", { it.lcom }))
        append(topSection("Highest Max Cyclomatic Complexity", { it.maxCc }))
    }.trimEnd() + "\n"
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
