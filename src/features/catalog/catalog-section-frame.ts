export interface CatalogSectionFrame {
  readonly root: HTMLElement;
  readonly headerActions: HTMLElement;
  readonly controls: HTMLElement;
  readonly results: HTMLElement;
  readonly footer: HTMLElement;
  readonly detail: HTMLElement;
}

/** The sole structural shell used by both available and unavailable catalog sections. */
export function createCatalogSectionFrame(
  doc: Document,
  titleText: string,
  resultsLabel: string,
  detailLabel: string,
): CatalogSectionFrame {
  const root = doc.createElement("div");
  root.className = "dn-catalog-section-content";
  const header = doc.createElement("header");
  header.className = "dn-catalog-header";
  const title = doc.createElement("h1");
  title.textContent = titleText;
  const headerActions = doc.createElement("div");
  headerActions.className = "dn-catalog-header-actions";
  header.append(title, headerActions);
  const controls = doc.createElement("div");
  controls.className = "dn-catalog-controls";
  const body = doc.createElement("div");
  body.className = "dn-catalog-body";
  const results = doc.createElement("section");
  results.className = "dn-catalog-results";
  results.setAttribute("aria-label", resultsLabel);
  const footer = doc.createElement("footer");
  footer.className = "dn-catalog-footer";
  results.append(footer);
  const detail = doc.createElement("article");
  detail.className = "dn-catalog-detail";
  detail.setAttribute("aria-label", detailLabel);
  body.append(results, detail);
  root.append(header, controls, body);
  return { root, headerActions, controls, results, footer, detail };
}
