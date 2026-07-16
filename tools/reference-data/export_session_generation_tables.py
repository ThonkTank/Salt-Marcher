#!/usr/bin/env python3
"""Export immutable sheet-v1 DB worksheets from an OOXML workbook to TSV."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CELL_REF = re.compile(r"([A-Z]+)([0-9]+)")
DB_PREFIX = "DB_"


def column_index(reference: str) -> int:
    match = CELL_REF.fullmatch(reference)
    if match is None:
        raise ValueError(f"Invalid cell reference: {reference}")
    result = 0
    for character in match.group(1):
        result = result * 26 + ord(character) - ord("A") + 1
    return result - 1


def text_content(node: ElementTree.Element | None) -> str:
    if node is None:
        return ""
    return "".join(node.itertext())


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    return [text_content(item) for item in root.findall(f"{{{MAIN_NS}}}si")]


def worksheet_paths(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall(f"{{{PACKAGE_REL_NS}}}Relationship")
    }
    result: dict[str, str] = {}
    sheets = workbook.find(f"{{{MAIN_NS}}}sheets")
    if sheets is None:
        return result
    for sheet in sheets.findall(f"{{{MAIN_NS}}}sheet"):
        name = sheet.attrib["name"]
        relationship_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = targets[relationship_id].lstrip("/")
        result[name] = target if target.startswith("xl/") else f"xl/{target}"
    return result


def cell_value(cell: ElementTree.Element, strings: list[str]) -> str:
    kind = cell.attrib.get("t", "")
    if kind == "inlineStr":
        return text_content(cell.find(f"{{{MAIN_NS}}}is"))
    value_node = cell.find(f"{{{MAIN_NS}}}v")
    value = "" if value_node is None or value_node.text is None else value_node.text
    if kind == "s" and value:
        return strings[int(value)]
    if kind == "b":
        return "true" if value == "1" else "false"
    return value


def rows(archive: zipfile.ZipFile, path: str, strings: list[str]) -> list[list[str]]:
    root = ElementTree.fromstring(archive.read(path))
    sheet_data = root.find(f"{{{MAIN_NS}}}sheetData")
    if sheet_data is None:
        return []
    sparse_rows: list[dict[int, str]] = []
    maximum_column = -1
    for row in sheet_data.findall(f"{{{MAIN_NS}}}row"):
        sparse: dict[int, str] = {}
        for cell in row.findall(f"{{{MAIN_NS}}}c"):
            index = column_index(cell.attrib["r"])
            sparse[index] = cell_value(cell, strings)
            maximum_column = max(maximum_column, index)
        sparse_rows.append(sparse)
    table = [[row.get(index, "") for index in range(maximum_column + 1)] for row in sparse_rows]
    while table and not any(value.strip() for value in table[-1]):
        table.pop()
    return table


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def export(workbook: Path, output: Path, source_url: str, all_sheets: bool = False) -> None:
    output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "ruleset": "sheet-v1",
        "sourceUrl": source_url,
        "sourceSha256": sha256(workbook),
        "tables": [],
    }
    with zipfile.ZipFile(workbook) as archive:
        strings = shared_strings(archive)
        paths = worksheet_paths(archive)
        for name, path in paths.items():
            if not all_sheets and not name.startswith(DB_PREFIX):
                continue
            table = rows(archive, path, strings)
            target = output / f"{name}.tsv"
            with target.open("w", encoding="utf-8", newline="") as destination:
                writer = csv.writer(destination, dialect="excel-tab", lineterminator="\n")
                for index, row in enumerate(table):
                    normalized = list(row)
                    if index > 0:
                        while normalized and normalized[-1] == "":
                            normalized.pop()
                    writer.writerow(normalized)
            manifest["tables"].append({
                "name": name,
                "file": target.name,
                "rows": max(0, len(table) - 1),
                "columns": len(table[0]) if table else 0,
                "sha256": sha256(target),
            })
    manifest_path = output / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--all-sheets", action="store_true")
    arguments = parser.parse_args()
    export(arguments.workbook, arguments.output, arguments.source_url, arguments.all_sheets)


if __name__ == "__main__":
    main()
