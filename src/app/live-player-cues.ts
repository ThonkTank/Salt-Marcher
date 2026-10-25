export interface LiveNpcChoice {
  id: string;
  title: string;
}

export function renderLiveNpcChoices(
  select: HTMLSelectElement,
  show: HTMLButtonElement,
  result: HTMLElement,
  choices: LiveNpcChoice[],
  query: string,
) {
  const selected = select.value,
    needle = query.trim().toLocaleLowerCase('de'),
    shown = choices.filter(
      (choice) => !needle || choice.title.toLocaleLowerCase('de').includes(needle),
    );
  const document = select.ownerDocument;
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'NSC auswählen';
  select.append(empty);
  for (const choice of shown) {
    const option = document.createElement('option');
    option.value = choice.id;
    option.textContent = choice.title || 'Unbenannter NSC';
    select.append(option);
  }
  const retained = shown.some((choice) => choice.id === selected);
  (retained
    ? [...select.options].find((option) => option.value === selected)!
    : empty
  ).setAttribute('selected', '');
  show.disabled = !retained;
  result.textContent =
    shown.length === choices.length
      ? choices.length + ' NSCs verfügbar.'
      : shown.length + ' von ' + choices.length + ' NSCs angezeigt.';
}
