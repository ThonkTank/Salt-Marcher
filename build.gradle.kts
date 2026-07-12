import com.github.spotbugs.snom.Confidence
import com.github.spotbugs.snom.Effort
import com.github.spotbugs.snom.SpotBugsExtension
import com.github.spotbugs.snom.SpotBugsTask
import org.gradle.api.plugins.JavaApplication
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.application.tasks.CreateStartScripts
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.verification.BehaviorHarnessClassification
import saltmarcher.buildlogic.verification.BehaviorHarnessRegistry
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider
import saltmarcher.buildlogic.tasks.hygiene.ValidateSpotbugsCoverageTask

plugins {
    java
    application
    pmd
    id("com.github.spotbugs") version "6.5.0"
    id("saltmarcher.quality-conventions")
    id("saltmarcher.verification-core")
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("org.sonarqube") version "7.3.1.8318"
}

val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("bootstrap.SaltMarcherPreloader")
val sonarOrganization = providers.gradleProperty("sonarOrganization")
    .orElse(providers.environmentVariable("SONAR_ORGANIZATION"))
val sonarProjectKey = providers.gradleProperty("sonarProjectKey")
    .orElse(providers.environmentVariable("SONAR_PROJECT_KEY"))
val complexityRulesetFile = layout.projectDirectory.file("tools/quality/config/pmd/complexity-ruleset.xml")
val lawOfDemeterRulesetFile = layout.projectDirectory.file("tools/quality/config/pmd/law-of-demeter-ruleset.xml")
val spotbugsExcludeFilterFile = layout.projectDirectory.file("tools/quality/config/spotbugs/exclude-filter.xml")

val preloaderJvmArg = preloaderClassName.map { "-Djavafx.preloader=$it" }

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
            exclude("src/domain/dungeon/model/core/structure/corridor/**")
            exclude("src/domain/worldplanner/**")
            exclude("src/view/leftbartabs/dungeoneditor/**")
            exclude("src/view/leftbartabs/worldplanner/**")
        }
    }
}

val dungeonEditorBehaviorHarness by sourceSets.creating {
    java {
        setSrcDirs(listOf("test"))
        include("src/features/dungeon/runtime/**/*.java")
        include("src/view/leftbartabs/dungeoneditor/**")
        include("src/domain/dungeon/**")
    }
    resources {
        setSrcDirs(emptyList<String>())
    }
    compileClasspath += sourceSets["main"].output
    compileClasspath += sourceSets["main"].compileClasspath
    runtimeClasspath += output + compileClasspath + sourceSets["main"].runtimeClasspath
}

tasks.named<JavaCompile>(dungeonEditorBehaviorHarness.compileJavaTaskName) {
    dependsOn(tasks.named(sourceSets["main"].classesTaskName))
    classpath += sourceSets["main"].output + sourceSets["main"].compileClasspath
}

val hexMapEditorBehaviorHarness by sourceSets.creating {
    java {
        setSrcDirs(listOf("."))
        include("shell/api/**")
        include("src/data/persistencecore/sqlite/**")
        include("src/data/party/**")
        include("src/domain/party/**")
        include("test/src/view/leftbartabs/hexmap/**")
        include("test/src/view/statetabs/travel/**")
    }
    resources {
        setSrcDirs(emptyList<String>())
    }
    compileClasspath += sourceSets["main"].output
    compileClasspath += sourceSets["main"].compileClasspath
    runtimeClasspath += output + compileClasspath + sourceSets["main"].runtimeClasspath
}

val worldPlannerBackendHarness by sourceSets.creating {
    java {
        setSrcDirs(listOf("test"))
        include("src/domain/worldplanner/**")
    }
    resources {
        setSrcDirs(emptyList<String>())
    }
    compileClasspath += sourceSets["main"].output
    compileClasspath += sourceSets["main"].compileClasspath
    runtimeClasspath += output + compileClasspath + sourceSets["main"].runtimeClasspath
}

val worldPlannerUiHarness by sourceSets.creating {
    java {
        setSrcDirs(listOf("test"))
        include("src/view/leftbartabs/worldplanner/**")
    }
    resources {
        setSrcDirs(emptyList<String>())
    }
    compileClasspath += sourceSets["main"].output
    compileClasspath += sourceSets["main"].compileClasspath
    runtimeClasspath += output + compileClasspath + sourceSets["main"].runtimeClasspath
}

dependencies {
    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.53.2.0")
    pmd("net.sourceforge.pmd:pmd-ant:7.23.0")
    pmd("net.sourceforge.pmd:pmd-java:7.23.0")
    pmd("saltmarcher.quality:quality-rules:1.0-SNAPSHOT")
    spotbugsPlugins("com.h3xstream.findsecbugs:findsecbugs-plugin:1.14.0")
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.1")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:6.1.1")
    add("hexMapEditorBehaviorHarnessImplementation", "org.junit.jupiter:junit-jupiter:6.1.1")
    add("hexMapEditorBehaviorHarnessRuntimeOnly", "org.junit.platform:junit-platform-launcher")
    add("hexMapEditorBehaviorHarnessRuntimeOnly", "org.junit.jupiter:junit-jupiter-engine:6.1.1")
}

pmd {
    toolVersion = "7.23.0"
    isConsoleOutput = true
    isIgnoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(complexityRulesetFile, lawOfDemeterRulesetFile)
}

spotbugs {
    ignoreFailures = false
    effort = Effort.MAX
    reportLevel = Confidence.MEDIUM
}

tasks.withType<SpotBugsTask>().configureEach {
    excludeFilter.set(spotbugsExcludeFilterFile)
    reports {
        create("xml") {
            required.set(true)
        }
    }
}

val spotbugsMain = tasks.named<SpotBugsTask>("spotbugsMain") {
    this.classes = sourceSets["main"].output.classesDirs
    auxClassPaths.from(sourceSets["main"].output.classesDirs)
}
val spotbugsHtmlReportFile = layout.buildDirectory.file("reports/spotbugs/main.html")
val spotbugsCoverageMarker = layout.buildDirectory.file("verification-markers/spotbugsMainCoverage/success.marker")

val cleanSpotbugsMainEvidence = tasks.register<Delete>("cleanSpotbugsMainEvidence") {
    delete(spotbugsCoverageMarker)
    delete(spotbugsHtmlReportFile)
}

val validateSpotbugsMainCoverage = tasks.register<ValidateSpotbugsCoverageTask>("validateSpotbugsMainCoverage") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if SpotBugs XML reports zero analysed classes while compiled production classes exist."
    xmlReportFile.set(layout.buildDirectory.file("reports/spotbugs/main.xml"))
    compiledClasses.from(sourceSets["main"].output.classesDirs)
    successMarker.set(spotbugsCoverageMarker)
    mustRunAfter(spotbugsMain)
}

spotbugsMain.configure {
    dependsOn(cleanSpotbugsMainEvidence)
    finalizedBy(validateSpotbugsMainCoverage)
}

gradle.projectsEvaluated {
    spotbugsMain.configure {
        init(project.extensions.getByType<SpotBugsExtension>(), false)
    }
}

tasks.named<SpotBugsTask>("spotbugsTest") {
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

val dungeonEditorBehaviorHarnessDataDir = layout.buildDirectory.dir("dungeon-editor-behavior-data")
val dungeonEditorBehaviorHarnessResultsDir = layout.buildDirectory.dir("dungeon-editor-behavior-results")
val dungeonTravelProjectionLevelHarnessDataDir = layout.buildDirectory.dir("dungeon-travel-projection-level-data")
val dungeonTravelProjectionLevelHarnessResultsDir = layout.buildDirectory.dir("dungeon-travel-projection-level-results")
val dungeonMapRenderParityHarnessDataDir = layout.buildDirectory.dir("dungeon-map-render-parity-data")
val dungeonMapRenderParityHarnessResultsDir = layout.buildDirectory.dir("dungeon-map-render-parity-results")
val behaviorHarnesses = extensions.getByType<BehaviorHarnessRegistry>()

fun registerDungeonEditorBehaviorHarnessTask(
    taskName: String,
    taskDescription: String,
    suiteIds: List<String>,
    classification: BehaviorHarnessClassification,
    conceptIds: List<String> = emptyList(),
    setupDependencies: List<String> = emptyList(),
    behaviorDependencies: List<String> = emptyList(),
    aggregateOf: List<String> = emptyList()
) {
    behaviorHarnesses.javaExec(taskName) {
        this.classification.set(classification)
        this.conceptIds.set(conceptIds)
        this.suiteIds.set(suiteIds)
        this.setupDependencies.set(setupDependencies)
        this.behaviorDependencies.set(behaviorDependencies)
        this.aggregateOf.set(aggregateOf)
        task {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            dependsOn(tasks.named(dungeonEditorBehaviorHarness.classesTaskName))
            classpath = dungeonEditorBehaviorHarness.runtimeClasspath
            mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorSuiteHarness")
            args(suiteIds)
            inputs.files(fileTree("docs/dungeon/verification") {
                include("verification-dungeon-*-invariants.md")
                include("verification-dungeon-editor-*.md")
            })
                .withPropertyName("dungeonEditorBehaviorCatalogs")
                .withPathSensitivity(PathSensitivity.RELATIVE)
            inputs.property("dungeonEditorBehaviorSuites", suiteIds.joinToString(","))
            outputs.dir(dungeonEditorBehaviorHarnessResultsDir)
            outputs.upToDateWhen { false }
            doFirst {
                val runDataDir = dungeonEditorBehaviorHarnessDataDir.get()
                    .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
                mkdir(runDataDir)
                mkdir(runDataDir.dir("salt-marcher"))
                mkdir(dungeonEditorBehaviorHarnessResultsDir)
                environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
            }
            systemProperty(
                "saltmarcher.dungeonEditorBehavior.resultsDir",
                dungeonEditorBehaviorHarnessResultsDir.get().asFile.absolutePath
            )
        }
    }
}

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorBehaviorHarness",
    "Run all focused view-driven Dungeon Editor behavior suites.",
    listOf("all"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("core", "routes")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorCoreBehaviorHarness",
    "Run Dungeon Editor core model invariant suites.",
    listOf("core"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf(
        "geometry",
        "component",
        "floor",
        "wall-core",
        "door-core",
        "path-core",
        "corridor-core",
        "stair-core",
        "transition-core",
        "runtime-projection",
        "topology",
        "cluster-core",
        "room-core",
        "structure"
    )
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorRouteBehaviorHarness",
    "Run Dungeon Editor route behavior suites.",
    listOf("routes"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf(
        "map-catalog",
        "map-controls",
        "projection-overlay",
        "selection",
        "stairs",
        "transitions",
        "features",
        "corridors",
        "labels",
        "shared-handles",
        "door-handles",
        "cluster-handles",
        "cluster-routes",
        "doors",
        "rooms",
        "walls"
    )
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorDoorBehaviorHarness",
    "Run Door behavior plus declared geometry/domain dependencies.",
    listOf("doors"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "door-core", "door-handles", "doors")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorWallBehaviorHarness",
    "Run Wall behavior plus declared geometry/domain dependencies.",
    listOf("walls"),
    BehaviorHarnessClassification.FOCUSED,
    conceptIds = listOf("walls"),
    setupDependencies = listOf("wall-core")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorRoomBehaviorHarness",
    "Run Room behavior plus declared geometry/domain dependencies.",
    listOf("rooms"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "room-core", "rooms")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorClusterBehaviorHarness",
    "Run Cluster behavior plus declared geometry/domain dependencies.",
    listOf("labels", "cluster-handles", "cluster-routes"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "cluster-core", "labels", "cluster-handles", "cluster-routes")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorCorridorBehaviorHarness",
    "Run Corridor behavior plus declared geometry/domain dependencies.",
    listOf("corridors"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "corridor-core", "corridors")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorStairBehaviorHarness",
    "Run Stair behavior plus declared geometry/domain dependencies.",
    listOf("stairs"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "stair-core", "stairs")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorTransitionBehaviorHarness",
    "Run Transition behavior plus declared geometry/domain dependencies.",
    listOf("transitions"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "transition-core", "transitions")
)

registerDungeonEditorBehaviorHarnessTask(
    "dungeonEditorFeatureBehaviorHarness",
    "Run Feature-marker behavior plus declared editor-route dependencies.",
    listOf("features"),
    BehaviorHarnessClassification.AGGREGATE,
    aggregateOf = listOf("selection", "features")
)

behaviorHarnesses.javaExec("dungeonEditorBehaviorHarnessSuites") {
    classification.set(BehaviorHarnessClassification.UTILITY)
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Print the available Dungeon Editor behavior suite ids."
        dependsOn(tasks.named(dungeonEditorBehaviorHarness.classesTaskName))
        classpath = dungeonEditorBehaviorHarness.runtimeClasspath
        mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorSuiteHarness")
        args("--list")
    }
}

behaviorHarnesses.javaExec("dungeonTravelProjectionLevelHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("dungeon-travel-projection-level"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Dungeon Travel projection-level behavior harness."
        dependsOn(tasks.named(dungeonEditorBehaviorHarness.classesTaskName))
        classpath = dungeonEditorBehaviorHarness.runtimeClasspath
        mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonTravelProjectionLevelHarness")
        inputs.files(fileTree("docs/dungeon/verification") {
            include("verification-dungeon-travel-*.md")
        })
            .withPropertyName("dungeonTravelBehaviorCatalogs")
            .withPathSensitivity(PathSensitivity.RELATIVE)
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = dungeonTravelProjectionLevelHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            mkdir(dungeonTravelProjectionLevelHarnessResultsDir)
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
        systemProperty(
            "saltmarcher.dungeonEditorBehavior.resultsDir",
            dungeonTravelProjectionLevelHarnessResultsDir.get().asFile.absolutePath
        )
    }
}

behaviorHarnesses.javaExec("dungeonMapRenderParityHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("dungeon-map-render-parity"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Dungeon map render image snapshot parity harness."
        dependsOn(tasks.named(dungeonEditorBehaviorHarness.classesTaskName))
        classpath = dungeonEditorBehaviorHarness.runtimeClasspath
        mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonMapRenderParitySnapshotHarness")
        inputs.files(fileTree("docs/dungeon/verification") {
            include("verification-dungeon-editor-fixtures.md")
            include("verification-dungeon-editor-map-controls.md")
            include("verification-dungeon-editor-walls.md")
            include("verification-dungeon-render-snapshot-parity.md")
            include("verification-dungeon-travel-map-controls.md")
        })
            .withPropertyName("dungeonMapRenderParityCatalogs")
            .withPathSensitivity(PathSensitivity.RELATIVE)
        outputs.dir(dungeonMapRenderParityHarnessResultsDir)
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = dungeonMapRenderParityHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            mkdir(dungeonMapRenderParityHarnessResultsDir)
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
        systemProperty(
            "saltmarcher.dungeonEditorBehavior.resultsDir",
            dungeonMapRenderParityHarnessResultsDir.get().asFile.absolutePath
        )
    }
}

val catalogInitialLoadHarnessDataDir = layout.buildDirectory.dir("catalog-initial-load-data")
val catalogCrudControlsHarnessDataDir = layout.buildDirectory.dir("catalog-crud-controls-data")
val catalogControlsRawInputHarnessDataDir = layout.buildDirectory.dir("catalog-controls-raw-input-data")
val searchFilterControlsHarnessDataDir = layout.buildDirectory.dir("search-filter-controls-data")
val partyDropdownHarnessDataDir = layout.buildDirectory.dir("party-dropdown-data")
val sessionPlannerCatalogHarnessDataDir = layout.buildDirectory.dir("session-planner-catalog-data")
val sessionPlannerShellLayoutHarnessDataDir = layout.buildDirectory.dir("session-planner-shell-layout-data")
val worldPlannerBackendHarnessDataDir = layout.buildDirectory.dir("world-planner-backend-data")
val worldPlannerEncounterHarnessDataDir = layout.buildDirectory.dir("world-planner-encounter-data")
val worldPlannerControlsRawInputHarnessDataDir = layout.buildDirectory.dir("world-planner-controls-raw-input-data")
val worldPlannerUiHarnessDataDir = layout.buildDirectory.dir("world-planner-ui-data")
val smokeStartupHarnessDataDir = layout.buildDirectory.dir("smoke-startup-data")

behaviorHarnesses.javaExec("catalogInitialLoadHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("catalog-initial-load"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the view-driven Catalog initial-load behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.leftbartabs.catalog.CatalogInitialLoadHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = catalogInitialLoadHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("catalogCrudControlsHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("catalog-crud-controls"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the shared Catalog CRUD controls behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = catalogCrudControlsHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("catalogControlsRawInputHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("catalog-controls-raw-input"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the Catalog controls raw-input behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.leftbartabs.catalog.CatalogControlsRawInputHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = catalogControlsRawInputHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("searchFilterControlsHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("search-filter-controls"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the shared search/filter controls behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.slotcontent.controls.searchfilter.SearchFilterControlsHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = searchFilterControlsHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("partyDropdownHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("party-dropdown"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the Party dropdown active-party behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.dropdowns.party.PartyDropdownHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = partyDropdownHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

val hexMapEditorBehaviorHarnessTask = behaviorHarnesses.junitTest("hexMapEditorBehaviorHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("hex-map-editor"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Hex Map editor behavior harness."
        dependsOn(tasks.named(hexMapEditorBehaviorHarness.classesTaskName))
        testClassesDirs = hexMapEditorBehaviorHarness.output.classesDirs
        classpath = hexMapEditorBehaviorHarness.runtimeClasspath
        useJUnitPlatform()
        include("src/view/leftbartabs/hexmap/HexMapEditorBehaviorHarness.class")
        inputs.property("hexMapEditorBehaviorDataTemplate", "salt-marcher")
        doFirst {
            val runDataDir = temporaryDir.resolve("xdg-data")
            delete(runDataDir)
            mkdir(runDataDir)
            mkdir(runDataDir.resolve("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.absolutePath)
        }
    }
}

tasks.named("check") {
    dependsOn(hexMapEditorBehaviorHarnessTask)
}

val hexTravelStateBehaviorHarnessTask = behaviorHarnesses.junitTest("hexTravelStateBehaviorHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("hex-travel-state"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Hex travel state behavior harness."
        dependsOn(tasks.named(hexMapEditorBehaviorHarness.classesTaskName))
        testClassesDirs = hexMapEditorBehaviorHarness.output.classesDirs
        classpath = hexMapEditorBehaviorHarness.runtimeClasspath
        useJUnitPlatform()
        include("src/view/statetabs/travel/TravelStateHexHarness.class")
        inputs.property("hexTravelStateBehaviorDataTemplate", "salt-marcher")
        doFirst {
            val runDataDir = temporaryDir.resolve("xdg-data")
            delete(runDataDir)
            mkdir(runDataDir)
            mkdir(runDataDir.resolve("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.absolutePath)
        }
    }
}

tasks.named("check") {
    dependsOn(hexTravelStateBehaviorHarnessTask)
}

val encounterStateTabHarnessTask = behaviorHarnesses.junitTest("encounterStateTabHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("encounter-state-tab"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Encounter state-tab behavior harness."
        dependsOn(tasks.named("testClasses"))
        testClassesDirs = sourceSets["test"].output.classesDirs
        classpath = sourceSets["test"].runtimeClasspath
        useJUnitPlatform()
        include("src/view/statetabs/encounter/EncounterStateTabHarness.class")
        inputs.property("encounterStateTabDataTemplate", "salt-marcher")
        doFirst {
            val runDataDir = temporaryDir.resolve("xdg-data")
            delete(runDataDir)
            mkdir(runDataDir)
            mkdir(runDataDir.resolve("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.absolutePath)
        }
    }
}

tasks.named("check") {
    dependsOn(encounterStateTabHarnessTask)
}

val encounterTableReadbackHarnessTask = behaviorHarnesses.junitTest("encounterTableReadbackHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("encounter-table-readback"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Encounter Table readback behavior harness."
        dependsOn(tasks.named("testClasses"))
        testClassesDirs = sourceSets["test"].output.classesDirs
        classpath = sourceSets["test"].runtimeClasspath
        useJUnitPlatform()
        include("src/domain/encountertable/EncounterTableReadbackHarness.class")
        inputs.property("encounterTableReadbackDataTemplate", "salt-marcher")
        doFirst {
            val runDataDir = temporaryDir.resolve("xdg-data")
            delete(runDataDir)
            mkdir(runDataDir)
            mkdir(runDataDir.resolve("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.absolutePath)
        }
    }
}

tasks.named("check") {
    dependsOn(encounterTableReadbackHarnessTask)
}

behaviorHarnesses.javaExec("creatureCatalogHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("creature-catalog"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the focused Creature catalog domain behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.domain.creatures.CreatureCatalogHarness")
        outputs.upToDateWhen { false }
    }
}

behaviorHarnesses.javaExec("sessionPlannerCatalogHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("session-planner-catalog"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the Session Planner catalog CRUD behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("src.view.leftbartabs.sessionplanner.SessionPlannerCatalogHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = sessionPlannerCatalogHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("sessionPlannerShellLayoutHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("session-planner-shell-layout"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the Session Planner shell controls layout behavior harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("shell.host.SessionPlannerShellLayoutHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = sessionPlannerShellLayoutHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("worldPlannerBackendHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("world-planner-backend"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the World Planner backend persistence behavior harness."
        dependsOn(tasks.named(worldPlannerBackendHarness.classesTaskName))
        classpath = worldPlannerBackendHarness.runtimeClasspath
        mainClass.set("src.domain.worldplanner.WorldPlannerBackendHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = worldPlannerBackendHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("worldPlannerEncounterHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("world-planner-encounter"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the World Planner encounter source and finite stock behavior harness."
        dependsOn(tasks.named(worldPlannerBackendHarness.classesTaskName))
        classpath = worldPlannerBackendHarness.runtimeClasspath
        mainClass.set("src.domain.encounter.WorldPlannerEncounterHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = worldPlannerEncounterHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("worldPlannerControlsRawInputHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("world-planner-controls-raw-input"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the World Planner controls raw-input behavior harness."
        dependsOn(tasks.named(worldPlannerUiHarness.classesTaskName))
        classpath = worldPlannerUiHarness.runtimeClasspath
        mainClass.set("src.view.leftbartabs.worldplanner.WorldPlannerControlsRawInputHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = worldPlannerControlsRawInputHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("worldPlannerUiHarness") {
    classification.set(BehaviorHarnessClassification.FOCUSED)
    conceptIds.set(listOf("world-planner-ui"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the World Planner left-bar UI production-route behavior harness."
        dependsOn(tasks.named(worldPlannerUiHarness.classesTaskName))
        classpath = worldPlannerUiHarness.runtimeClasspath
        mainClass.set("src.view.leftbartabs.worldplanner.WorldPlannerUiHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = worldPlannerUiHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

behaviorHarnesses.javaExec("smokeStartupHarness") {
    classification.set(BehaviorHarnessClassification.UTILITY)
    suiteIds.set(listOf("startup-smoke"))
    task {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the app bootstrap and SQLite startup smoke harness."
        dependsOn(tasks.named("testClasses"))
        classpath = sourceSets["test"].runtimeClasspath
        mainClass.set("bootstrap.SmokeStartupHarness")
        outputs.upToDateWhen { false }
        doFirst {
            val runDataDir = smokeStartupHarnessDataDir.get()
                .dir("run-" + System.currentTimeMillis() + "-" + ProcessHandle.current().pid())
            mkdir(runDataDir)
            mkdir(runDataDir.dir("salt-marcher"))
            environment("XDG_DATA_HOME", runDataDir.asFile.absolutePath)
        }
    }
}

val mainJavaClassesDir = layout.buildDirectory.dir("classes/java/main")

val architectureTest by tasks.registering(Test::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run only architecture-focused test suites."
    dependsOn(tasks.named("classes"))
    inputs.dir(mainJavaClassesDir)
        .withPropertyName("mainClassesDirectory")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    include("architecture/**")
    jvmArgumentProviders += objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
        mainClassesDirectory.set(mainJavaClassesDir)
    }
}
