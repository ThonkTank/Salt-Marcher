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
import java.io.File
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
    applicationDefaultJvmArgs = listOf(preloaderJvmArg, "--enable-preview")
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.release = 21
    options.compilerArgs.add("--enable-preview")
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
val packagedAppLibDir = packagedAppImageDir.map { it.dir("app") }
val packagedAppRuntimeDir = packagedAppImageDir.map { it.dir("runtime") }
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

val packageAppImageFallback by tasks.registering {
    group = "distribution"
    description = "Build a self-contained Linux app image without jpackage when the tool is unavailable."
    dependsOn(stageJpackageInput, prepareRuntimeImage)

    inputs.dir(jpackageInputDir)
    inputs.dir(preparedRuntimeImageDir)
    inputs.file(layout.projectDirectory.file("resources/$desktopIconRelativePath"))
    outputs.dir(packagedAppImageDir)

    onlyIf {
        resolveJpackageExecutable() == null
    }

    doLast {
        val appImageDir = packagedAppImageDir.get().asFile.toPath()
        val appLibDir = packagedAppLibDir.get().asFile.toPath()
        val appRuntimeDir = packagedAppRuntimeDir.get().asFile.toPath()
        val appBinDir = appImageDir.resolve("bin")
        val launcherFile = appBinDir.resolve(launcherName)

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
            |  "$preloaderJvmArg" \
            |  --module-path "${'$'}APP_DIR/app" \
            |  --add-modules=javafx.controls \
            |  -cp "${'$'}APP_DIR/app/*" \
            |  ${application.mainClass.get()} \
            |  "${'$'}@"
            |""".trimMargin()
        Files.writeString(launcherFile, launcherScript)
        setExecutableFile(launcherFile)
    }
}

val installAppImage by tasks.registering {
    group = "distribution"
    description = "Install the packaged app image into ~/.local/opt/salt-marcher."
    dependsOn(packageAppImage, packageAppImageFallback)

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

val sqliteQuery = registerJavaExecTask(
    taskName = "sqliteQuery",
    taskDescription = "Run ad-hoc SQLite queries without requiring a system sqlite3 binary. Usage: ./gradlew sqliteQuery --args='data/game.db .tables \"select * from dungeon_maps\"'",
    taskMainClass = "importer.SqliteQueryTool"
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
    val sourceRoot = layout.projectDirectory.dir("src").asFile.toPath()

    doLast {
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
    val projectRoot = layout.projectDirectory.asFile.toPath()

    doLast {
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
    val projectRoot = layout.projectDirectory.asFile.toPath()

    doLast {
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
    val projectRoot = layout.projectDirectory.asFile.toPath()

    doLast {
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
    val projectRoot = layout.projectDirectory.asFile.toPath()

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

val checkOwnerApiBoundaryConvention by tasks.registering {
    group = "verification"
    description = "Fail when touched files bypass owner api packages, skip owner hierarchy edges, or place subowners beneath sanctioned owner-internal layers."

    val projectRoot = layout.projectDirectory.asFile.toPath()
    val projectDirFile = layout.projectDirectory.asFile
    val importPattern = Regex("""^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.*]+);""", RegexOption.MULTILINE)
    val packagePattern = Regex("""^\s*package\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
    val transparentLayers = setOf(
        "model",
        "application",
        "tasks",
        "types",
        "repository",
        "state",
        "ui",
        "api",
        "bootstrap"
    )

    fun gitStdout(vararg args: String): String {
        val process = ProcessBuilder(listOf("git", *args))
            .directory(projectDirFile)
            .redirectErrorStream(true)
            .start()
        val output = process.inputStream.bufferedReader().use { reader -> reader.readText() }
        val exitCode = process.waitFor()
        if (exitCode != 0) {
            throw GradleException(
                "Git command failed (${args.joinToString(" ")}).\n$output"
            )
        }
        return output.trim()
    }

    fun gitLines(vararg args: String): List<String> {
        return gitStdout(*args)
            .lines()
            .map(String::trim)
            .filter(String::isNotBlank)
    }

    fun ownerPackagePrefix(packageName: String?): String? {
        if (packageName.isNullOrBlank()) {
            return null
        }
        val segments = packageName.split('.')
        if (segments.size < 2 || segments[0] != "features") {
            return null
        }
        val ownerSegments = mutableListOf(segments[0], segments[1])
        var index = 2
        while (index < segments.size && segments[index] !in transparentLayers) {
            ownerSegments += segments[index]
            index++
        }
        return ownerSegments.joinToString(".")
    }

    fun parentOwnerPackagePrefix(ownerPackagePrefix: String?): String? {
        if (ownerPackagePrefix.isNullOrBlank()) {
            return null
        }
        val segments = ownerPackagePrefix.split('.')
        return if (segments.size <= 2) {
            null
        } else {
            segments.dropLast(1).joinToString(".")
        }
    }

    fun apiPackagePrefix(ownerPackagePrefix: String): String {
        return "$ownerPackagePrefix.api"
    }

    fun importedPackageName(imported: String, knownPackages: Set<String>): String? {
        val normalizedImport = imported.removeSuffix(".*")
        if (!normalizedImport.startsWith("features.")) {
            return null
        }
        var candidate = normalizedImport
        while (true) {
            if (candidate in knownPackages) {
                return candidate
            }
            val lastDot = candidate.lastIndexOf('.')
            if (lastDot < 0) {
                return null
            }
            candidate = candidate.substring(0, lastDot)
        }
    }

    fun nestedOwnerPlacementReason(packageName: String?): String? {
        if (packageName.isNullOrBlank()) {
            return null
        }
        val segments = packageName.split('.')
        if (segments.size < 3 || segments[0] != "features") {
            return null
        }
        val firstLayerIndex = (2 until segments.size).firstOrNull { segments[it] in transparentLayers } ?: return null
        val laterLayerIndex = (firstLayerIndex + 1 until segments.size).firstOrNull { segments[it] in transparentLayers }
            ?: return null
        return "$packageName :: subowners must sit directly under their owner, not beneath ${segments[firstLayerIndex]}"
    }

    fun isNeighbor(sourceOwnerPackagePrefix: String?, targetOwnerPackagePrefix: String): Boolean {
        if (sourceOwnerPackagePrefix == null) {
            return parentOwnerPackagePrefix(targetOwnerPackagePrefix) == null
        }
        val sourceParent = parentOwnerPackagePrefix(sourceOwnerPackagePrefix)
        val targetParent = parentOwnerPackagePrefix(targetOwnerPackagePrefix)
        if (sourceParent == targetOwnerPackagePrefix) {
            return true
        }
        if (targetParent == sourceOwnerPackagePrefix) {
            return true
        }
        return sourceParent != null && sourceParent == targetParent
    }

    fun touchedJavaPaths(): Set<String> {
        val mergeBase = gitStdout("merge-base", "HEAD", "origin/main")
        val changed = linkedSetOf<String>()
        listOf(
            gitLines("diff", "--name-only", "--diff-filter=ACMR", "$mergeBase..HEAD", "--", "src"),
            gitLines("diff", "--name-only", "--cached", "--diff-filter=ACMR", "--", "src"),
            gitLines("diff", "--name-only", "--diff-filter=ACMR", "--", "src"),
            gitLines("ls-files", "--others", "--exclude-standard", "--", "src")
        ).forEach { lines ->
            lines.asSequence()
                .filter { line -> line.endsWith(".java") }
                .forEach(changed::add)
        }
        return changed
    }

    doLast {
        val touchedPaths = touchedJavaPaths()
        if (touchedPaths.isEmpty()) {
            return@doLast
        }
        val knownPackages = fileTree("src") {
            include("**/*.java")
        }.files
            .mapNotNull { sourceFile ->
                packagePattern.find(sourceFile.readText())?.groupValues?.get(1)
            }
            .toSet()

        val offenders = fileTree("src") {
            include("**/*.java")
        }.files
            .asSequence()
            .map { sourceFile ->
                val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                path to sourceFile
            }
            .filter { (path, _) -> path in touchedPaths }
            .flatMap { (path, sourceFile) ->
                val sourceText = sourceFile.readText()
                val sourcePackage = packagePattern.find(sourceText)?.groupValues?.get(1)
                val sourceOwner = ownerPackagePrefix(sourcePackage)
                val packagePlacementOffender = nestedOwnerPlacementReason(sourcePackage)?.let { reason ->
                    sequenceOf("$path :: $reason")
                } ?: emptySequence()
                val importOffenders = importPattern.findAll(sourceText)
                    .map { match -> match.groupValues[1] }
                    .mapNotNull { imported ->
                        val importedPackage = importedPackageName(imported, knownPackages) ?: return@mapNotNull null
                        val targetOwner = ownerPackagePrefix(importedPackage) ?: return@mapNotNull null
                        if (sourceOwner == targetOwner) {
                            return@mapNotNull null
                        }
                        val apiPrefix = apiPackagePrefix(targetOwner)
                        val usesApiPackage = imported == apiPrefix || imported.startsWith("$apiPrefix.")
                        val neighbor = isNeighbor(sourceOwner, targetOwner)
                        if (usesApiPackage && neighbor) {
                            return@mapNotNull null
                        }
                        val sourceLabel = sourceOwner ?: "<external>"
                        val reason = buildString {
                            if (!usesApiPackage) {
                                append("foreign owner imports must go through ")
                                append(apiPrefix)
                            }
                            if (!neighbor) {
                                if (isNotEmpty()) {
                                    append("; ")
                                }
                                append("imports may cross only one owner edge")
                            }
                        }
                        "$path -> $imported :: $sourceLabel -> $targetOwner :: $reason"
                    }
                packagePlacementOffender + importOffenders
            }
            .sorted()
            .toList()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { offender -> " - $offender" }
            throw GradleException(
                "Owner api boundary drift detected.\n" +
                "Touched files may only import foreign owners through the target owner's api package,\n" +
                "each import may cross at most one owner edge, and subowners must sit directly under their owner.\n" +
                "Offending imports:\n$details"
            )
        }
    }
}

val checkDungeonEditorArchitectureConvention by tasks.registering {
    group = "verification"
    description = "Fail when dungeonmap packages drift across forbidden architecture boundaries."
    val importPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
    val projectRoot = layout.projectDirectory.asFile.toPath()

    doLast {
        fun importedPackages(sourceFile: File): List<String> {
            return importPattern.findAll(sourceFile.readText())
                .map { it.groupValues[1] }
                .toList()
        }

        fun packageBoundaryOffenders(
            sourceRoot: String,
            forbiddenPrefixes: List<String>
        ): List<String> {
            return fileTree(sourceRoot) {
                include("**/*.java")
            }.files
                .flatMap { sourceFile ->
                    val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                    importedPackages(sourceFile)
                        .filter { imported -> forbiddenPrefixes.any(imported::startsWith) }
                        .map { imported -> "$path -> $imported" }
                }
                .sorted()
        }

        val legacyPackageOffenders = packageBoundaryOffenders(
            "src/features/world/dungeonmap",
            listOf(
                "features.world.dungeonmap.editor.",
                "features.world.dungeonmap.runtime.",
                "features.world.dungeonmap.shared.")
        )

        val modelBoundaryOffenders = packageBoundaryOffenders(
            "src/features/world/dungeonmap/model",
            listOf(
                "features.world.dungeonmap.application.",
                "features.world.dungeonmap.loading.",
                "features.world.dungeonmap.persistence.",
                "features.world.dungeonmap.state.",
                "features.world.dungeonmap.shell.",
                "features.world.dungeonmap.canvas.",
                "features.world.dungeonmap.catalog.",
                "features.world.dungeonmap.bootstrap.")
        )

        val applicationUiOffenders = packageBoundaryOffenders(
            "src/features/world/dungeonmap/application",
            listOf(
                "features.world.dungeonmap.shell.",
                "features.world.dungeonmap.canvas.",
                "features.world.dungeonmap.bootstrap.")
        )

        val stateBoundaryOffenders = packageBoundaryOffenders(
            "src/features/world/dungeonmap/state",
            listOf(
                "features.world.dungeonmap.shell.",
                "features.world.dungeonmap.canvas.",
                "features.world.dungeonmap.persistence.",
                "features.world.dungeonmap.bootstrap.")
        )

        if (legacyPackageOffenders.isNotEmpty()
            || modelBoundaryOffenders.isNotEmpty()
            || applicationUiOffenders.isNotEmpty()
            || stateBoundaryOffenders.isNotEmpty()
        ) {
            val messages = mutableListOf<String>()
            if (legacyPackageOffenders.isNotEmpty()) {
                messages += "Dungeonmap must not depend on the removed editor/runtime/shared package split:\n" +
                    legacyPackageOffenders.joinToString(separator = "\n") { " - $it" }
            }
            if (modelBoundaryOffenders.isNotEmpty()) {
                messages += "Dungeon model packages must not import higher-layer dungeon packages:\n" +
                    modelBoundaryOffenders.joinToString(separator = "\n") { " - $it" }
            }
            if (applicationUiOffenders.isNotEmpty()) {
                messages += "Dungeon application packages must not import shell/canvas/bootstrap packages:\n" +
                    applicationUiOffenders.joinToString(separator = "\n") { " - $it" }
            }
            if (stateBoundaryOffenders.isNotEmpty()) {
                messages += "Dungeon state packages must not import shell/canvas/persistence/bootstrap packages:\n" +
                    stateBoundaryOffenders.joinToString(separator = "\n") { " - $it" }
            }
            throw GradleException(messages.joinToString(separator = "\n\n"))
        }
    }
}

val checkDungeonGeometryConvention by tasks.registering {
    group = "verification"
    description = "Fail when dungeon public APIs drift away from canonical geometry carriers."

    val projectRoot = layout.projectDirectory.asFile.toPath()
    val allowedRawGeometryCarrierFiles = setOf(
        "src/features/world/dungeon/geometry/GridArea.java",
        "src/features/world/dungeon/geometry/GridBoundary.java",
        "src/features/world/dungeon/geometry/GridPath.java",
        "src/features/world/dungeon/geometry/GridSegmentPath.java"
    )
    val rawGeometryTypePattern = Regex("""\b(?:Collection|List|Set)<Grid(?:Point|Segment)>""")
    val forbiddenGeometryDialectPattern = Regex(
        """\b(?:[A-Za-z0-9_]*2x|movedBy|translatedBy|touchingCells|occupiedPositions|boundarySegments|cellX|cellY)\b"""
    )

    fun signatureBlocks(sourceText: String): List<String> {
        val lines = sourceText.lines()
        val blocks = mutableListOf<String>()
        var index = 0
        while (index < lines.size) {
            val line = lines[index].trim()
            if (!line.startsWith("public ") && !line.startsWith("protected ")) {
                index++
                continue
            }
            val block = StringBuilder(line)
            while (!block.contains("{") && !block.contains(";") && index + 1 < lines.size) {
                index++
                block.append(' ').append(lines[index].trim())
            }
            blocks += block.toString()
            index++
        }
        return blocks
    }

    doLast {
        val offenders = fileTree("src/features/world/dungeon") {
            include("**/*.java")
        }.files
            .flatMap { sourceFile ->
                val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                signatureBlocks(sourceFile.readText()).flatMap { signature ->
                    val problems = mutableListOf<String>()
                    if (path !in allowedRawGeometryCarrierFiles && rawGeometryTypePattern.containsMatchIn(signature)) {
                        problems += "public/protected seam exposes raw GridPoint/GridSegment collections"
                    }
                    if (forbiddenGeometryDialectPattern.containsMatchIn(signature)) {
                        problems += "public/protected seam reintroduces forbidden geometry dialect"
                    }
                    problems.map { problem -> "$path -> $problem -> $signature" }
                }
            }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Dungeon geometry convention drift detected.\n" +
                    "Public and protected dungeon seams must use the canonical geometry carriers and names.\n" +
                    "Offending signatures:\n$details"
            )
        }
    }
}

val deleteEmptySourceDirectories by tasks.registering {
    group = "build setup"
    description = "Delete empty source directories left behind by refactors."

    val projectRoot = layout.projectDirectory.asFile.toPath()
    val sourceRoots = listOf("src", "resources")

    doLast {
        val deletedDirectories = sourceRoots.asSequence()
            .map(layout.projectDirectory::dir)
            .map { it.asFile }
            .filter(File::exists)
            .flatMap { root ->
                root.walkBottomUp()
                    .filter(File::isDirectory)
                    .filter { directory -> directory != root }
                    .filter { directory -> directory.listFiles()?.isEmpty() == true }
                    .onEach(File::delete)
                    .map { directory ->
                        projectRoot.relativize(directory.toPath()).toString().replace('\\', '/')
                    }
            }
            .sorted()
            .toList()

        if (deletedDirectories.isNotEmpty()) {
            logger.lifecycle(
                "Deleted empty source directories:\n{}",
                deletedDirectories.joinToString(separator = "\n") { " - $it" }
            )
        }
    }
}

tasks.named("check") {
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkNoStdStreamsInFeatureServicesAndRepositories)
    dependsOn(checkRepositorySqlExceptionConvention)
    dependsOn(checkUiAsyncSubmissionConvention)
    dependsOn(checkFeatureApiBoundaryConvention)
    dependsOn(checkOwnerApiBoundaryConvention)
    dependsOn(checkDungeonEditorArchitectureConvention)
    dependsOn(checkDungeonGeometryConvention)
}

tasks.named("build") {
    dependsOn(deleteEmptySourceDirectories)
}
