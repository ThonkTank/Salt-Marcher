// src/ui/search-dropdown.ts

export function enhanceSelectToSearch(select: HTMLSelectElement, placeholder = "Search…"): void {
    if (!select || (select as any)._smEnhanced) return;
    const wrap = document.createElement("div");
    wrap.className = "sm-sd";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.className = "sm-sd__input";
    const menu = document.createElement("div");
    menu.className = "sm-sd__menu";

    const parent = select.parentElement!;
    parent.insertBefore(wrap, select);
    wrap.appendChild(input);
    wrap.appendChild(menu);
    select.style.display = "none";

    // Match original select width at init for layout-appropriate sizing.
    try {
        const rect = select.getBoundingClientRect();
        if (rect && rect.width) wrap.style.width = rect.width + "px";
    } catch {}

    let items: Array<{ label: string; value: string; el?: HTMLDivElement }>;
    let active = -1;
    const readOptions = () => {
        items = Array.from(select.options).map((opt) => ({ label: opt.text, value: opt.value }));
    };
    const openMenu = () => {
        wrap.classList.add("is-open");
    };
    const closeMenu = () => {
        wrap.classList.remove("is-open");
        active = -1;
    };
    const render = (q = "") => {
        readOptions();
        if (q === "__NOOPEN__") {
            menu.innerHTML = "";
            closeMenu();
            return;
        }
        const qq = q.toLowerCase();
        const matches = items.filter((it) => !qq || it.label.toLowerCase().includes(qq)).slice(0, 50);
        menu.innerHTML = "";
        matches.forEach((it, idx) => {
            const el = document.createElement("div");
            el.className = "sm-sd__item";
            el.textContent = it.label;
            it.el = el;
            el.onclick = () => {
                select.value = it.value;
                select.dispatchEvent(new Event("change"));
                input.value = it.label;
                closeMenu();
            };
            menu.appendChild(el);
        });
        if (matches.length) openMenu();
        else closeMenu();
    };
    input.addEventListener("focus", () => {
        input.select();
        render("");
    });
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (ev) => {
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
    const highlight = (options: HTMLDivElement[]) => {
        options.forEach((el, i) => el.classList.toggle("is-active", i === active));
        const el = options[active];
        if (el) el.scrollIntoView({ block: "nearest" });
    };
    input.addEventListener("blur", () => {
        setTimeout(closeMenu, 120);
    });
    // Do not prefill input from current selection to avoid unintended defaults.
    (select as any)._smEnhanced = true;
    (select as any)._smSearchInput = input;
}
