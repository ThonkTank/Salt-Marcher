import { Lexer, type Token, type Tokens } from 'marked';
import { decodeHTMLStrict } from 'entities';
import { plainReferenceText, textReferences } from './text-references';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
const text = (value: string) => document.createTextNode(value);

/** A passive reading projection. The lexer never supplies HTML to the document. */
export function markdownView(source: string, headingBase = 3): HTMLElement {
  const root = element('div');
  let tokens: Token[];
  try {
    tokens = Lexer.lex(source, { gfm: true, breaks: true });
  } catch {
    root.className = 'markdown-plain';
    root.textContent = plainReferenceText(source);
    return root;
  }
  const plain =
    tokens.every(
      (t) =>
        t.type === 'space' ||
        (t.type === 'paragraph' &&
          (t as Tokens.Paragraph).tokens.every(
            (i) => (i.type === 'text' && !i.tokens) || (i.type === 'br' && !i.raw.startsWith('\\')),
          )),
    ) && !/&(?:#[\dxXa-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/.test(source);
  root.className = plain ? 'markdown-plain' : 'markdown-view';
  if (plain) {
    root.textContent = plainReferenceText(source);
    return root;
  }

  const render = (parent: Node, values: readonly Token[], depth = 0): void => {
    for (const value of values) {
      if (depth > 40) {
        parent.appendChild(text(value.raw));
        continue;
      }
      const append = (
        tag: keyof HTMLElementTagNameMap,
        children: readonly Token[],
        block = false,
      ) => {
        const child = element(tag);
        render(child, children, depth + 1);
        parent.appendChild(child);
        if (block) parent.appendChild(text('\n'));
        return child;
      };
      switch (value.type) {
        case 'space':
          parent.appendChild(text('\n'));
          break;
        case 'def':
          break;
        case 'paragraph':
          append('p', (value as Tokens.Paragraph).tokens, true);
          break;
        case 'heading': {
          const h = value as Tokens.Heading,
            level = headingBase + h.depth;
          const child = append(('h' + Math.min(6, Math.max(1, level))) as 'h1', h.tokens, true);
          child.dataset.markdownHeading = String(h.depth);
          if (level > 6) child.setAttribute('aria-level', String(level));
          break;
        }
        case 'text': {
          const t = value as Tokens.Text;
          if (t.tokens) render(parent, t.tokens, depth + 1);
          else parent.appendChild(text(decodeHTMLStrict(t.text)));
          break;
        }
        case 'escape':
          parent.appendChild(text((value as Tokens.Escape).text));
          break;
        case 'strong':
          append('strong', (value as Tokens.Strong).tokens);
          break;
        case 'em':
          append('em', (value as Tokens.Em).tokens);
          break;
        case 'del':
          append('del', (value as Tokens.Del).tokens);
          break;
        case 'br':
          parent.appendChild(element('br'));
          parent.appendChild(text('\n'));
          break;
        case 'hr':
          parent.appendChild(element('hr'));
          break;
        case 'blockquote':
          append('blockquote', (value as Tokens.Blockquote).tokens, true);
          break;
        case 'codespan': {
          const code = element('code');
          code.textContent = (value as Tokens.Codespan).text;
          parent.appendChild(code);
          break;
        }
        case 'code': {
          const pre = element('pre'),
            code = element('code');
          code.textContent = (value as Tokens.Code).text;
          pre.append(code);
          parent.appendChild(pre);
          parent.appendChild(text('\n'));
          break;
        }
        case 'html': {
          const literal = element('span');
          literal.className = 'markdown-literal';
          literal.textContent = value.raw;
          parent.appendChild(literal);
          break;
        }
        case 'checkbox': {
          const box = element('input');
          box.type = 'checkbox';
          box.disabled = true;
          box.checked = (value as Tokens.Checkbox).checked;
          box.dataset.unavailable = 'true';
          box.setAttribute('aria-label', box.checked ? 'Erledigt' : 'Offen');
          parent.appendChild(box);
          parent.appendChild(text(' '));
          break;
        }
        case 'list': {
          const list = value as Tokens.List,
            container = element(list.ordered ? 'ol' : 'ul');
          if (list.ordered && list.start !== '') (container as HTMLOListElement).start = list.start;
          for (const item of list.items) {
            const li = element('li');
            if (item.task) {
              li.className = 'markdown-task';
              const hasBox = item.tokens.some(
                (t) =>
                  t.type === 'checkbox' ||
                  ('tokens' in t && t.tokens?.some((i: Token) => i.type === 'checkbox')),
              );
              if (!hasBox)
                render(li, [{ type: 'checkbox', raw: '', checked: !!item.checked }], depth + 1);
            }
            render(li, item.tokens, depth + 1);
            container.append(li);
          }
          parent.appendChild(container);
          parent.appendChild(text('\n'));
          break;
        }
        case 'table': {
          const table = value as Tokens.Table,
            wrapper = element('div'),
            grid = element('table');
          wrapper.className = 'markdown-table';
          wrapper.tabIndex = 0;
          wrapper.setAttribute('role', 'region');
          wrapper.setAttribute('aria-label', 'Tabelle');
          const row = (cells: Tokens.TableCell[], head: boolean) => {
            const tr = element('tr');
            for (const cell of cells) {
              const td = element(head ? 'th' : 'td');
              if (head) (td as HTMLTableCellElement).scope = 'col';
              if (cell.align) td.style.textAlign = cell.align;
              render(td, cell.tokens, depth + 1);
              tr.append(td);
            }
            return tr;
          };
          const head = element('thead'),
            body = element('tbody');
          head.append(row(table.header, true));
          for (const cells of table.rows) body.append(row(cells, false));
          grid.append(head, body);
          wrapper.append(grid);
          parent.appendChild(wrapper);
          parent.appendChild(text('\n'));
          break;
        }
        case 'link': {
          const link = value as Tokens.Link,
            local = textReferences(link.raw, 1)[0];
          render(parent, link.tokens, depth + 1);
          if (!local && link.text !== link.href) parent.appendChild(text(' (' + link.href + ')'));
          break;
        }
        case 'image': {
          const image = value as Tokens.Image;
          parent.appendChild(text(decodeHTMLStrict(image.text) + ' (' + image.href + ')'));
          break;
        }
        default:
          parent.appendChild(text(value.raw));
      }
    }
  };
  render(root, tokens);
  return root;
}
