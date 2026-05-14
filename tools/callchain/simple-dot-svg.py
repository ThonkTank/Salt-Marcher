#!/usr/bin/env python3
import html
import re
import sys
from collections import defaultdict, deque
from pathlib import Path


NODE_RE = re.compile(
    r'^\s*"(?P<id>(?:\\"|[^"])*)"\s+\[label="(?P<label>(?:\\"|[^"])*)",\s+fillcolor="(?P<fill>#[0-9a-fA-F]+)"\];'
)
EDGE_RE = re.compile(r'^\s*"(?P<from>(?:\\"|[^"])*)"\s+->\s+"(?P<to>(?:\\"|[^"])*)";')


def unquote(value: str) -> str:
    return value.replace(r"\\", "\\").replace(r"\"", '"').replace(r"\n", "\n")


def parse_dot(path: Path):
    nodes = {}
    edges = []
    for line in path.read_text(encoding="utf-8").splitlines():
        node_match = NODE_RE.match(line)
        if node_match:
            node_id = unquote(node_match.group("id"))
            nodes[node_id] = {
                "label": unquote(node_match.group("label")),
                "fill": node_match.group("fill"),
            }
            continue
        edge_match = EDGE_RE.match(line)
        if edge_match:
            edges.append((unquote(edge_match.group("from")), unquote(edge_match.group("to"))))
    for from_id, to_id in edges:
        nodes.setdefault(from_id, {"label": from_id, "fill": "#f8fafc"})
        nodes.setdefault(to_id, {"label": to_id, "fill": "#f8fafc"})
    return nodes, edges


def rank_nodes(nodes, edges):
    outgoing = defaultdict(list)
    incoming_count = defaultdict(int)
    for from_id, to_id in edges:
        outgoing[from_id].append(to_id)
        incoming_count[to_id] += 1
        incoming_count.setdefault(from_id, incoming_count[from_id])

    roots = [node_id for node_id, data in nodes.items() if data["fill"].lower() == "#fde68a"]
    if not roots:
        roots = sorted([node_id for node_id in nodes if incoming_count[node_id] == 0])[:1]
    if not roots and nodes:
        roots = [sorted(nodes)[0]]

    ranks = {}
    queue = deque((root, 0) for root in roots)
    while queue:
        node_id, rank = queue.popleft()
        if node_id in ranks and ranks[node_id] <= rank:
            continue
        ranks[node_id] = rank
        for child in sorted(outgoing[node_id]):
            queue.append((child, rank + 1))

    fallback_rank = (max(ranks.values()) + 1) if ranks else 0
    for node_id in nodes:
        ranks.setdefault(node_id, fallback_rank)
    return ranks


def render_svg(nodes, edges):
    ranks = rank_nodes(nodes, edges)
    by_rank = defaultdict(list)
    for node_id, rank in ranks.items():
        by_rank[rank].append(node_id)
    for rank in by_rank:
        by_rank[rank].sort()

    node_width = 360
    node_height = 74
    x_gap = 80
    y_gap = 28
    margin = 32
    positions = {}
    for rank in sorted(by_rank):
        for index, node_id in enumerate(by_rank[rank]):
            positions[node_id] = (
                margin + rank * (node_width + x_gap),
                margin + index * (node_height + y_gap),
            )

    max_rank = max(by_rank.keys(), default=0)
    max_rows = max((len(items) for items in by_rank.values()), default=1)
    width = margin * 2 + (max_rank + 1) * node_width + max_rank * x_gap
    height = margin * 2 + max_rows * node_height + max(0, max_rows - 1) * y_gap

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
    ]

    for from_id, to_id in edges:
        if from_id not in positions or to_id not in positions:
            continue
        from_x, from_y = positions[from_id]
        to_x, to_y = positions[to_id]
        x1 = from_x + node_width
        y1 = from_y + node_height / 2
        x2 = to_x
        y2 = to_y + node_height / 2
        mid = (x1 + x2) / 2
        svg.append(
            f'<path d="M {x1:.1f} {y1:.1f} C {mid:.1f} {y1:.1f}, {mid:.1f} {y2:.1f}, {x2:.1f} {y2:.1f}" '
            'fill="none" stroke="#475569" stroke-width="1.4" marker-end="url(#arrow)"/>'
        )

    for node_id, (x, y) in positions.items():
        data = nodes[node_id]
        fill = data["fill"]
        stroke = "#d97706" if fill.lower() == "#fde68a" else "#cbd5e1"
        svg.append(
            f'<rect x="{x}" y="{y}" width="{node_width}" height="{node_height}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
        )
        lines = data["label"].split("\n")
        for line_index, line in enumerate(lines[:3]):
            text = html.escape(line if len(line) <= 64 else line[:61] + "...")
            font_size = 11 if line_index == 0 else 9
            y_text = y + 20 + line_index * 18
            svg.append(
                f'<text x="{x + 12}" y="{y_text}" font-family="Inter,Arial,sans-serif" font-size="{font_size}" fill="#0f172a">{text}</text>'
            )

    svg.append("</svg>")
    return "\n".join(svg) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: simple-dot-svg.py <input.dot> <output.svg>", file=sys.stderr)
        return 2
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    nodes, edges = parse_dot(input_path)
    output_path.write_text(render_svg(nodes, edges), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
