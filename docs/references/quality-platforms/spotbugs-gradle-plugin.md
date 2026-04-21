# Spot Bugs Extension

Original URL: https://spotbugs.github.io/spotbugs-gradle-plugin/spotbugs-gradle-plugin/com.github.spotbugs.snom/-spot-bugs-extension/index.html
Local Source: `docs/references/.tools/html/quality-platforms/spotbugs-gradle-plugin.html`
Source Kind: `downloaded_html`
Accessed: 2026-04-21

spotbugs-gradle-plugin

/

com.github.spotbugs.snom

/

SpotBugsExtension

# SpotBugsExtension

interface

SpotBugsExtension

[SpotBugsExtension](index.html) is an extension used to set up the SpotBugs Gradle plugin. All properties in this extension act as default properties for all instances of [SpotBugsTask](../-spot-bugs-task/index.html) are optional.

### Usage

Once you've applied the SpotBugs Gradle plugin to your project, configure it as shown below:

```
// Required: Gradle 8.2 or higherspotbugs {    ignoreFailures = false    showStackTraces = true    showProgress = true    effort = com.github.spotbugs.snom.Effort.DEFAULT    reportLevel = com.github.spotbugs.snom.Confidence.DEFAULT    visitors = listOf("FindSqlInjection", "SwitchFallthrough")    omitVisitors = listOf("FindNonShortCircuit")    chooseVisitors = listOf("-FindNonShortCircuit", "+TestASM")    reportsDir = file("$buildDir/spotbugs")    includeFilter = file("include.xml")    excludeFilter = file("exclude.xml")    baselineFile = file("baseline.xml")    onlyAnalyze = listOf("com.foobar.MyClass", "com.foobar.mypkg.*")    maxHeapSize = "1g"    extraArgs = listOf("-nested:false")    jvmArgs = listOf("-Duser.language=ja")    runOnCheck = true}
```

Content copied to clipboard

See also [SpotBugs Manual about configuration](https://spotbugs.readthedocs.io/en/stable/running.html).

## Properties

baseline

File

Link copied to clipboard

abstract

val

baselineFile

:

RegularFileProperty

Property to set the baseline file. This file is a Spotbugs result file, and all bugs reported in this file will not be reported in the final output.

choose

Visitors

Link copied to clipboard

abstract

val

chooseVisitors

:

ListProperty

<

String

>

Property to selectively enable/disable visitors (detectors) for analysis. Default is empty that means SpotBugs those visitors run which are enabled by default. This is a list with "+" or "-" before each detectors' name indicating enabling or disabling.

effort

Link copied to clipboard

abstract

val

effort

:

Property

<

Effort

>

Property to adjust SpotBugs detectors. Default value is [Effort.DEFAULT](../-effort/-d-e-f-a-u-l-t/index.html).

exclude

Filter

Link copied to clipboard

abstract

val

excludeFilter

:

RegularFileProperty

Property to set the filter file to limit which bug should be reported.

extra

Args

Link copied to clipboard

abstract

val

extraArgs

:

ListProperty

<

String

>

Property to specify the extra arguments for SpotBugs. Default value is empty so SpotBugs will get no extra argument.

ignore

Failures

Link copied to clipboard

abstract

val

ignoreFailures

:

Property

<

Boolean

>

include

Filter

Link copied to clipboard

abstract

val

includeFilter

:

RegularFileProperty

Property to set the filter file to limit which bug should be reported.

jvm

Args

Link copied to clipboard

abstract

val

jvmArgs

:

ListProperty

<

String

>

Property to specify the extra arguments for JVM process. Default value is empty so JVM process will get no extra argument.

max

Heap

Size

Link copied to clipboard

abstract

val

maxHeapSize

:

Property

<

String

>

Property to specify the max heap size (`-Xmx` option) of JVM process. Default value is empty so the default configuration made by Gradle will be used.

omit

Visitors

Link copied to clipboard

abstract

val

omitVisitors

:

ListProperty

<

String

>

Property to disable visitors (detectors) for analysis. Default is empty that means SpotBugs omits no visitor.

only

Analyze

Link copied to clipboard

abstract

val

onlyAnalyze

:

ListProperty

<

String

>

Property to specify the target classes for analysis. Default value is empty that means all classes are analyzed.

project

Name

Link copied to clipboard

abstract

val

projectName

:

Property

<

String

>

Property to specify the name of project. Some reporting formats use this property. Default value is the name of your Gradle project.

release

Link copied to clipboard

abstract

val

release

:

Property

<

String

>

Property to specify the release identifier of project. Some reporting formats use this property. Default value is the version of your Gradle project.

report

Level

Link copied to clipboard

abstract

val

reportLevel

:

Property

<

Confidence

>

Property to specify the level to report bugs. Default value is [Confidence.DEFAULT](../-confidence/-d-e-f-a-u-l-t/index.html).

reports

Dir

Link copied to clipboard

abstract

val

reportsDir

:

DirectoryProperty

Property to set the directory to generate report files. Default is `"$buildDir/reports/spotbugs"`.

run

On

Check

Link copied to clipboard

abstract

val

runOnCheck

:

Property

<

Boolean

>

Property to specify if the SpotBugs tasks should automatically be marked as dependencies of the check task. Defaults to true.

show

Progress

Link copied to clipboard

abstract

val

showProgress

:

Property

<

Boolean

>

Property to enable progress reporting during the analysis. Default value is `false`.

show

Stack

Traces

Link copied to clipboard

abstract

val

showStackTraces

:

Property

<

Boolean

>

tool

Version

Link copied to clipboard

abstract

val

toolVersion

:

Property

<

String

>

use

Auxclasspath

File

Link copied to clipboard

abstract

val

useAuxclasspathFile

:

Property

<

Boolean

>

use

Java

Toolchains

Link copied to clipboard

abstract

val

useJavaToolchains

:

Property

<

Boolean

>

visitors

Link copied to clipboard

abstract

val

visitors

:

ListProperty

<

String

>

Property to enable visitors (detectors) for analysis. Default is empty that means all visitors run analysis.

Generated by

Dokka

© 2026 Copyright
