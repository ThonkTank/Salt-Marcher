# Finding duplicated code with CPD

Original URL: https://docs.pmd-code.org/pmd-doc-7.23.0/pmd_userdocs_cpd.html
Local Source: `docs/references/.tools/html/quality-platforms/pmd-cpd.html`
Source Kind: `downloaded_html`
Accessed: 2026-04-21

- PMD 7.23.0
- [About](#)

[Home](index.html)
[Release notes](pmd_release_notes.html)
[Release notes (PMD 7)](pmd_release_notes_pmd7.html)
[Getting help](pmd_about_help.html)
[Release policies](pmd_about_release_policies.html)
[Support lifecycle](pmd_about_support_lifecycle.html)
[Security](pmd_about_security.html)
- [User Documentation](#)

[Migration Guide for PMD 7](pmd_userdocs_migrating_to_pmd7.html)
[Installation and basic CLI usage](pmd_userdocs_installation.html)
[Making rulesets](pmd_userdocs_making_rulesets.html)
[Configuring rules](pmd_userdocs_configuring_rules.html)
[Best practices](pmd_userdocs_best_practices.html)
[Suppressing warnings](pmd_userdocs_suppressing_warnings.html)
[Incremental analysis](pmd_userdocs_incremental_analysis.html)
[PMD CLI reference](pmd_userdocs_cli_reference.html)
[PMD Report formats](pmd_userdocs_report_formats.html)
[3rd party rulesets](pmd_userdocs_3rdpartyrulesets.html)
[Signed Releases](pmd_userdocs_signed_releases.html)

[CPD reference](#)

[Copy-paste detection](pmd_userdocs_cpd.html)
[CPD Report formats](pmd_userdocs_cpd_report_formats.html)

[Extending PMD](#)

[Introduction to writing rules](pmd_userdocs_extending_writing_rules_intro.html)
[Your first rule](pmd_userdocs_extending_your_first_rule.html)
[XPath rules](pmd_userdocs_extending_writing_xpath_rules.html)
[Java rules](pmd_userdocs_extending_writing_java_rules.html)
[Rule designer reference](pmd_userdocs_extending_designer_reference.html)
[Defining rule properties](pmd_userdocs_extending_defining_properties.html)
[Rule guidelines](pmd_userdocs_extending_rule_guidelines.html)
[Testing your rules](pmd_userdocs_extending_testing.html)
[Creating (XML) dump of the AST](pmd_userdocs_extending_ast_dump.html)

[Tools / Integrations](#)

[Maven PMD Plugin](pmd_userdocs_tools_maven.html)
[Gradle](pmd_userdocs_tools_gradle.html)
[Ant](pmd_userdocs_tools_ant.html)
[PMD Java API](pmd_userdocs_tools_java_api.html)
[bld PMD Extension](pmd_userdocs_tools_bld.html)
[CI integrations](pmd_userdocs_tools_ci.html)
[IDE Plugins](pmd_userdocs_tools_ide_plugins.html)
[Other Tools / Integrations](pmd_userdocs_tools.html)
- [Rule Reference](#)

[Apex Rules](#)

[Index](pmd_rules_apex.html)
[Best Practices](pmd_rules_apex_bestpractices.html)
[Code Style](pmd_rules_apex_codestyle.html)
[Design](pmd_rules_apex_design.html)
[Documentation](pmd_rules_apex_documentation.html)
[Error Prone](pmd_rules_apex_errorprone.html)
[Performance](pmd_rules_apex_performance.html)
[Security](pmd_rules_apex_security.html)

[HTML Rules](#)

[Index](pmd_rules_html.html)
[Best Practices](pmd_rules_html_bestpractices.html)

[Java Rules](#)

[Index](pmd_rules_java.html)
[Best Practices](pmd_rules_java_bestpractices.html)
[Code Style](pmd_rules_java_codestyle.html)
[Design](pmd_rules_java_design.html)
[Documentation](pmd_rules_java_documentation.html)
[Error Prone](pmd_rules_java_errorprone.html)
[Multithreading](pmd_rules_java_multithreading.html)
[Performance](pmd_rules_java_performance.html)
[Security](pmd_rules_java_security.html)

[Java Server Pages Rules](#)

[Index](pmd_rules_jsp.html)
[Best Practices](pmd_rules_jsp_bestpractices.html)
[Code Style](pmd_rules_jsp_codestyle.html)
[Design](pmd_rules_jsp_design.html)
[Error Prone](pmd_rules_jsp_errorprone.html)
[Security](pmd_rules_jsp_security.html)

[JavaScript Rules](#)

[Index](pmd_rules_ecmascript.html)
[Best Practices](pmd_rules_ecmascript_bestpractices.html)
[Code Style](pmd_rules_ecmascript_codestyle.html)
[Error Prone](pmd_rules_ecmascript_errorprone.html)
[Performance](pmd_rules_ecmascript_performance.html)

[Kotlin Rules](#)

[Index](pmd_rules_kotlin.html)
[Best Practices](pmd_rules_kotlin_bestpractices.html)
[Error Prone](pmd_rules_kotlin_errorprone.html)

[Maven POM Rules](#)

[Index](pmd_rules_pom.html)
[Error Prone](pmd_rules_pom_errorprone.html)

[Modelica Rules](#)

[Index](pmd_rules_modelica.html)
[Best Practices](pmd_rules_modelica_bestpractices.html)

[PLSQL Rules](#)

[Index](pmd_rules_plsql.html)
[Best Practices](pmd_rules_plsql_bestpractices.html)
[Code Style](pmd_rules_plsql_codestyle.html)
[Design](pmd_rules_plsql_design.html)
[Error Prone](pmd_rules_plsql_errorprone.html)

[Salesforce Visualforce Rules](#)

[Index](pmd_rules_visualforce.html)
[Security](pmd_rules_visualforce_security.html)

[Scala Rules](#)

[Index](pmd_rules_scala.html)

[Swift Rules](#)

[Index](pmd_rules_swift.html)
[Best Practices](pmd_rules_swift_bestpractices.html)
[Error Prone](pmd_rules_swift_errorprone.html)

[Velocity Template Language (VTL) Rules](#)

[Index](pmd_rules_velocity.html)
[Best Practices](pmd_rules_velocity_bestpractices.html)
[Design](pmd_rules_velocity_design.html)
[Error Prone](pmd_rules_velocity_errorprone.html)

[WSDL Rules](#)

[Index](pmd_rules_wsdl.html)

[XML Rules](#)

[Index](pmd_rules_xml.html)
[Best Practices](pmd_rules_xml_bestpractices.html)
[Error Prone](pmd_rules_xml_errorprone.html)

[XSL Rules](#)

[Index](pmd_rules_xsl.html)
[Code Style](pmd_rules_xsl_codestyle.html)
[Performance](pmd_rules_xsl_performance.html)
- [Language-Specific Documentation](#)

[Overview](pmd_languages_index.html)
[Language configuration](pmd_languages_configuration.html)
[Apex](pmd_languages_apex.html)
[C/C++](pmd_languages_cpp.html)
[C#](pmd_languages_cs.html)
[CSS](pmd_languages_css.html)
[Coco](pmd_languages_coco.html)
[Dart](pmd_languages_dart.html)
[Fortran](pmd_languages_fortran.html)
[Gherkin](pmd_languages_gherkin.html)
[Go](pmd_languages_go.html)
[HTML](pmd_languages_html.html)
[Java](pmd_languages_java.html)
[JavaScript / TypeScript](pmd_languages_js_ts.html)
[JSP](pmd_languages_jsp.html)
[Julia](pmd_languages_julia.html)
[Kotlin](pmd_languages_kotlin.html)
[Lua](pmd_languages_lua.html)
[Matlab](pmd_languages_matlab.html)
[Modelica](pmd_languages_modelica.html)
[Objective-C](pmd_languages_objectivec.html)
[Perl](pmd_languages_perl.html)
[PHP](pmd_languages_php.html)
[PLSQL](pmd_languages_plsql.html)
[Python](pmd_languages_python.html)
[Ruby](pmd_languages_ruby.html)
[Rust](pmd_languages_rust.html)
[Scala](pmd_languages_scala.html)
[Swift](pmd_languages_swift.html)
[T-SQL](pmd_languages_tsql.html)
[Visualforce](pmd_languages_visualforce.html)
[Velocity Template Language (VTL)](pmd_languages_velocity.html)
[XML and XML dialects](pmd_languages_xml.html)
- [Developer Documentation](#)

[Contributing](#)

[Contributing](pmd_devdocs_contributing.html)
[Developer resources](pmd_devdocs_development.html)
[Newcomers' Guide](pmd_devdocs_contributing_newcomers_guide.html)
[Writing documentation](pmd_devdocs_writing_documentation.html)

[Building PMD](#)

[General Info](pmd_devdocs_building_general.html)
[Building PMD from source](pmd_devdocs_building.html)
[Building PMD with IntelliJ IDEA](pmd_devdocs_building_intellij.html)
[Building PMD with Eclipse IDE](pmd_devdocs_building_eclipse.html)
[Building PMD with VS Code IDE](pmd_devdocs_building_vscode.html)
[Building PMD with Netbeans IDE](pmd_devdocs_building_netbeans.html)

[Roadmap](pmd_devdocs_roadmap.html)
[GitHub Actions Workflows](pmd_devdocs_github_actions_workflows.html)
[How PMD works](pmd_devdocs_how_pmd_works.html)
[Logging](pmd_devdocs_logging.html)
[Pmdtester](pmd_devdocs_pmdtester.html)
[Rule Deprecation Policy](pmd_devdocs_rule_deprecation_policy.html)

[Major contributions](#)

[Rule Guidelines](pmd_devdocs_major_rule_guidelines.html)
[Adding a new dialect](pmd_devdocs_major_adding_dialect.html)
[Adding a new language (JavaCC)](pmd_devdocs_major_adding_new_language_javacc.html)
[Adding a new language (ANTLR)](pmd_devdocs_major_adding_new_language_antlr.html)
[Adding a new CPD language](pmd_devdocs_major_adding_new_cpd_language.html)

[Experimental features](#)

[List of experimental Features](tag_experimental.html)
- [Project documentation](#)

[Trivia about PMD](#)

[PMD in the press](pmd_projectdocs_trivia_news.html)
[Products & books related to PMD](pmd_projectdocs_trivia_products.html)
[Similar projects](pmd_projectdocs_trivia_similarprojects.html)
[What does 'PMD' mean?](pmd_projectdocs_trivia_meaning.html)

[Logo](pmd_projectdocs_logo.html)
[FAQ](pmd_projectdocs_faq.html)
[License](license.html)
[Credits](pmd_projectdocs_credits.html)
[Old release notes](pmd_release_notes_old.html)
[Decisions](pmd_projectdocs_decisions.html)

[Project management](#)

[Infrastructure](pmd_projectdocs_committers_infrastructure.html)
[Release process](pmd_projectdocs_committers_releasing.html)
[Merging pull requests](pmd_projectdocs_committers_merging_pull_requests.html)
[Main Landing page](pmd_projectdocs_committers_main_landing_page.html)

# Finding duplicated code with CPD

Learn how to use CPD, the copy-paste detector shipped with PMD.

Table of Contents

## Overview

Duplicate code can be hard to find, especially in a large project.
But PMD’s **Copy/Paste Detector (CPD)** can find it for you!

CPD works with Java, JSP, C/C++, C#, Go, Kotlin, Ruby, Swift and [many more languages](#supported-languages).
It can be used via [command-line](#cli-usage), or via an [Ant task](#ant-task).
It can also be run with Maven by using the `cpd-check` goal on the [Maven PMD Plugin](pmd_userdocs_tools_maven.html).

Your own language is missing?
See how to add it [here](pmd_devdocs_major_adding_new_cpd_language.html).

### Why should you care about duplicates?

It’s certainly important to know where to get CPD, and how to call it, but it’s worth stepping back for a moment and
asking yourself why you should care about this, being the occurrence of duplicate code blocks.

Assuming duplicated blocks of code are supposed to do the same thing, any refactoring, even simple, must be duplicated
too – which is unrewarding grunt work, and puts pressure on the developer to find every place in which to perform
the refactoring. Automated tools like CPD can help with that to some extent.

However, failure to keep the code in sync may mean automated tools will no longer recognise these blocks as duplicates.
This means the task of finding duplicates to keep them in sync when doing subsequent refactorings can no longer be
entrusted to an automated tool – adding more burden on the maintainer. Segments of code initially supposed to do the
same thing may grow apart undetected upon further refactoring.

Now, if the code may never change in the future, then this is not a problem.

Otherwise, the most viable solution is to not duplicate. If the duplicates are already there, then they should be
refactored out. We thus advise developers to use CPD to **help remove duplicates**, not to help keep duplicates in sync.

### Refactoring duplicates

Once you have located some duplicates, several refactoring strategies may apply depending on the scope and extent of
the duplication. Here’s a quick summary:

- If the duplication is local to a method or single class:

Extract a local variable if the duplicated logic is not prohibitively long
Extract the duplicated logic into a private method
- If the duplication occurs in siblings within a class hierarchy:

Extract a method and pull it up in the class hierarchy, along with common fields
Use the [Template Method](https://sourcemaking.com/design_patterns/template_method) design pattern
- If the duplication occurs consistently in unrelated hierarchies:

Introduce a common ancestor to those class hierarchies

Novice as much as advanced readers may want to [read on on Refactoring Guru](https://refactoring.guru/smells/duplicate-code)
for more in-depth strategies, use cases and explanations.

### Finding more duplicates

For some languages, additional options are supported. E.g. Java supports `--ignore-identifiers`. This has the
effect, that all identifiers are replaced with the same placeholder value before the comparing. This helps to
identify structurally identical code that only differs in naming (different class names, different method names,
different parameter names).

There are other similar options: `--ignore-annotations`, `--ignore-literals`, `--ignore-literal-sequences`,
`--ignore-sequences`, `--ignore-usings`.

Note that these options are *disabled* by default (e.g. identifiers are *not* replaced with the same placeholder
value). By default, CPD finds identical duplicates. Using these options, the found duplicates are not anymore
exactly identical.

## CLI Usage

### CLI options reference

Since 7.14.0

The file collection options are common to PMD and CPD and

described over there

.

| Option | Description | Default | Applies to |
| --- | --- | --- | --- |
| --minimum-tokens <count> | Required The minimum token length which should be reported as a duplicate. |  |  |
| --language <lang> -l <lang> | The source code language. See also Supported Languages .<br>Using --help will display a full list of supported languages. | java |  |
| --debug --verbose -D -v | Debug mode. Prints more log output. See also Logging . |  |  |
| --skip-duplicate-files | Ignore multiple copies of files of the same name and length in comparison. |  |  |
| --skip-lexical-errors | Deprecated (Since 7.3.0) Skip files which can't be tokenized due to invalid characters instead of aborting CPD.<br>By default, CPD analysis is stopped on the first error. This is deprecated. Use --fail-on-error instead. |  |  |
| --format <format> -f <format> | Output format of the analysis report. The available formats<br>are described here . | text |  |
| --report-file <path> -r <path> | Since 7.14.0 Path to a file to which report output is written. The file is created if it does not exist. If this option is not specified, the report is rendered to standard output. |  |  |
| --[no-]fail-on-error | Specifies whether CPD exits with non-zero status if recoverable errors occurred.<br>By default CPD exits with status 5 if recoverable errors occurred (whether there are duplications or not).<br>Disable this option with --no-fail-on-error to exit with 0 instead. In any case, a report with the found duplications will be written. |  |  |
| --[no-]fail-on-violation | Specifies whether CPD exits with non-zero status if violations are found.<br>By default CPD exits with status 4 if violations are found.<br>Disable this feature with --no-fail-on-violation to exit with 0 instead and just output the report. |  |  |
| --ignore-literals | Ignore literal values such as numbers and strings when comparing text.<br>By default, literals are not ignored. |  | Java, C++ |
| --ignore-literal-sequences | Ignore sequences of literals such as list initializers.<br>By default, such sequences of literals are not ignored. |  | C#, C++, Lua |
| --ignore-identifiers | Ignore names of classes, methods, variables, constants, etc. when comparing text.<br>By default, identifier names are not ignored. |  | Java, C++ |
| --ignore-annotations | Ignore language annotations (Java) or attributes (C#) when comparing text.<br>By default, annotations are not ignored. |  | C#, Java |
| --ignore-sequences | Ignore sequences of identifier and literals.<br>By default, such sequences are not ignored. |  | C++ |
| --ignore-usings | Ignore using directives in C# when comparing text.<br>By default, using directives are not ignored. |  | C# |
| --no-skip-blocks | Do not skip code blocks matched by --skip-blocks-pattern |  | C++ |
| --skip-blocks-pattern | Pattern to find the blocks to skip. It is a string property and contains of two parts,<br>separated by \| . The first part is the start pattern, the second part is the ending pattern. | #if 0\|#endif | C++ |
| --help -h | Print help text |  |  |

### Examples

Minimum required options: Just give it the minimum duplicate size and the source directory:

- [Linux / macOS](#linux-basic)
- [Windows](#windows-basic)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java
```

You can also specify the language:

- [Linux / macOS](#linux-lang)
- [Windows](#windows-lang)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/cpp --language cpp
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\cpp --language cpp
```

You may wish to check sources that are stored in different directories:

- [Linux / macOS](#linux-multiple)
- [Windows](#windows-multiple)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java --dir src/test/java
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java --dir src\test\java
```

*There is no limit to the number of `--dir`, you may add.*

You may wish to ignore identifiers so that more duplications are found, that only differ in naming:

- [Linux / macOS](#linux-ignore_identifiers)
- [Windows](#windows-ignore_identifiers)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java --ignore-identifiers
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java --ignore-identifiers
```

And if you’re checking a C source tree with duplicate files in different architecture directories
you can skip those using `--skip-duplicate-files`:

- [Linux / macOS](#linux-duplicates)
- [Windows](#windows-duplicates)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/cpp --language cpp --skip-duplicate-files
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\cpp --language cpp --skip-duplicate-files
```

You can also specify the encoding to use when parsing files:

- [Linux / macOS](#linux-encoding)
- [Windows](#windows-encoding)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java --encoding utf-16le
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java --encoding utf-16le
```

You can also specify a report format - here we’re using the XML report:

- [Linux / macOS](#linux-report)
- [Windows](#windows-report)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java --format xml
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java --format xml
```

The default format is a text report, but there are [other supported formats](#available-report-formats)

Note that CPD’s memory usage increases linearly with the size of the analyzed source code; you may need to give Java more memory to run it, like this:

- [Linux / macOS](#linux-memchange)
- [Windows](#windows-memchange)

```
~ $ export PMD_JAVA_OPTS=-Xmx512m
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java
```

```
C:\> set PMD_JAVA_OPTS=-Xmx512m
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java
```

If you specify a source directory but don’t want to scan the sub-directories, you can use the non-recursive option:

- [Linux / macOS](#linux-nonrecursive)
- [Windows](#windows-nonrecursive)

```
~ $ pmd cpd --minimum-tokens 100 --dir src/main/java --non-recursive
```

```
C:\> pmd.bat cpd --minimum-tokens 100 --dir src\main\java --non-recursive
```

### Exit status

Please note that if CPD detects duplicated source code, it will exit with status 4 (since 5.0) or 5 (since 7.3.0).
This behavior has been introduced to ease CPD integration into scripts or hooks, such as SVN hooks.

| Column 1 | Column 2 |
| --- | --- |
| 0 | Everything is fine, no code duplications found and no recoverable errors occurred. |
| 1 | CPD exited with an exception. |
| 2 | Usage error. Command-line parameters are invalid or missing. |
| 4 | At least one code duplication has been detected unless --no-fail-on-violation is set. Since PMD 5.0. |
| 5 | At least one recoverable error has occurred. There might be additionally zero or more duplications detected.<br>To ignore recoverable errors, use --no-fail-on-error . Since PMD 7.3.0. |

**Note:**
If PMD exits with 5, then PMD had trouble lexing one or more files.
That means, that no duplications for the entire file are reported. This can be considered as false-negative.
In any case, the root cause should be investigated. If it’s a problem in PMD itself, please create a bug report.

## Logging

PMD internally uses [slf4j](https://www.slf4j.org/) and ships with slf4j-simple as the logging implementation.
Logging messages are printed to System.err.

The configuration for slf4j-simple is in the file `conf/simplelogger.properties`. There you can enable
logging of specific classes if needed. The `--debug` command line option configures the default log level
to be “debug”.

## Supported Languages

See [CPD Capable Languages](tag_CpdCapableLanguage.html) for the full list of supported languages.

## Available report formats

- text : Default format
- xml (and xslt)
- csv
- csv_with_linecount_per_file
- vs
- markdown

For details, see [CPD Report Formats](pmd_userdocs_cpd_report_formats.html).

## Ant task

Andy Glover wrote an Ant task for CPD; here’s how to use it:

```
<path id="pmd.classpath">
    <fileset dir="/home/joe/pmd-bin-7.23.0/lib">
        <include name="*.jar"/>
    </fileset>
</path>
<taskdef name="cpd" classname="net.sourceforge.pmd.ant.CPDTask" classpathref="pmd.classpath" />

<target name="cpd">
    <cpd minimumTokenCount="100" outputFile="/home/tom/cpd.txt">
        <fileset dir="/home/tom/tmp/ant">
            <include name="**/*.java"/>
        </fileset>
    </cpd>
</target>
```

### Attribute reference

| Attribute | Description | Default | Applies to |
| --- | --- | --- | --- |
| minimumtokencount | Required A positive integer indicating the minimum duplicate size. |  |  |
| encoding | The character set encoding (e.g., UTF-8) to use when reading the source code files, but also when<br>producing the report. A piece of warning, even if you set properly the encoding value,<br>let's say to UTF-8, but you are running CPD encoded with CP1252, you may end up with not UTF-8 file.<br>Indeed, CPD copy piece of source code in its report directly, therefore, the source files<br>keep their encoding. If not specified, CPD uses the system default encoding. |  |  |
| failOnError | Whether to fail the build if any errors occurred while processing the files. Since PMD 7.3.0. | true |  |
| format | The format of the report (e.g. csv , text , xml ). | text |  |
| ignoreLiterals | if true , CPD ignores literal value differences when evaluating a duplicate<br>block. This means that foo=42; and foo=43; will be seen as equivalent. You may want<br>to run PMD with this option off to start with and then switch it on to see what it turns up. | false | Java |
| ignoreIdentifiers | Similar to ignoreLiterals but for identifiers; i.e., variable names, methods names, and so forth. | false | Java |
| ignoreAnnotations | Ignore annotations. More and more modern frameworks use annotations on classes and methods,<br>which can be very redundant and trigger CPD matches. With J2EE (CDI, Transaction Handling, etc)<br>and Spring (everything) annotations become very redundant. Often classes or methods have the<br>same 5-6 lines of annotations. This causes false positives. | false | Java |
| ignoreUsings | Ignore using directives in C#. | false | C# |
| skipDuplicateFiles | Ignore multiple copies of files of the same name and length in comparison. | false |  |
| skipLexicalErrors | Deprecated Skip files which can't be tokenized<br>due to invalid characters instead of aborting CPD. This parameter is deprecated and<br>ignored since PMD 7.3.0. It is now by default true. Use failOnError instead to fail the build. | true |  |
| skipBlocks | Enables or disabled skipping of blocks like a pre-processor. See also option skipBlocksPattern. | true | C++ |
| skipBlocksPattern | Configures the pattern, to find the blocks to skip. It is a string property and contains of two parts,<br>separated by \| . The first part is the start pattern, the second part is the ending pattern. | #if 0\|#endif | C++ |
| language | Flag to select the appropriate language (e.g. c , cpp , cs , java , jsp , php , ruby , fortran ecmascript , and plsql ). | java |  |
| outputfile | The destination file for the report. If not specified the console will be used instead. |  |  |

Also, you can get verbose output from this task by running ant with the `-v` flag; i.e.:

```
ant -v -f mybuildfile.xml cpd
```

Also, you can get an HTML report from CPD by using the XSLT script in pmd/etc/xslt/cpdhtml.xslt. Just run
the CPD task as usual and right after it invoke the Ant XSLT script like this:

```
<xslt in="cpd.xml" style="etc/xslt/cpdhtml.xslt" out="cpd.html" />
```

See [section “xslt” in CPD Report Formats](pmd_userdocs_cpd_report_formats.html#xslt) for more examples.

## GUI

CPD also comes with a simple GUI. You can start it through the unified CLI interface provided in the `bin` folder:

- [Linux / macOS](#linux-gui)
- [Windows](#windows-gui)

```
~ $ pmd cpd-gui
```

```
C:\> pmd.bat cpd-gui
```

Here’s a screenshot of CPD after running on the JDK 8 java.lang package:

## Suppression

Arbitrary blocks of code can be ignored through comments on **Java**, **C/C++**, **Dart**, **Go**, **Groovy**, **Javascript**,
**Kotlin**, **Lua**, **Matlab**, **Objective-C**, **PL/SQL**, **Python**, **Scala**, **Swift**, **C#** and **Apex** by including the keywords `CPD-OFF` and `CPD-ON`.

```
public Object someParameterizedFactoryMethod(int x) throws Exception {
    // some unignored code

    // tell cpd to start ignoring code - CPD-OFF

    // mission critical code, manually loop unroll
    goDoSomethingAwesome(x + x / 2);
    goDoSomethingAwesome(x + x / 2);
    goDoSomethingAwesome(x + x / 2);
    goDoSomethingAwesome(x + x / 2);
    goDoSomethingAwesome(x + x / 2);
    goDoSomethingAwesome(x + x / 2);

    // resume CPD analysis - CPD-ON

    // further code will *not* be ignored
}
```

Additionally, **Java** allows to toggle suppression by adding the annotations
**`@SuppressWarnings("CPD-START")`** and **`@SuppressWarnings("CPD-END")`**
all code within will be ignored by CPD.

This approach however, is limited to the locations were `@SuppressWarnings` is accepted.
It is legacy and the new comment based approach should be favored.

```
//enable suppression
@SuppressWarnings("CPD-START")
public Object someParameterizedFactoryMethod(int x) throws Exception {
    // any code here will be ignored for the duplication detection
}
//disable suppression
@SuppressWarnings("CPD-END")
public void nextMethod() {
}
```

Other languages currently have no support to suppress CPD reports. In the future,
the comment based approach will be extended to those of them that can support it.

## Credits

CPD has been through three major incarnations:

- First we wrote it using a variant of Michael Wise’s Greedy String Tiling algorithm (our variant is described
[here](http://www.onjava.com/pub/a/onjava/2003/03/12/pmd_cpd.html)).
- Then it was completely rewritten by Brian Ewins using the
[Burrows-Wheeler transform](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform).
- Finally, it was rewritten by Steve Hawkins to use the
[Karp-Rabin](http://www.nist.gov/dads/HTML/karpRabin.html) string matching algorithm.

Tags:

userdocs
