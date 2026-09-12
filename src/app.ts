import type { Incident, Snapshot } from './types';
import { emptyFilters, matches } from './filters';
import { Timeline } from './timeline';
import { civilISO, displayDate } from './dates';
import { readNotebook, writeNotebook, NOTEBOOK_KEY, type Store } from './notebook';
import { decodeState, encodeState } from './url-state';
import { asset, escape as e, icon, count, animalArt } from './ui';
import { patternsHTML } from './patterns';
import type { RescueMap } from './map';

export function mount(root: HTMLElement): () => void {
  const controller = new AbortController(),
    { signal } = controller;
  let disposed = false;
  let map: RescueMap | undefined;
  let snapshot: Snapshot;
  let records: Incident[] = [];
  let filtered: Incident[] = [];
  let selected: Incident | null = null;
  let filters = emptyFilters();
  let saved: string[] = [];
  let storage: Store | undefined;
  let view: 'explore' | 'patterns' | 'notebook' = 'explore';
  let listOpen = false;
  let clusterIds: Set<string> | null = null;
  let page = 0;
  const perPage = 12;
  const timeline = new Timeline();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTick = performance.now();
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T =>
    root.querySelector<T>(selector)!;
  const on = (selector: string, event: string, fn: (event: Event) => void) =>
    $(selector).addEventListener(event, fn, { signal });
  root.classList.add('lar');
  root.innerHTML = `
 <a href="#desk-main" class="skip-link">Skip to explorer</a>
 <header class="masthead"><a href="${asset('')}" class="brand" aria-label="London Animal Rescue home"><img src="${asset('art/helmet.svg')}" alt="" width="64" height="60"><span><strong>LONDON ANIMAL RESCUE</strong><span class="tagline">The dispatch desk</span></span></a><nav aria-label="Main navigation"><button class="active" data-view="explore" aria-current="page">Explore</button><button data-view="patterns">Patterns</button><button data-view="notebook">Notebook <span id="notebook-count">0</span></button></nav><div class="header-note"><span class="status-dot"></span> THE HISTORICAL COLLECTION<span>Independent explorer · not live dispatch</span></div></header>
 <main id="desk-main" class="desk" tabindex="-1">
 <aside class="filters paper" aria-label="Incident filters"><div class="filter-top"><h1>On the lookout</h1><button id="close-filters" class="icon-button mobile-only" aria-label="Close filters">${icon('close')}</button></div><p class="intro">Search, filter and explore animal<br class="desktop-only"> callouts across London.</p>
 <label class="search-box">${icon('search')}<input id="search" type="search" placeholder="Search incident notes…" aria-label="Search descriptions, identifiers and places" maxlength="300"></label>
 <fieldset id="animals"><legend>ANIMAL TYPE</legend><div id="animal-buttons"></div><label class="more-animal">More animals<select id="more-animal" aria-label="Add another animal category"><option value="">Choose a category…</option></select></label><div id="extra-animals"></div></fieldset>
 <fieldset class="date-fields"><legend>DATE RANGE</legend><label>From<input id="from" type="date"></label><label>To<input id="to" type="date"></label></fieldset>
 <label class="field-label" for="borough">BOROUGH</label><select id="borough"><option value="">All boroughs</option></select>
 <label class="check-row overnight"><input id="overnight" type="checkbox"><span>Evening & overnight<small>Recorded hours: 18:00–05:59</small></span></label>
 <div class="filter-count"><strong id="matching">Opening records…</strong><button id="clear" class="text-button">Clear all</button></div>
 <button id="surprise" class="surprise" disabled>${icon('dice')} Surprise me</button>
 <p class="filter-semantics">Animals match any selected category.<br>Other filters all apply together.</p>
 <div class="sidebar-foot">${icon('book')}<div><strong>A city full of stories.</strong><p>Explore the records. Keep the ones<br>that catch your eye.</p></div></div>
 <button id="about" class="text-button source-link">About the data & credits ↗</button>
 <address class="contact-info"><strong>Morten Teinum</strong><a href="mailto:morten@teinum.no">morten@teinum.no</a></address>
 </aside>
 <section class="map-stage" aria-label="Incident explorer"><div id="map" role="region" aria-label="Geographic map of London"></div><div class="map-toolbar"><button id="open-filters" class="paper mobile-only">${icon('filter')} Filters</button><div class="map-caption paper"><span class="status-dot"></span><span id="map-count">LONDON · HISTORICAL CALLOUTS</span></div><button id="list-toggle" class="paper">${icon('list')} Incident list</button></div>
 <button id="reset-map" class="paper map-reset">⌖ <span>Central London</span></button><div class="map-key paper"><img src="${asset('art/paw.svg')}" alt="" width="23" height="23"> Rounded locations <span>·</span> Numbers group callouts</div>
 <div id="map-message" class="map-message paper" hidden></div><div id="map-loading" class="map-loading paper">Unfolding the London map…</div>
 <section id="view-panel" class="view-panel paper" aria-label="Records and analysis" hidden></section>
 <section class="timeline paper" aria-label="Replay recorded callouts"><button id="play" class="play-button" aria-label="Play timeline" disabled>▶</button><div class="replay-title"><strong>REPLAY CALLOUTS</strong><small id="replay-status">Explore the recorded timeline</small></div><div class="scrub-block"><output id="current-date">Loading dates…</output><input id="scrub" type="range" min="0" max="100" value="100" aria-label="Replay date and time" disabled><div class="range-labels"><span id="range-start"></span><span id="range-end"></span></div></div><label class="speed">Speed<select id="speed" aria-label="Playback speed"><option value="0.25">¼×</option><option value="1" selected>1×</option><option value="4">4×</option><option value="12">12×</option></select></label><div class="replay-options"><label><input id="fade" type="checkbox"> Fade older calls</label><label><input id="follow" type="checkbox"> Follow latest</label><button id="all-history" class="text-button">Show all dates</button></div></section>
 <div class="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a><span> · Current map · Local extract</span></div>
 </section>
 <aside id="incident" class="incident-wrap" aria-label="Selected incident"><div class="incident paper"><div class="incident-heading"><span class="stamp">INCIDENT FILE</span><button id="close-incident" class="icon-button" aria-label="Close incident">${icon('close')}</button></div><div id="detail-body"><div class="detail-placeholder"><img src="${asset('art/paw-card.svg')}" alt="Original paw illustration"><h2>Every call has a record.</h2><p>Select an animal marker or open the incident list to explore.</p></div></div></div><p class="record-footer">LFB open data · London Datastore<br>Historical records, not live dispatch.</p></aside>
 </main><div id="announcement" class="sr-only" aria-live="polite" role="status"></div><div id="toast" class="toast" role="status" hidden></div>
 <dialog id="info-dialog" class="paper"><button id="close-dialog" class="icon-button" aria-label="Close data notes">${icon('close')}</button><div id="dialog-body"></div></dialog>`;
  function notify(message: string) {
    $('#announcement').textContent = message;
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('#toast').hidden = true), 5500);
  }
  function saveURL() {
    try {
      history.replaceState(null, '', encodeState(location.href, filters, selected?.id));
    } catch {
      /* embedding host may disallow history */
    }
  }
  function syncFilters() {
    $<HTMLInputElement>('#search').value = filters.query;
    $<HTMLInputElement>('#from').value = filters.from;
    $<HTMLInputElement>('#to').value = filters.to;
    $<HTMLSelectElement>('#borough').value = filters.borough;
    $<HTMLInputElement>('#overnight').checked = filters.overnight;
    const common = ['Cat', 'Dog', 'Bird', 'Fox'].filter((c) =>
      snapshot.metadata.categories.includes(c),
    );
    $('#animal-buttons').innerHTML = [
      ['', 'All animals'],
      ...common.map((c) => [c, c === 'Fox' ? 'Foxes' : `${c}s`]),
    ]
      .map(
        ([c, label]) =>
          `<button class="animal-option ${c ? (filters.animals.includes(c) ? 'chosen' : '') : !filters.animals.length ? 'chosen' : ''}" data-animal="${e(c)}" aria-pressed="${c ? filters.animals.includes(c) : !filters.animals.length}"><img src="${asset(`art/${animalArt(c)}.svg`)}" alt=""><span>${label}</span>${c ? `<small>${count(records.filter((r) => r.category === c).length)}</small>` : ''}</button>`,
      )
      .join('');
    $('#extra-animals').innerHTML = filters.animals
      .filter((c) => !common.includes(c))
      .map(
        (c) =>
          `<button class="animal-chip" data-animal="${e(c)}" aria-label="Remove ${e(c)} filter">${e(c)} ×</button>`,
      )
      .join('');
  }
  function applyFilters() {
    filtered = records.filter((r) => matches(r, filters));
    page = 0;
    clusterIds = null;
    timeline.reset(filtered);
    syncFilters();
    renderCount();
    renderTimeline();
    renderDetail();
    renderView();
    updateMap();
    saveURL();
  }
  function renderCount() {
    const mapped = filtered.filter((r) => r.location).length;
    $('#matching').textContent = `${count(filtered.length)} matching callouts`;
    $('#map-count').textContent = `${count(mapped)} MAPPED CALLOUTS`;
    $<HTMLButtonElement>('#surprise').disabled = !filtered.length;
    $('#announcement').textContent =
      `${filtered.length} matching incidents, ${filtered.length - mapped} without map locations.`;
  }
  function renderTimeline() {
    $<HTMLButtonElement>('#play').disabled = timeline.start === timeline.end;
    $('#play').textContent = timeline.playing ? 'Ⅱ' : '▶';
    $('#play').setAttribute('aria-label', timeline.playing ? 'Pause timeline' : 'Play timeline');
    const scrub = $<HTMLInputElement>('#scrub');
    scrub.min = String(timeline.start);
    scrub.max = String(timeline.end);
    scrub.step = '1000';
    scrub.value = String(timeline.cursor);
    scrub.disabled = !filtered.length;
    $('#current-date').textContent = !filtered.length
      ? 'No matching dates'
      : timeline.active
        ? displayDate(civilISO(timeline.cursor))
        : 'All recorded dates';
    scrub.setAttribute('aria-valuetext', $('#current-date').textContent ?? '');
    $('#range-start').textContent = filtered.length
      ? displayDate(civilISO(timeline.start), false)
      : '';
    $('#range-end').textContent = filtered.length ? displayDate(civilISO(timeline.end), false) : '';
    $('#replay-status').textContent = timeline.playing
      ? '1× = 30 recorded days / second'
      : timeline.active
        ? 'Paused · recorded clock time'
        : 'Press play to travel through time';
  }
  function updateMap() {
    map?.update(timeline.visible(filtered), timeline.cursor, timeline.active && timeline.recent);
    map?.select(selected, false);
  }
  function renderDetail() {
    const r = selected;
    if (!r) {
      $('#detail-body').innerHTML =
        `<div class="detail-placeholder"><img src="${asset('art/paw-card.svg')}" alt="Original paw illustration"><h2>Open a little piece of London.</h2><p>Select a marker, browse the list, or try “Surprise me”.</p></div>`;
      return;
    }
    const conflict = !matches(r, filters);
    const redacted = r.description.toLowerCase() === 'redacted';
    const fields = [
      ['RECORDED', displayDate(r.date)],
      ['ANIMAL', r.animal],
      ['BOROUGH', r.borough],
      ['LOCATION', [r.street, r.postcode].filter(Boolean).join(' · ') || 'Not supplied'],
      ...(r.ward ? [['WARD', r.ward]] : []),
    ];
    $('#detail-body').innerHTML =
      `<figure class="animal-portrait"><img src="${asset(`art/${animalArt(r.category)}-card.svg`)}" alt="Original ${animalArt(r.category) === 'paw' ? 'paw' : animalArt(r.category)} illustration, not the actual animal"><figcaption>ILLUSTRATION</figcaption></figure><div class="file-number">RECORD No. ${e(r.id)}</div><h2>${e(r.animal)} callout</h2><p class="detail-subtitle">${e(r.borough)} · ${displayDate(r.date, false)}</p>${conflict ? '<div class="notice conflict">This selected record is outside your current filters. It is shown separately on the map.<button id="reveal" class="text-button">Clear filters and reveal</button></div>' : ''}${timeline.active && r.clock > timeline.cursor ? '<p class="notice">Selected record is later than the replay cursor and is shown separately.</p>' : ''}<dl class="record-fields">${fields.map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl><section class="record-notes"><span class="eyebrow">ORIGINAL INCIDENT NOTES</span><p>${e(r.description || 'No description supplied.')}</p>${redacted ? '<small>This description was redacted by the source.</small>' : ''}</section><div class="location-note">${icon('pin')}<div><strong>${r.location ? 'Approximate grid area' : 'No map location available'}</strong><p>${r.location ? 'Rounded source coordinates on an observed 100 m grid. This is not an exact address.' : 'Location remains available as recorded text. No position has been invented.'}</p></div></div><details class="resources"><summary>Resources & record context</summary><dl class="record-fields">${[
        ['PUMPS', r.pumps ?? 'Not supplied'],
        ['PUMP-HOURS', r.pumpHours ?? 'Not supplied'],
        ['STATION', r.station || 'Not supplied'],
        ['SERVICE', r.service || 'Not supplied'],
        ['PROPERTY', r.property || 'Not supplied'],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`)
        .join(
          '',
        )}</dl><strong>Notional cost estimate: ${r.cost === null ? 'Not supplied' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(r.cost)}</strong><p>Source estimates use time rounded up to the nearest hour for Pump, Aerial and FRU appliances, at the Brigade hourly rate${r.hourlyCost === null ? '' : ` (£${r.hourlyCost} in this record)`}. These are not invoices or amounts charged to owners. Pump-hours are resource use, not elapsed rescue duration.</p><p>Outcome: not separately recorded. No success is inferred.</p></details><div class="card-actions"><button id="save" class="primary">${icon('book')} ${saved.includes(r.id) ? 'Remove from notebook' : 'Save to notebook'}</button><button id="share">${icon('share')} Share this record</button></div><p class="file-footnote">A real callout. An illustrated companion.</p>`;
    if (conflict)
      on('#reveal', 'click', () => {
        filters = emptyFilters();
        applyFilters();
        notify('Filters cleared to reveal this record.');
      });
    on('#save', 'click', () => {
      saved = saved.includes(r.id) ? saved.filter((id) => id !== r.id) : [...saved, r.id];
      persist();
      renderDetail();
      renderView();
    });
    on('#share', 'click', () => void share());
  }
  function select(id: string, move = true, user = true) {
    const r = records.find((r) => r.id === id);
    if (!r) {
      notify('This incident is unavailable in the current snapshot.');
      return;
    }
    selected = r;
    timeline.pause();
    renderTimeline();
    view = 'explore';
    setNavigation();
    listOpen = false;
    renderView();
    renderDetail();
    map?.select(r, move);
    saveURL();
    if (user) {
      root.classList.add('incident-open');
      $('#announcement').textContent =
        `Selected ${r.animal} callout in ${r.borough}, ${displayDate(r.date)}.`;
      $('#close-incident').focus({ preventScroll: true });
    }
  }
  function persist() {
    if (storage && !writeNotebook(storage, saved))
      notify('Notebook storage is unavailable; changes last for this visit only.');
    $('#notebook-count').textContent = String(saved.length);
  }
  function renderView() {
    const panel = $('#view-panel');
    panel.hidden = view === 'explore' && !listOpen;
    if (panel.hidden) return;
    if (view === 'patterns') {
      panel.innerHTML = patternsHTML(filtered, filters, snapshot.metadata);
      return;
    }
    let list: { id: string; record: Incident | undefined }[];
    if (view === 'notebook')
      list = saved.map((id) => ({ id, record: records.find((r) => r.id === id) }));
    else
      list = timeline
        .visible(filtered)
        .filter((r) => !clusterIds || clusterIds.has(r.id))
        .map((record) => ({ id: record.id, record }));
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    page = Math.min(page, pages - 1);
    panel.innerHTML = `<div class="view-heading"><span class="eyebrow">${view === 'notebook' ? 'KEPT FOR LATER' : 'THE CALLOUT REGISTER'}</span><h2>${view === 'notebook' ? 'Your notebook' : clusterIds ? 'Callouts in this cluster' : 'Incident list'}</h2><p>${count(list.length)} ${view === 'notebook' ? 'saved records · stored on this device' : 'records · current filters and replay apply'}</p><button id="close-view" class="icon-button" aria-label="Return to map">${icon('close')}</button></div>${view === 'notebook' ? '<div class="notice">Your notebook includes all saved records, regardless of the current filters.</div><button id="clear-notebook" class="text-button">Clear notebook…</button>' : `<label class="search-box">${icon('search')}<input id="list-search" type="search" value="${e(filters.query)}" placeholder="Search the register…" aria-label="Search incident list"></label>${clusterIds ? '<button id="all-results" class="text-button">Show all matching records</button>' : ''}`}<div class="record-list">${
      list
        .slice(page * perPage, (page + 1) * perPage)
        .map(({ id, record: r }) =>
          r
            ? `<article class="list-record"><img src="${asset(`art/${animalArt(r.category)}.svg`)}" alt=""><div><button class="open-record" data-record="${e(id)}">${e(r.animal)} · ${e(r.borough)}</button><small>${displayDate(r.date)} · ${e(id)}${!r.location ? ' · Unmapped' : ''}</small><p>${e(r.description || 'No description supplied.')}</p></div>${view === 'notebook' ? `<button class="remove-record icon-button" data-remove="${e(id)}" aria-label="Remove ${e(id)} from notebook">×</button>` : ''}</article>`
            : `<article class="list-record"><div><strong>Record ${e(id)} is unavailable</strong><p>This saved identifier is not in the refreshed snapshot.</p></div><button class="remove-record" data-remove="${e(id)}">Remove</button></article>`,
        )
        .join('') ||
      `<div class="empty-state"><img src="${asset('art/paw.svg')}" alt=""><h3>${view === 'notebook' ? 'A fresh page awaits.' : 'No callouts found.'}</h3><p>${view === 'notebook' ? 'Save an incident to keep it here.' : 'Try a different search, clear your filters, or show all replay dates.'}</p><button id="empty-action">${view === 'notebook' ? 'Explore the map' : 'Clear filters & replay'}</button></div>`
    }</div><div class="pagination"><button id="prev-page" ${page === 0 ? 'disabled' : ''}>← Previous</button><span>Page ${page + 1} of ${pages}</span><button id="next-page" ${page >= pages - 1 ? 'disabled' : ''}>Next →</button></div>`;
    on('#close-view', 'click', () => {
      view = 'explore';
      listOpen = false;
      setNavigation();
      renderView();
      $('#list-toggle').focus();
    });
    on('#prev-page', 'click', () => {
      page--;
      renderView();
      panel.scrollTop = 0;
      $('#next-page').focus();
    });
    on('#next-page', 'click', () => {
      page++;
      renderView();
      panel.scrollTop = 0;
      $('#prev-page').focus();
    });
    if (view === 'notebook')
      on('#clear-notebook', 'click', () => {
        if (!saved.length) return;
        $('#dialog-body').innerHTML =
          '<h2>Clear your notebook?</h2><p>This removes all saved incident IDs from this device.</p><button id="confirm-clear" class="primary">Clear saved records</button><button id="cancel-clear">Keep my notebook</button>';
        showDialog();
        on('#confirm-clear', 'click', () => {
          saved = [];
          persist();
          renderDetail();
          renderView();
          $<HTMLDialogElement>('#info-dialog').close();
        });
        on('#cancel-clear', 'click', () => $<HTMLDialogElement>('#info-dialog').close());
      });
    else {
      on('#list-search', 'input', (ev) => {
        const input = ev.target as HTMLInputElement;
        filters.query = input.value;
        filtered = records.filter((r) => matches(r, filters));
        timeline.reset(filtered);
        page = 0;
        clusterIds = null;
        syncFilters();
        renderCount();
        renderTimeline();
        updateMap();
        saveURL();
        const selection = input.selectionStart;
        renderView();
        const next = $<HTMLInputElement>('#list-search');
        next.focus();
        if (selection !== null) next.setSelectionRange(selection, selection);
      });
      if (clusterIds)
        on('#all-results', 'click', () => {
          clusterIds = null;
          page = 0;
          renderView();
        });
    }
    if (root.querySelector('#empty-action'))
      on('#empty-action', 'click', () => {
        if (view === 'notebook') {
          view = 'explore';
          listOpen = false;
          setNavigation();
          renderView();
        } else {
          filters = emptyFilters();
          applyFilters();
        }
      });
  }
  function setNavigation() {
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
      const active = b.dataset.view === view;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    root.classList.toggle('analysis-open', view !== 'explore');
  }
  function showDialog() {
    $<HTMLDialogElement>('#info-dialog').showModal();
  }
  async function share() {
    const link = encodeState(location.href, filters, selected?.id);
    try {
      await navigator.clipboard.writeText(link);
      if (!disposed) notify('Link copied, including your current filters.');
    } catch {
      if (disposed) return;
      $('#dialog-body').innerHTML =
        `<h2>Share this record</h2><p>Copy the link below. Your selected incident and filters are included.</p><label>Shareable link<input id="share-link" value="${e(link)}" readonly></label>`;
      showDialog();
      $<HTMLInputElement>('#share-link').select();
    }
  }
  function showAbout() {
    const m = snapshot.metadata;
    $('#dialog-body').innerHTML =
      `<span class="eyebrow">NOTES FROM THE ARCHIVE</span><h2>About this dispatch desk</h2><p>An independent historical explorer. It is not affiliated with or endorsed by the London Fire Brigade.</p><h3>Contact</h3><address class="about-contact">Morten Teinum<br><a href="mailto:morten@teinum.no">morten@teinum.no</a></address><h3>The records</h3><p>${count(records.length)} records from ${displayDate(m.coverage.from, false)} to ${displayDate(m.coverage.to, false)}. Retrieved ${e(m.retrieved.slice(0, 10))}. ${count(records.filter((r) => !r.location).length)} records have no usable rounded coordinates.</p><p><a href="${e(m.source)}" target="_blank" rel="noreferrer">London Fire Brigade / London Datastore</a> · <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>. Contains public sector information licensed under the OGL v3.0.</p><p>Times are displayed exactly as recorded, without asserting a timezone. Replay uses a civil-clock sequence; repeated daylight-saving hours cannot be disambiguated. Source descriptions may be missing or redacted. Outcomes are not separately recorded.</p><h3>Locations & cartography</h3><p>Rounded grid coordinates use British National Grid, inferred and cross-checked against supplied latitude/longitude. Observed grid spacing is 100 m; this is not a guarantee of positional accuracy. Map squares show that grid area. Unmapped records stay in the list.</p><p>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors, ODbL</a>. The map is a local, current extract: main roads and parks across London; more street and building detail in the centre. Extrusions use supplied heights or an estimate of 3 m per recorded floor. The map is not historical.</p><h3>Original illustrations</h3><p>Animal portraits and the paw/helmet mark were drawn for this application in SVG. They are illustrations, not photographs of animals in these incidents. Fonts: Barlow Condensed, DM Sans and Lora (SIL Open Font Licence), served locally.</p><h3>Replay & patterns</h3><p>At 1×, one second advances 30 recorded days. Changing filters resets replay to all dates. Scrubbing pauses. Replay stops at the end and pauses in hidden tabs. Fade keeps calls from the preceding 30 days prominent. Monthly pattern counts pool available years; partial periods are identified, not treated as comparable full years.</p><p><a href="${asset('data/source.csv')}" download>Download source fields (CSV)</a> · <a href="${asset('data/provenance.json')}">Snapshot audit</a> · <a href="${asset('map/provenance.json')}">Map provenance</a></p>`;
    showDialog();
  }
  on('#open-filters', 'click', () => {
    root.classList.add('filters-open');
    $('#close-filters').focus();
  });
  on('#close-filters', 'click', () => {
    root.classList.remove('filters-open');
    $('#open-filters').focus();
  });
  on('#close-incident', 'click', () => {
    selected = null;
    root.classList.remove('incident-open');
    renderDetail();
    map?.select(null);
    saveURL();
    $('#list-toggle').focus();
  });
  on('#list-toggle', 'click', () => {
    view = 'explore';
    listOpen = !listOpen;
    clusterIds = null;
    page = 0;
    root.classList.remove('incident-open');
    setNavigation();
    renderView();
  });
  on('#reset-map', 'click', () => map?.reset());
  on('#close-dialog', 'click', () => $<HTMLDialogElement>('#info-dialog').close());
  root.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === 'Escape') {
        root.classList.remove('filters-open', 'incident-open');
      }
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (ev) => {
      const target = ev.target as HTMLElement,
        button = target.closest<HTMLButtonElement>('button');
      if (!button || !records.length) return;
      if (button.dataset.view) {
        view = button.dataset.view as typeof view;
        timeline.pause();
        renderTimeline();
        page = 0;
        listOpen = false;
        root.classList.remove('incident-open');
        setNavigation();
        renderView();
      }
      if (button.dataset.animal !== undefined) {
        const a = button.dataset.animal;
        filters.animals = !a
          ? []
          : filters.animals.includes(a)
            ? filters.animals.filter((c) => c !== a)
            : [...filters.animals, a];
        applyFilters();
        root.querySelector<HTMLButtonElement>(`[data-animal="${CSS.escape(a)}"]`)?.focus();
      }
      if (button.dataset.record) select(button.dataset.record);
      if (button.dataset.remove) {
        saved = saved.filter((id) => id !== button.dataset.remove);
        persist();
        renderView();
        renderDetail();
      }
    },
    { signal },
  );
  async function start() {
    try {
      const res = await fetch(asset('data/incidents.json'), { signal });
      if (!res.ok) throw new Error(`Snapshot request failed (${res.status})`);
      snapshot = (await res.json()) as Snapshot;
      if (
        snapshot.version !== 1 ||
        !Array.isArray(snapshot.records) ||
        !snapshot.records.length ||
        !snapshot.metadata?.coverage
      )
        throw new Error('Snapshot is invalid');
      records = snapshot.records;
      try {
        storage = window.localStorage;
        const n = readNotebook(storage);
        saved = n.ids;
        if (n.error) notify(n.error);
      } catch {
        notify(
          'Local notebook storage is unavailable. Saved records will last for this visit only.',
        );
      }
      $('#notebook-count').textContent = String(saved.length);
      $('#borough').innerHTML =
        '<option value="">All boroughs</option>' +
        snapshot.metadata.boroughs.map((b) => `<option>${e(b)}</option>`).join('');
      $('#more-animal').innerHTML =
        '<option value="">Choose a category…</option>' +
        snapshot.metadata.categories
          .filter((c) => !['Cat', 'Dog', 'Bird', 'Fox'].includes(c))
          .map((c) => `<option>${e(c)}</option>`)
          .join('');
      for (const id of ['from', 'to']) {
        const input = $<HTMLInputElement>(`#${id}`);
        input.min = snapshot.metadata.coverage.from.slice(0, 10);
        input.max = snapshot.metadata.coverage.to.slice(0, 10);
      }
      const decoded = decodeState(
        location.search,
        snapshot.metadata.categories,
        snapshot.metadata.boroughs,
      );
      filters = decoded.filters;
      on('#search', 'input', (ev) => {
        filters.query = (ev.target as HTMLInputElement).value;
        applyFilters();
      });
      for (const name of ['from', 'to'] as const)
        on(`#${name}`, 'change', (ev) => {
          filters[name] = (ev.target as HTMLInputElement).value;
          if (filters.from && filters.to && filters.from > filters.to) {
            [filters.from, filters.to] = [filters.to, filters.from];
            notify('Date endpoints were swapped to keep the range in order.');
          }
          applyFilters();
        });
      on('#borough', 'change', (ev) => {
        filters.borough = (ev.target as HTMLSelectElement).value;
        applyFilters();
      });
      on('#overnight', 'change', (ev) => {
        filters.overnight = (ev.target as HTMLInputElement).checked;
        applyFilters();
      });
      on('#more-animal', 'change', (ev) => {
        const input = ev.target as HTMLSelectElement;
        if (input.value && !filters.animals.includes(input.value))
          filters.animals.push(input.value);
        input.value = '';
        applyFilters();
      });
      on('#clear', 'click', () => {
        filters = emptyFilters();
        applyFilters();
      });
      on('#surprise', 'click', () => {
        if (filtered.length) select(filtered[Math.floor(Math.random() * filtered.length)].id);
      });
      on('#about', 'click', showAbout);
      on('#play', 'click', () => {
        if (timeline.playing) timeline.pause();
        else timeline.play();
        lastTick = performance.now();
        renderTimeline();
        updateMap();
      });
      on('#scrub', 'input', (ev) => {
        timeline.scrub(Number((ev.target as HTMLInputElement).value));
        renderTimeline();
        updateMap();
        renderView();
        renderDetail();
      });
      on(
        '#speed',
        'change',
        (ev) => (timeline.speed = Number((ev.target as HTMLSelectElement).value)),
      );
      on('#fade', 'change', (ev) => {
        timeline.recent = (ev.target as HTMLInputElement).checked;
        updateMap();
      });
      on('#follow', 'change', (ev) => (timeline.follow = (ev.target as HTMLInputElement).checked));
      on('#all-history', 'click', () => {
        timeline.reset(filtered);
        renderTimeline();
        updateMap();
        renderView();
        renderDetail();
      });
      applyFilters();
      if (decoded.selected) {
        const r = records.find((r) => r.id === decoded.selected);
        if (r) select(r.id, false, false);
        else
          notify(
            `Incident ${decoded.selected} is not in this snapshot. Browse the available records.`,
          );
      } else {
        const r = filtered.find(
          (r) =>
            r.category === 'Cat' &&
            r.location &&
            r.location.coordinates[0] > -0.16 &&
            r.location.coordinates[0] < -0.08 &&
            r.location.coordinates[1] > 51.495 &&
            r.location.coordinates[1] < 51.53 &&
            /tree/i.test(r.description),
        );
        if (r) select(r.id, false, false);
      }
      if (decoded.warnings.length) notify(decoded.warnings.join(' '));
      timer = setInterval(() => {
        const now = performance.now();
        const elapsed = now - lastTick;
        lastTick = now;
        if (document.hidden || !timeline.playing) return;
        const previous = timeline.cursor;
        if (timeline.tick(elapsed)) {
          renderTimeline();
          map?.update(timeline.visible(filtered), timeline.cursor, timeline.recent);
          if (listOpen) renderView();
          if (timeline.follow) {
            const latest = filtered
              .filter((r) => r.clock <= timeline.cursor && r.clock > previous)
              .at(-1);
            if (latest) {
              selected = latest;
              renderDetail();
              map?.select(latest, true);
              saveURL();
            }
          }
        }
      }, 150);
      document.addEventListener(
        'visibilitychange',
        () => {
          lastTick = performance.now();
          if (document.hidden) {
            timeline.pause();
            renderTimeline();
          }
        },
        { signal },
      );
      window.addEventListener(
        'storage',
        (ev) => {
          if (ev.key === NOTEBOOK_KEY && storage) {
            saved = readNotebook(storage).ids;
            $('#notebook-count').textContent = String(saved.length);
            renderDetail();
            renderView();
          }
        },
        { signal },
      );
      window.addEventListener(
        'popstate',
        () => {
          const state = decodeState(
            location.search,
            snapshot.metadata.categories,
            snapshot.metadata.boroughs,
          );
          filters = state.filters;
          selected = records.find((r) => r.id === state.selected) ?? null;
          applyFilters();
          map?.select(selected);
        },
        { signal },
      );
      try {
        const { createMap } = await import('./map');
        if (disposed) return;
        map = await createMap(
          $('#map'),
          (id) => select(id),
          (ids) => {
            timeline.pause();
            renderTimeline();
            clusterIds = new Set(ids);
            page = 0;
            listOpen = true;
            view = 'explore';
            setNavigation();
            root.classList.remove('incident-open');
            renderView();
          },
          (message) => {
            $('#map-message').textContent = message;
            $('#map-message').hidden = false;
          },
          signal,
        );
        if (disposed) {
          map.destroy();
          return;
        }
        $('#map-loading').hidden = true;
        updateMap();
        map.select(selected, matchMedia('(max-width: 760px)').matches);
        const resize = new ResizeObserver(() => map?.resize());
        resize.observe($('#map'));
        signal.addEventListener('abort', () => resize.disconnect(), { once: true });
      } catch {
        if (!disposed) {
          $('#map-loading').hidden = true;
          $('#map-message').textContent =
            'Map unavailable. All records, filters and notebook are available in the incident list.';
          $('#map-message').hidden = false;
          listOpen = true;
          renderView();
        }
      }
    } catch (err) {
      if (disposed) return;
      $('#map-loading').hidden = true;
      $('#map-message').hidden = false;
      $('#map-message').innerHTML =
        `<h2>The archive could not be opened.</h2><p>${e(err instanceof Error ? err.message : 'Data unavailable')}</p><button id="retry-data">Try again</button>`;
      on('#retry-data', 'click', () => location.reload());
      $('#matching').textContent = 'Data unavailable';
      notify('Unable to load the bundled incident snapshot.');
    }
  }
  void start();
  return () => {
    disposed = true;
    controller.abort();
    clearInterval(timer);
    clearTimeout(toastTimer);
    map?.destroy();
    root.replaceChildren();
    root.classList.remove('lar', 'filters-open', 'incident-open', 'analysis-open');
  };
}
