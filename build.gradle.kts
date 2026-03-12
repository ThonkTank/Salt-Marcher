import java.nio.file.Files
import java.nio.file.FileVisitResult
import java.nio.file.FileVisitOption
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.SimpleFileVisitor
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.PosixFilePermission
import java.io.ByteArrayOutputStream
import java.util.EnumSet
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.JavaExec
import org.gradle.jvm.application.tasks.CreateStartScripts
import org.gradle.api.tasks.Sync

plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val desktopAppName = "Salt Marcher"
val launcherName = "salt-marcher"
val preloaderJvmArg = "-Djavafx.preloader=ui.bootstrap.SaltMarcherPreloader"
val jpackageModulePathArg = "--module-path=${'$'}APPDIR"
val jpackageAddModulesArg = "--add-modules=javafx.controls"
val desktopIconRelativePath = "icons/salt-marcher.svg"
val packageVersion = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")
val localRuntimeImage = providers.provider {
    Paths.get(System.getProperty("java.home"))
}

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
            setSrcDirs(listOf("src"))
            exclude("test/**")
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
}

dependencies {
    implementation("org.xerial:sqlite-jdbc:3.45.1.0")
    implementation("org.jsoup:jsoup:1.17.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.17.2")
    runtimeOnly("org.slf4j:slf4j-api:2.0.9")
    runtimeOnly("org.slf4j:slf4j-nop:2.0.9")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

application {
    mainClass = "ui.bootstrap.SaltMarcherApp"
    applicationDefaultJvmArgs = listOf(preloaderJvmArg)
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = launcherName
}

tasks.test {
    useJUnitPlatform()
}

val jpackageInputDir = layout.buildDirectory.dir("packaging/jpackage-input")
val jpackageOutputDir = layout.buildDirectory.dir("packaging/jpackage")
val jpackageTempDir = layout.buildDirectory.dir("packaging/tmp")
val preparedRuntimeImageDir = layout.buildDirectory.dir("packaging/runtime-image")
val packagedAppImageDir = jpackageOutputDir.map { it.dir(launcherName) }
val installedAppDir = providers.provider {
    Paths.get(System.getProperty("user.home"), ".local", "opt", launcherName)
}
val installedDesktopIcon = installedAppDir.map { it.resolve(desktopIconRelativePath) }
val desktopEntryName = "$desktopAppName.desktop"
val desktopEntryContent = providers.provider {
    val execPath = installedAppDir.get().resolve("bin").resolve(launcherName)
    val iconPath = installedDesktopIcon.get()
    """
    [Desktop Entry]
    Version=1.0
    Type=Application
    Name=$desktopAppName
    Comment=Launch Salt Marcher
    Exec=${execPath.toAbsolutePath()}
    Icon=${iconPath.toAbsolutePath()}
    Terminal=false
    Categories=Game;Utility;
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
    inputs.file(layout.projectDirectory.file("resources/$desktopIconRelativePath"))
    inputs.dir(preparedRuntimeImageDir)
    outputs.dir(packagedAppImageDir)

    doFirst {
        delete(packagedAppImageDir.get().asFile)
        delete(jpackageTempDir.get().asFile)
        jpackageOutputDir.get().asFile.mkdirs()
        jpackageTempDir.get().asFile.mkdirs()
        commandLine(
            "jpackage",
            "--type", "app-image",
            "--dest", jpackageOutputDir.get().asFile.absolutePath,
            "--temp", jpackageTempDir.get().asFile.absolutePath,
            "--input", jpackageInputDir.get().asFile.absolutePath,
            "--name", launcherName,
            "--app-version", packageVersion.get(),
            "--vendor", "Salt Marcher",
            "--runtime-image", preparedRuntimeImageDir.get().asFile.absolutePath,
            "--main-jar", mainJar.get(),
            "--main-class", application.mainClass.get(),
            "--java-options", jpackageModulePathArg,
            "--java-options", jpackageAddModulesArg,
            "--java-options", preloaderJvmArg
        )
    }
}

val installAppImage by tasks.registering {
    group = "distribution"
    description = "Install the packaged app image into ~/.local/opt/salt-marcher."
    dependsOn(packageAppImage)

    inputs.dir(packagedAppImageDir)
    inputs.file(layout.projectDirectory.file("resources/$desktopIconRelativePath"))
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

        val iconTarget = stagingDir.resolve(desktopIconRelativePath)
        Files.createDirectories(iconTarget.parent)
        Files.copy(
            layout.projectDirectory.file("resources/$desktopIconRelativePath").asFile.toPath(),
            iconTarget,
            StandardCopyOption.REPLACE_EXISTING
        )

        delete(targetDir.toFile())
        Files.move(stagingDir, targetDir, StandardCopyOption.REPLACE_EXISTING)
    }
}

val installDesktopEntries by tasks.registering {
    group = "distribution"
    description = "Install desktop shortcut entries for the packaged Salt Marcher app."
    dependsOn(installAppImage)

    inputs.property("desktopEntryContent", desktopEntryContent)
    outputs.files(
        providers.provider {
            val desktopDir = resolveDesktopDirectory()
            listOf(
                desktopDir.resolve(desktopEntryName).toFile(),
                Paths.get(System.getProperty("user.home"), ".local", "share", "applications", "$launcherName.desktop").toFile()
            )
        }
    )

    doLast {
        val desktopDir = resolveDesktopDirectory()
        val desktopFile = desktopDir.resolve(desktopEntryName)
        val applicationsFile = Paths.get(
            System.getProperty("user.home"),
            ".local",
            "share",
            "applications",
            "$launcherName.desktop"
        )

        Files.createDirectories(desktopDir)
        Files.createDirectories(applicationsFile.parent)
        Files.writeString(desktopFile, desktopEntryContent.get())
        Files.writeString(applicationsFile, desktopEntryContent.get())
        setExecutableDesktopFile(desktopFile)
        setExecutableDesktopFile(applicationsFile)
    }
}

tasks.register("installDesktopApp") {
    group = "distribution"
    description = "Build, install, and register Salt Marcher as a desktop application."
    dependsOn(installDesktopEntries)
}

fun resolveDesktopDirectory(): Path {
    val output = ByteArrayOutputStream()
    val result = exec {
        commandLine("xdg-user-dir", "DESKTOP")
        standardOutput = output
        isIgnoreExitValue = true
    }
    if (result.exitValue == 0) {
        val path = output.toString().trim()
        if (path.isNotBlank()) {
            return Paths.get(path)
        }
    }
    return Paths.get(System.getProperty("user.home"), "Schreibtisch")
}

fun setExecutableDesktopFile(path: Path) {
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

fun registerJavaExecTask(
    taskName: String,
    taskDescription: String,
    taskMainClass: String,
    dependsOnTask: TaskProvider<*>? = null,
    taskArgs: List<String> = emptyList()
): TaskProvider<JavaExec> = tasks.register<JavaExec>(taskName) {
    group = "application"
    description = taskDescription
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = taskMainClass
    if (dependsOnTask != null) {
        dependsOn(dependsOnTask)
    }
    if (taskArgs.isNotEmpty()) {
        args(taskArgs)
    }
}

val crawlerMonsters = registerJavaExecTask(
    taskName = "crawlerMonsters",
    taskDescription = "Run monster crawler only.",
    taskMainClass = "importer.MonsterCrawler"
)

val importMonsters = registerJavaExecTask(
    taskName = "importMonsters",
    taskDescription = "Run monster importer.",
    taskMainClass = "importer.MonsterImporter",
    dependsOnTask = crawlerMonsters
)

val recoverEncounterTables = registerJavaExecTask(
    taskName = "recoverEncounterTables",
    taskDescription = "Restore encounter tables from backup JSON. Pass --args='--latest' or --args='data/backups/encounter-tables-...json'.",
    taskMainClass = "importer.EncounterTableRecoveryTool"
)

val backfillCreatureAnalysis = registerJavaExecTask(
    taskName = "backfillCreatureAnalysis",
    taskDescription = "Reimport crawled monsters from stored HTML and refresh encounter-analysis caches.",
    taskMainClass = "importer.CreatureAnalysisBackfillTool"
)

val rebuildCreatureAnalysis = registerJavaExecTask(
    taskName = "rebuildCreatureAnalysis",
    taskDescription = "Rebuild persisted creature analysis for current analysis inputs and refresh the active party cache.",
    taskMainClass = "importer.RebuildCreatureAnalysisTool"
)

val applyCreatureOverrides = registerJavaExecTask(
    taskName = "applyCreatureOverrides",
    taskDescription = "Apply versioned creature CR/XP overrides from data/creature_overrides.csv.",
    taskMainClass = "importer.CreatureOverridesTool"
)

val crawlerItems = registerJavaExecTask(
    taskName = "crawlerItems",
    taskDescription = "Run item crawler only.",
    taskMainClass = "features.items.importer.ItemCrawler"
)

val importItems = registerJavaExecTask(
    taskName = "importItems",
    taskDescription = "Run item importer.",
    taskMainClass = "features.items.importer.ItemImporter",
    dependsOnTask = crawlerItems
)

val crawlerItemsSlugs = registerJavaExecTask(
    taskName = "crawlerItemsSlugs",
    taskDescription = "Build magic-item slug list only.",
    taskMainClass = "features.items.importer.ItemCrawler",
    taskArgs = listOf("--build-slugs")
)

val crawlerSpells = registerJavaExecTask(
    taskName = "crawlerSpells",
    taskDescription = "Run spell crawler only.",
    taskMainClass = "features.spells.importer.SpellCrawler"
)

val importSpells = registerJavaExecTask(
    taskName = "importSpells",
    taskDescription = "Run spell importer.",
    taskMainClass = "features.spells.importer.SpellImporter",
    dependsOnTask = crawlerSpells
)

val crawlerSpellsSlugs = registerJavaExecTask(
    taskName = "crawlerSpellsSlugs",
    taskDescription = "Build spell slug list only.",
    taskMainClass = "features.spells.importer.SpellCrawler",
    taskArgs = listOf("--build-slugs")
)

tasks.register("crawler") {
    group = "application"
    description = "Run monster crawler + importer."
    dependsOn(importMonsters)
}

tasks.register("crawlerItemsPipeline") {
    group = "application"
    description = "Run item crawler + importer."
    dependsOn(importItems)
}

tasks.register("crawlerSpellsPipeline") {
    group = "application"
    description = "Run spell crawler + importer."
    dependsOn(importSpells)
}

val checkNoCompiledArtifactsInSource by tasks.registering {
    group = "verification"
    description = "Fail if compiled .class artifacts are present inside src/."

    doLast {
        val sourceRoot = project.layout.projectDirectory.dir("src").asFile.toPath()
        val offendingFiles = Files.walk(sourceRoot)
            .use { paths: java.util.stream.Stream<Path> ->
                paths
                    .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".class") }
                    .map { sourceRoot.relativize(it).toString().replace('\\', '/') }
                    .sorted()
                    .toList()
            }

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - src/$it" }
            throw GradleException(
                "Compiled artifacts found in src/.\n" +
                    "Remove them with: find src -name '*.class' -delete\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkNoStdStreamsInFeatureServicesAndRepositories by tasks.registering {
    group = "verification"
    description = "Fail on new System.out/System.err usage in feature service/repository code."
    val stdStreamPattern = Regex("""System\.(?:out|err)\.println\(""")

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src/features") {
            include("**/service/**/*.java")
            include("**/repository/**/*.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path -> stdStreamPattern.containsMatchIn(file(path).readText()) }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "New System.out/System.err usage detected in feature service/repository code.\n" +
                    "Use structured logging or UI/service-level error reporting helpers.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkRepositorySqlExceptionConvention by tasks.registering {
    group = "verification"
    description = "Fail when new repositories catch and likely swallow SQLException."
    val sqlCatchPattern = Regex("""catch\s*\(\s*SQLException\b""")
    val sqlSwallowPattern = Regex(
        """catch\s*\(\s*SQLException\b[\s\S]*?(?:System\.(?:out|err)\.println\(|return\s+(?:Optional\.empty\(\)|0L|false|null)\s*;)[\s\S]*?\}"""
    )

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src/features") {
            include("**/repository/*Repository.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path ->
                val content = file(path).readText()
                sqlCatchPattern.containsMatchIn(content)
                    && sqlSwallowPattern.containsMatchIn(content)
            }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Repository SQL contract drift detected.\n" +
                    "Repositories should propagate SQLException and let service/application layers decide fallback behavior.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkUiAsyncSubmissionConvention by tasks.registering {
    group = "verification"
    description = "Fail when UI code bypasses UiAsyncTasks and calls UiAsyncExecutor.submit directly."
    val directExecutorPattern = Regex("""\bUiAsyncExecutor\.submit\(""")

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src") {
            include("**/*.java")
            exclude("ui/async/**")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path -> directExecutorPattern.containsMatchIn(file(path).readText()) }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "UI async submission convention drift detected.\n" +
                    "Use UiAsyncTasks.submit(...) as the public entrypoint; keep UiAsyncExecutor.submit(...) internal to ui.async.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkFeatureApiBoundaryConvention by tasks.registering {
    group = "verification"
    description = "Fail when cross-feature consumers bypass feature api packages."

    data class FeatureBoundary(
        val ownerPathPrefix: String,
        val forbiddenImportPrefixes: List<String>
    )

    val importPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
    val boundaries = listOf(
        FeatureBoundary(
            ownerPathPrefix = "features/encounter/",
            forbiddenImportPrefixes = listOf(
                "features.encounter.service.",
                "features.encounter.repository.",
                "features.encounter.ui.",
                "features.encounter.internal.",
                "features.encounter.partyanalysis.api."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/encountertable/",
            forbiddenImportPrefixes = listOf(
                "features.encountertable.service.",
                "features.encountertable.repository.",
                "features.encountertable.ui.",
                "features.encountertable.recovery."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/loottable/",
            forbiddenImportPrefixes = listOf(
                "features.loottable.service.",
                "features.loottable.repository.",
                "features.loottable.ui."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/party/",
            forbiddenImportPrefixes = listOf(
                "features.party.service.",
                "features.party.repository.",
                "features.party.ui."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/world/hexmap/",
            forbiddenImportPrefixes = listOf(
                "features.world.hexmap.service.",
                "features.world.hexmap.repository.",
                "features.world.hexmap.ui."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/creatures/",
            forbiddenImportPrefixes = listOf(
                "features.creatures.application.",
                "features.creatures.repository.",
                "features.creatures.service.",
                "features.creatures.ui.",
                "features.creatures.maintenance."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/partyanalysis/",
            forbiddenImportPrefixes = listOf(
                "features.partyanalysis.application.",
                "features.partyanalysis.repository.",
                "features.partyanalysis.service."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/items/",
            forbiddenImportPrefixes = listOf(
                "features.items.service.",
                "features.items.repository.",
                "features.items.model.",
                "features.items.ui.shared.",
                "features.items.importer."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/campaignstate/",
            forbiddenImportPrefixes = listOf(
                "features.campaignstate.repository."
            )
        )
    )

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src") {
            include("features/**/*.java")
            include("ui/**/*.java")
        }.files
            .flatMap { sourceFile ->
                val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                val relativePath = path.removePrefix("src/")
                val imports = importPattern.findAll(sourceFile.readText())
                    .map { it.groupValues[1] }
                    .toList()
                boundaries.flatMap { boundary ->
                    if (relativePath.startsWith(boundary.ownerPathPrefix)) {
                        emptyList()
                    } else {
                        imports.filter { imported ->
                            boundary.forbiddenImportPrefixes.any(imported::startsWith)
                        }.map { imported -> "$path -> $imported" }
                    }
                }
            }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Feature API boundary drift detected.\n" +
                    "Cross-feature consumers must go through the owning feature's api package.\n" +
                    "Offending imports:\n$details"
            )
        }
    }
}

val checkDungeonEditorArchitectureConvention by tasks.registering {
    group = "verification"
    description = "Fail when dungeon editor UI packages reach through forbidden architecture boundaries."

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val canvasOffenders = fileTree("src/features/world/dungeonmap/ui/canvas") {
            include("**/*.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path ->
                val content = file(path).readText()
                content.contains("features.world.dungeonmap.service.")
                    || content.contains("features.world.dungeonmap.repository.")
            }
            .sorted()

        val editorControllerOffenders = fileTree("src/features/world/dungeonmap/ui/editor") {
            include("**/*Controller.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path ->
                file(path).readText().contains("features.world.dungeonmap.repository.")
            }
            .sorted()

        if (canvasOffenders.isNotEmpty() || editorControllerOffenders.isNotEmpty()) {
            val messages = mutableListOf<String>()
            if (canvasOffenders.isNotEmpty()) {
                messages += "Canvas UI must not import dungeon service/repository packages:\n" +
                    canvasOffenders.joinToString(separator = "\n") { " - $it" }
            }
            if (editorControllerOffenders.isNotEmpty()) {
                messages += "Editor workflow controllers must not import dungeon repository packages:\n" +
                    editorControllerOffenders.joinToString(separator = "\n") { " - $it" }
            }
            throw GradleException(messages.joinToString(separator = "\n\n"))
        }
    }
}

tasks.named("check") {
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkNoStdStreamsInFeatureServicesAndRepositories)
    dependsOn(checkRepositorySqlExceptionConvention)
    dependsOn(checkUiAsyncSubmissionConvention)
    dependsOn(checkFeatureApiBoundaryConvention)
    dependsOn(checkDungeonEditorArchitectureConvention)
}
