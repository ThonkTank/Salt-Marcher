import org.gradle.api.plugins.JavaApplication
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.application.tasks.CreateStartScripts
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider

plugins {
    java
    application
    pmd
    id("saltmarcher.quality-conventions")
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("bootstrap.SaltMarcherPreloader")
val codeSmellsRulesetFile = layout.projectDirectory.file("tools/quality/config/pmd/code-smells.xml")
val javafxVersion = "21.0.2"
val verificationMaxParallelForks = 1

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
    version = javafxVersion
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
        resources {
            setSrcDirs(listOf("test-resources"))
        }
    }
}

dependencies {
    val monocleDependency = "org.testfx:openjfx-monocle:$javafxVersion"

    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.53.2.0")
    pmd("net.sourceforge.pmd:pmd-ant:7.26.0")
    pmd("net.sourceforge.pmd:pmd-java:7.26.0")
    pmd("saltmarcher.quality:quality-rules:1.0-SNAPSHOT")
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.2")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.2")
    testRuntimeOnly(monocleDependency)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:6.1.2")
}

pmd {
    toolVersion = "7.23.0"
    isConsoleOutput = true
    isIgnoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(codeSmellsRulesetFile)
}

tasks.named<Pmd>("pmdTest") {
    enabled = false
    group = null
}

tasks.named<Pmd>("pmdMain") {
    group = null
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
    environment("XDG_DATA_HOME", temporaryDir.resolve("xdg-data").absolutePath)
}

tasks.withType<Test>().configureEach {
    maxParallelForks = verificationMaxParallelForks
    systemProperty("glass.platform", "Monocle")
    systemProperty("monocle.platform", "Headless")
    systemProperty("prism.order", "sw")
    systemProperty("java.awt.headless", "true")
    systemProperty("junit.jupiter.extensions.autodetection.enabled", "true")
}

val mainJavaClassesDir = layout.buildDirectory.dir("classes/java/main")

tasks.register<Test>("architectureTest") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run only architecture-focused test suites."
    dependsOn(tasks.named("classes"))
    inputs.dir(mainJavaClassesDir)
        .withPropertyName("mainClassesDirectory")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("architecture")
    }
    jvmArgumentProviders += objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
        mainClassesDirectory.set(mainJavaClassesDir)
    }
}

tasks.register<Test>("uiTest") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run headless JavaFX behavior tests."
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("ui")
    }
    environment("XDG_DATA_HOME", temporaryDir.resolve("xdg-data").absolutePath)
}
