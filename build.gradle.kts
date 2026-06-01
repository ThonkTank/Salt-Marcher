import com.github.spotbugs.snom.Confidence
import com.github.spotbugs.snom.Effort
import com.github.spotbugs.snom.SpotBugsExtension
import com.github.spotbugs.snom.SpotBugsTask
import org.gradle.api.plugins.JavaApplication
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.application.tasks.CreateStartScripts
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider

plugins {
    java
    application
    pmd
    id("com.github.spotbugs") version "6.5.0"
    id("saltmarcher.quality-conventions")
    id("saltmarcher.verification-core")
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("org.sonarqube") version "7.2.3.7755"
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
            exclude("src/view/leftbartabs/dungeoneditor/**")
        }
    }
}

val dungeonEditorBehaviorHarness by sourceSets.creating {
    java {
        setSrcDirs(listOf("test"))
        include("src/view/leftbartabs/dungeoneditor/**")
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
        create("html") {
            required.set(true)
        }
        create("xml") {
            required.set(true)
        }
    }
}

tasks.named<SpotBugsTask>("spotbugsMain") {
    this.classes = sourceSets["main"].output.classesDirs
    auxClassPaths.from(sourceSets["main"].output.classesDirs)
}

gradle.projectsEvaluated {
    tasks.named<SpotBugsTask>("spotbugsMain") {
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

tasks.register<JavaExec>("dungeonEditorBehaviorHarness") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the focused view-driven Dungeon Editor behavior harness."
    dependsOn(tasks.named(dungeonEditorBehaviorHarness.classesTaskName))
    classpath = dungeonEditorBehaviorHarness.runtimeClasspath
    mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonEditorToolBehaviorHarness")
    inputs.file("docs/dungeon/verification/verification-dungeon-editor-tool-behavior.md")
        .withPropertyName("dungeonEditorBehaviorCatalog")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.dir(dungeonEditorBehaviorHarnessResultsDir)
    outputs.upToDateWhen { false }
    doFirst {
        delete(dungeonEditorBehaviorHarnessDataDir)
        delete(dungeonEditorBehaviorHarnessResultsDir)
        mkdir(dungeonEditorBehaviorHarnessDataDir)
        mkdir(dungeonEditorBehaviorHarnessDataDir.get().dir("salt-marcher"))
        mkdir(dungeonEditorBehaviorHarnessResultsDir)
    }
    environment("XDG_DATA_HOME", dungeonEditorBehaviorHarnessDataDir.get().asFile.absolutePath)
    systemProperty("saltmarcher.dungeonEditorBehavior.resultsDir", dungeonEditorBehaviorHarnessResultsDir.get().asFile.absolutePath)
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
    exclude("architecture/data/persistencecore/**")
    exclude("architecture/domain/layer/**")
    exclude("architecture/view/binder/**")
    exclude("architecture/view/contribution/**")
    exclude("architecture/view/contributionmodel/**")
    exclude("architecture/view/intenthandler/**")
    exclude("architecture/shell/layer/**")
    exclude("architecture/view/viewinputevent/**")
    exclude("architecture/view/viewlayer/**")
    jvmArgumentProviders += objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
        mainClassesDirectory.set(mainJavaClassesDir)
    }
}
