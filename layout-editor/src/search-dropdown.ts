// plugins/layout-editor/src/search-dropdown.ts
export function enhanceSelectToSearch(select: HTMLSelectElement, placeholder = "Suchen…"): void {
    if (!select || (select as any)._leEnhanced) return;
    const wrap = document.createElement("div");
    wrap.className = "sm-sd";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.className = "sm-sd__input";
    const menu = document.createElement("div");
    menu.className = "sm-sd__menu";

    const parent = select.parentElement;
    if (!parent) return;
    parent.insertBefore(wrap, select);
    wrap.appendChild(input);
    wrap.appendChild(menu);
    select.style.display = "none";

    try {
        const rect = select.getBoundingClientRect();
        if (rect && rect.width) wrap.style.width = `${rect.width}px`;
    } catch (error) {
        console.warn("enhanceSelectToSearch: unable to read select width", error);
    }

    let items: Array<{ label: string; value: string; el?: HTMLDivElement }> = [];
    let active = -1;

    const readOptions = () => {
        items = Array.from(select.options).map(opt => ({ label: opt.text, value: opt.value }));
    };

    const openMenu = () => {
        wrap.classList.add("is-open");
    };

    const closeMenu = () => {
        wrap.classList.remove("is-open");
        active = -1;
    };

    const render = (query = "") => {
        readOptions();
        if (query === "__NOOPEN__") {
            menu.innerHTML = "";
            closeMenu();
            return;
        }
        const normalized = query.toLowerCase();
        const matches = items
            .filter(it => !normalized || it.label.toLowerCase().includes(normalized))
            .slice(0, 50);
        menu.innerHTML = "";
        matches.forEach((item, idx) => {
            const el = document.createElement("div");
            el.className = "sm-sd__item";
            el.textContent = item.label;
            item.el = el;
            el.onclick = () => {
                select.value = item.value;
                select.dispatchEvent(new Event("change"));
                input.value = item.label;
                closeMenu();
            };
            menu.appendChild(el);
        });
        if (matches.length) {
            openMenu();
        } else {
            closeMenu();
        }
    };

    const highlight = (options: HTMLDivElement[]) => {
        options.forEach((el, idx) => el.classList.toggle("is-active", idx === active));
        const el = options[active];
        if (el) el.scrollIntoView({ block: "nearest" });
    };

    input.addEventListener("focus", () => {
        input.select();
        render("");
    });
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", ev => {
        if (!wrap.classList.contains("is-open")) return;
        const options = Array.from(menu.children) as HTMLDivElement[];
        if (ev.key === "ArrowDown") {
            active = Math.min(options.length - 1, active + 1);
            highlight(options);
            ev.preventDefault();
        } else if (ev.key === "ArrowUp") {
            active = Math.max(0, active - 1);
            highlight(options);
            ev.preventDefault();
        } else if (ev.key === "Enter") {
            if (options[active]) {
                options[active].click();
                ev.preventDefault();
            }
        } else if (ev.key === "Escape") {
            closeMenu();
        }
    });
    input.addEventListener("blur", () => {
        window.setTimeout(closeMenu, 120);
    });

    (select as any)._leEnhanced = true;
    (select as any)._leSearchInput = input;
}
