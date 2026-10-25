/*
 * DxlCoop - Drexel Co-op Job View Enhancer
 *
 * Copyright (c) 2026 Ahmet Sacan.
 * All rights reserved.
 */

(() => {
  'use strict';

  const CACHE_PREFIX = 'dxlcoop.jobcache2:';
const fields = [
  { key: 'company',        label: 'Company',        dataKey: 'Company Description' },
  { key: 'description',    label: 'Description',    dataKey: 'Position Description' },
  { key: 'qualifications', label: 'Qualifications', dataKey: 'Qualifications' },
  { key: 'instructions',   label: 'Instructions',   dataKey: 'Additional Application Instructions' },
  { key: 'location',       label: 'Location',       dataKeys: ['Position Address', 'Transportation to work', 'Travel required for position', 'Anticipated travel information'] },
  { key: 'compensation',   label: 'Compensation',   dataKeys: ['Compensation Status', 'Other Compensation', 'Other Compensation Details', 'Approximate Hours Per Week'] },
  { key: 'requirements',   label: 'Requirements',   dataKeys: ['Minimum GPA', 'Citizenship Restriction', 'Pre-Employment Screening Requirements'] }
];
  const defaults = {
    showDetails: false, company: false, description: true, qualifications: true,
    instructions: false, location: false, compensation: false, requirements: false
  };

  const path = location.pathname;
const pageKey =
  path.endsWith('/hwczksjsd.P_StudentJobCart') ? 'cart' :
  path.endsWith('/hwczksrmr.P_StudentReqMaintIntrvReq') ? 'interviews' :
  path.endsWith('/hwczksjsc.P_StudentJobSearchValidate') ||
  path.endsWith('/hwczkglbp.P_AlterOverridePaging') ? 'search' :
  null;
                   console.log('pageKey:', pageKey);
  if (!pageKey) return;

  const table = document.querySelector('table.dataentrytable');
  if (!table) return;

  let state = { ...defaults };
  let jobs = [];
  const cache = new Map();

  // ---------------------------------------------------------------------  
  function storageGet(key) {
    return new Promise(resolve => chrome.storage.local.get(key, resolve));
  }
  function storageSet(value) {
    return new Promise(resolve => chrome.storage.local.set(value, resolve));
  }
  function storageRemove(keys) {
    return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  }

  // ---------------------------------------------------------------------  
  function jobCacheKey(url) {
    const u = new URL(url, location.href);
    const jobNum = u.searchParams.get('i_job_num');
    const beginTerm = u.searchParams.get('i_begin_term');
    if (!jobNum || !beginTerm) return null;
    return `i_job_num=${jobNum}&i_begin_term=${beginTerm}`;
  }

  // ---------------------------------------------------------------------  
  function localCacheKey(url) {
    const key = jobCacheKey(url);
    return key ? CACHE_PREFIX + key : null;
  }

  // ---------------------------------------------------------------------  
  function isJobUrl(href) {
    try {
      const u = new URL(href, location.href);
      return u.protocol === 'https:' && u.hostname === 'banner.drexel.edu' &&
             u.pathname === '/duprod/hwczkslib.P_StudentJobDisplay' && u.search.length > 1;
    } catch (_) { return false; }
  }

  // ---------------------------------------------------------------------
  function findJobs() {
    const seen = new Set();

    const found = [...table.querySelectorAll('a[href]')].filter(a => {
      if (!isJobUrl(a.href) || seen.has(a.href))
        return false;

      seen.add(a.href);
      return true;
    });

    return found.map((link, index) => {
      const firstRow = link.closest('tr');
      const rows = [];

      if (firstRow) {
        if (pageKey === 'cart') {
          // Cart has exactly one row per job.
          rows.push(firstRow);

        } else {
/*
 * Search and interviews pages have a title row followed by zero
 * or more additional rows. They belong to this job until the next
 * row containing a JobDisplay link.
 */
          let row = firstRow;

          while (row) {
            if (row !== firstRow) {
              const nextJobLink = [...row.querySelectorAll('a[href]')]
                .find(a => isJobUrl(a.href));

              if (nextJobLink)
                break;
            }

            rows.push(row);
            row = row.nextElementSibling;
          }

          /*
           * Do not include the final records/footer rows if this is the
           * last job.
           */
          while (rows.length > 1) {
            const last = rows[rows.length - 1];

            if (
              last.querySelector('.delabel') ||
              /Records\s+\d+\s+to\s+\d+/i.test(last.textContent)
            )
              rows.pop();
            else
              break;
          }
        }
      }

      return {
        link,
        details: null,
        data: null,
        rows
      };
    });
  }
  // ---------------------------------------------------------------------  
  function fieldDisplayValue(data, field) {
    if (field.dataKey)
      return data[field.dataKey] || '';

    if (field.dataKeys) {
      return field.dataKeys
        .filter(key => data[key])
        .map(key => `${key}: ${data[key]}`)
        .join('\n');
    }

    return '';
  }
// ---------------------------------------------------------------------
function updateDetailOptionsVisibility() {
  for (const label of document.querySelectorAll('.dxlcoop-detail-option'))
    label.style.display = state.showDetails ? '' : 'none';
}

// ---------------------------------------------------------------------  
  function createOptions() {
    const div = document.createElement('div');
    div.id = 'dxlcoop-options';
    const options = [{ key: 'showDetails', label: 'Show Details' }, ...fields];

    for (const opt of options) {
      const label = document.createElement('label');
      if (opt.key !== 'showDetails')  label.className = 'dxlcoop-detail-option';      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.key = opt.key;
      cb.checked = !!state[opt.key];

      cb.addEventListener('change', async () => {
        state[opt.key] = cb.checked;
        await storageSet({ [pageKey]: state });

        if (opt.key === 'showDetails') {
          updateDetailOptionsVisibility();

          if (state.showDetails)
            await showAll();
          else
            hideAll();

        } else if (state.showDetails) {
          renderAll();
        }
      });

      label.append(cb, document.createTextNode(' ' + opt.label));
      div.appendChild(label);
    }
    updateDetailOptionsVisibility();

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'dxlcoop-search';
    searchInput.placeholder = 'search & filter';
    searchInput.addEventListener('input', applySearch);
    div.appendChild(searchInput);


    const downloadTSVButton = document.createElement('button');
    downloadTSVButton.type = 'button';
    downloadTSVButton.id = 'dxlcoop-download-tsv';
    downloadTSVButton.textContent = 'TSV';
    downloadTSVButton.title = 'Download job list as TSV file';
    downloadTSVButton.addEventListener('click', () => downloadDelimited('tsv'));
    div.appendChild(downloadTSVButton);

    const downloadCSVButton = document.createElement('button');
    downloadCSVButton.type = 'button';
    downloadCSVButton.id = 'dxlcoop-download-csv';
    downloadCSVButton.textContent = 'CSV';
    downloadCSVButton.title = 'Download job list as CSV file';
    downloadCSVButton.addEventListener('click', () => downloadDelimited('csv'));
    div.appendChild(downloadCSVButton);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.id = 'dxlcoop-clear-cache';
    clearButton.textContent = 'Clear Cache';
    clearButton.title = 'Clear cached job details';
    clearButton.addEventListener('click', clearCache);
    div.appendChild(clearButton);

    table.parentNode.insertBefore(div, table);    
  }

  // ---------------------------------------------------------------------  
  function normalizeText(el) {
    if (!el) return '';
    return (el.innerText || el.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ---------------------------------------------------------------------  
  function cleanFieldName(s) {
    return s
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/:\s*$/, '');
  }

  // ---------------------------------------------------------------------  
  function extractLabeledFields(doc) {
    const data = {};

    /*
     * Banner uses bluesmallertext for most "Field: Value" entries.
     *
     * Usually the value is another span in the same TD, but sometimes
     * there are multiple value spans or <br> elements. Therefore, get
     * the complete TD text and remove the label from its beginning.
     */
    for (const labelEl of doc.querySelectorAll('span.bluesmallertext')) {
      const label = cleanFieldName(normalizeText(labelEl));

      if (!label)
        continue;

      const td = labelEl.closest('td');
      if (!td)
        continue;

      const fullText = normalizeText(td);
      const labelText = normalizeText(labelEl);

      let value = fullText;

      if (value.startsWith(labelText))
        value = value.substring(labelText.length).trim();

      /*
       * Some blue spans are informational statements rather than
       * "field: value" entries. Only consider something a normal
       * field when its displayed label ends in a colon.
       */
      if (!labelText.trim().endsWith(':'))
        continue;

      data[label] = value;
    }

    return data;
  }

  // ---------------------------------------------------------------------  
  function extractHeadingSection(doc, heading) {
    const headingSpan = [...doc.querySelectorAll('span.strongtext')]
      .find(el => cleanFieldName(normalizeText(el)) === cleanFieldName(heading));

    if (!headingSpan)
      return '';

    const headingRow = headingSpan.closest('tr');
    if (!headingRow)
      return '';

    const parts = [];

    for (let row = headingRow.nextElementSibling; row; row = row.nextElementSibling) {
      /*
       * Stop when the next major section starts.
       */
      if (row.querySelector('span.strongtext'))
        break;

      /*
       * Do not include ordinary blue "Field: Value" rows here.
       * Those are extracted separately into their own TSV columns.
       */
      if (row.querySelector('span.bluesmallertext'))
        continue;

      const text = normalizeText(row);
      if (text)
        parts.push(text);
    }

    return parts.join('\n').trim();
  }

  // ---------------------------------------------------------------------  
  function extractJobData(doc, url) {
    const data = extractLabeledFields(doc);

    /*
     * Fields outside the main job-description table.
     */
    const employer = [...doc.querySelectorAll('span.strongtext')]
      .find(el => normalizeText(el) === 'Employer:');

    if (employer) {
      const p = employer.closest('p');
      if (p) {
        const text = normalizeText(p);
        const m = text.match(/^Employer:\s*(.*?)(?:\n|Hiring Office Location:|$)/s);
        if (m)
          data['Employer'] = m[1].trim();

        const m2 = text.match(/Hiring Office Location:\s*(.*)$/s);
        if (m2)
          data['Hiring Office Location'] = m2[1].trim();
      }
    }

    /*
     * Job Type/Duration/Length/Status are also outside the main table.
     */
    for (const labelEl of doc.querySelectorAll('span.strongtext')) {
      const label = cleanFieldName(normalizeText(labelEl));

      if (![
        "Job's Type",
        "Job's Duration",
        "Job's Length",
        "Job's Status"
      ].includes(label))
        continue;

      let value = '';
      let node = labelEl.nextSibling;

      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === 'BR')
          break;

        value += node.textContent || '';
        node = node.nextSibling;
      }

      data[label] = value.replace(/\u00a0/g, ' ').trim();
    }

    /*
     * Major free-text fields. These do not use the normal
     * blue-label/value format.
     */
    data['Company Description'] =
      extractHeadingSection(doc, 'Division/Location/Company Description:');

    data['Position Description'] =
      extractHeadingSection(doc, 'Position Description:');

    data['Qualifications'] =
      extractHeadingSection(doc, 'Qualifications:');

    data['Additional Application Instructions'] =
      extractHeadingSection(doc, 'Additional Application Instructions:');

    /*
     * Useful identifiers.
     */
    const u = new URL(url, location.href);
    data['Job Number'] = u.searchParams.get('i_job_num') || '';
    data['Begin Term'] = u.searchParams.get('i_begin_term') || '';
    data['URL'] = url;

    /*
     * Get title from the borderland table.
     */
    const title = doc.querySelector(
      'table.borderland span.largertext'
    );

    if (title)
      data['Job Title'] = normalizeText(title);

    return data;
  }

  // ---------------------------------------------------------------------  
  async function fetchJob(job) {
    if (job.data) return job.data;
    // if job.link.href does not start with "", console.log error message and trigger error (which will be caught later)
    if (!isJobUrl(job.link.href)) {
      console.error(`Invalid job URL: ${job.link.href}`);
      throw new Error('Invalid job URL');
    }

    const cacheKey = jobCacheKey(job.link.href);
    if (!cacheKey)
      throw new Error('Job URL is missing i_job_num or i_begin_term');

    // First check the in-memory cache.
    if (cache.has(cacheKey)) {
      job.data = await cache.get(cacheKey);
      return job.data;
    }

    // Next check the persistent local cache.
    const storageKey = localCacheKey(job.link.href);
    const saved = await storageGet(storageKey);

    if (saved[storageKey]) {
      job.data = saved[storageKey];

      // Also populate the faster in-memory cache.
      cache.set(cacheKey, Promise.resolve(job.data));

      return job.data;
    }

    // Not cached. Fetch the Job View page.
    const promise = (async () => {
      const response = await fetch(job.link.href, {
        credentials: 'include'
      });

      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const data = extractJobData(doc, job.link.href);

      // Save to persistent local cache.
      await storageSet({
        [storageKey]: data
      });

      return data;
    })();

    cache.set(cacheKey, promise);

    try {
      job.data = await promise;
      return job.data;
    } catch (e) {
      cache.delete(cacheKey);
      throw e;
    }
  }

  async function clearCache() {
    // Clear memory cache.
    cache.clear();

    for (const job of jobs)
      job.data = null;

    // Clear only dxlcoop job cache entries from persistent storage.
    // cart/search checkbox settings are left alone.
    const all = await storageGet(null);
    const keys = Object.keys(all)
      .filter(key => key.startsWith(CACHE_PREFIX));

    if (keys.length)
      await storageRemove(keys);

    if (state.showDetails)
      await showAll();
  }

  // ---------------------------------------------------------------------  
  function ensureDetails(job) {
    if (job.details && job.details.isConnected)
      return job.details;

    const div = document.createElement('div');
    div.className = 'dxlcoop-details';

    // Put details immediately below the title/link,
    // inside the same table cell.
    job.link.insertAdjacentElement('afterend', div);
    job.details = div;

    return div;
  }

  // ---------------------------------------------------------------------  
  function renderJob(job) {
    const div = ensureDetails(job);
    div.replaceChildren();

    if (!job.data) {
      const s = document.createElement('span');
      s.className = 'dxlcoop-status';
      s.textContent = 'Loading details...';
      div.appendChild(s);
      return;
    }

    let count = 0;

    for (const field of fields) {
      if (!state[field.key])
        continue;

      count++;

      const block = document.createElement('div');
      block.className = 'dxlcoop-field';

      const name = document.createElement('div');
      name.className = 'dxlcoop-field-name';
      name.textContent = field.label + ':';

      const value = document.createElement('div');
      value.className = 'dxlcoop-field-value';
      value.textContent = fieldDisplayValue(job.data, field) || '(not provided)';

      block.append(name, value);
      div.appendChild(block);
    }

    if (!count)
      div.textContent = 'No detail fields selected.';
  }

  // ---------------------------------------------------------------------  
  function renderAll() {
    if (!state.showDetails)
      return;

    for (const job of jobs)
      renderJob(job);
    applySearch();
 }

  // ---------------------------------------------------------------------  
  function hideAll() {
    for (const job of jobs) {
      if (job.details)
        job.details.remove();

      job.details = null;
    }
    applySearch();
  }

  // ---------------------------------------------------------------------  
  async function showAll() {
    for (const job of jobs)
      renderJob(job);

    await Promise.all(jobs.map(async job => {
      try {
        await fetchJob(job);

        if (state.showDetails)
          renderJob(job);

      } catch (e) {
        if (!state.showDetails)
          return;

        const div = ensureDetails(job);
        div.replaceChildren();

        const s = document.createElement('span');
        s.className = 'dxlcoop-error';
        s.textContent = 'Unable to load job details: ' + e.message;
        div.appendChild(s);
      }
    }));
    applySearch();
  }
  // ---------------------------------------------------------------------
  function clearSearchHighlights(root) {
    for (const mark of root.querySelectorAll('mark.dxlcoop-highlight')) {
      mark.replaceWith(document.createTextNode(mark.textContent));
    }

    root.normalize();
  }

  // ---------------------------------------------------------------------
  function highlightSearchText(root, term) {
    if (!term)
      return false;

    const needle = term.toLowerCase();
    let found = false;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim())
            return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;

          if (!parent ||
              parent.closest('script, style, mark.dxlcoop-highlight'))
            return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;

    while ((node = walker.nextNode()))
      textNodes.push(node);

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();

      if (!lower.includes(needle))
        continue;

      found = true;

      const fragment = document.createDocumentFragment();
      let pos = 0;
      let match;

      while ((match = lower.indexOf(needle, pos)) !== -1) {
        if (match > pos)
          fragment.appendChild(
            document.createTextNode(text.substring(pos, match))
          );

        const mark = document.createElement('mark');
        mark.className = 'dxlcoop-highlight';
        mark.textContent = text.substring(match, match + term.length);
        fragment.appendChild(mark);

        pos = match + term.length;
      }

      if (pos < text.length)
        fragment.appendChild(
          document.createTextNode(text.substring(pos))
        );

      textNode.replaceWith(fragment);
    }

    return found;
  }

    // ---------------------------------------------------------------------
  function parseSearchQuery(query) {
    query = query.trim();

    if (!query)
      return { terms: [], operator: 'AND' };

    const hasAND = /\bAND\b/i.test(query);
    const hasOR  = /\bOR\b/i.test(query);

    let operator;
    let terms;

    if (hasOR && !hasAND) {
      operator = 'OR';
      terms = query.split(/\s+OR\s+/i);
    } else {
      /*
       * Default to AND.
       *
       * This handles:
       *   python matlab
       *   python AND matlab
       *
       * If AND and OR are both used, they are treated simply as
       * separators with AND logic.
       */
      operator = 'AND';
      terms = query.split(/\s+(?:AND|OR)\s+|\s+/i);
    }

    terms = terms
      .map(term => term.trim())
      .filter(Boolean);

    return { terms, operator };
  }
  // ---------------------------------------------------------------------
function applySearch() {
  const searchInput = document.getElementById('dxlcoop-search');

  if (!searchInput)
    return;

    const searchText = searchInput.value.trim();
    const query = parseSearchQuery(searchText);
  
    for (const job of jobs) {
      /*
       * Remove highlights from the previous search.
       */
      for (const row of job.rows)
        clearSearchHighlights(row);

      if (job.details && !job.rows.some(row => row.contains(job.details)))
        clearSearchHighlights(job.details);

      /*
       * Determine whether each search term occurs anywhere in the
       * displayed information for this job.
       */
      const matches = query.terms.map(term => {
        let found = false;

        for (const row of job.rows) {
          if (row.textContent.toLowerCase().includes(term.toLowerCase())) {
            found = true;
            break;
          }
        }

        if (!found &&
            job.details &&
            !job.rows.some(row => row.contains(job.details)) &&
            job.details.textContent.toLowerCase().includes(term.toLowerCase()))
          found = true;

        return found;
      });

      /*
       * Determine whether the whole query matches this job.
       */
      let found = true;

      if (query.terms.length) {
        found = query.operator === 'OR'
          ? matches.some(Boolean)
          : matches.every(Boolean);
      }

      /*
       * Highlight every individual term that actually occurs.
       */
      for (let i = 0; i < query.terms.length; i++) {
        if (!matches[i])
          continue;

        const term = query.terms[i];

        for (const row of job.rows)
          highlightSearchText(row, term);

        if (job.details &&
            !job.rows.some(row => row.contains(job.details)))
          highlightSearchText(job.details, term);
      }

      /*
       * Filtering applies to the complete query, not to each
       * individual term.
       */
      const hide = searchText !== '' && !found;

      for (const row of job.rows)
        row.style.display = hide ? 'none' : '';
    }
  }
  // ---------------------------------------------------------------------  
  async function init() {
    const saved = await storageGet(pageKey);

    if (saved[pageKey] && typeof saved[pageKey] === 'object')
      state = { ...defaults, ...saved[pageKey] };

    jobs = findJobs();
    createOptions();

    if (state.showDetails)
      await showAll();
  }

  // ---------------------------------------------------------------------
  function delimitedValue(value, delimiter) {
    if (value == null)
      return '';

    value = String(value)
      .replace(/\r?\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (delimiter === '\t') {
      // Keep TSV simple: tabs within values become spaces.
      return value.replace(/\t/g, ' ');
    }

    // CSV quoting rules.
    if (value.includes('"'))
      value = value.replace(/"/g, '""');

    if (value.includes(delimiter) || value.includes('"'))
      value = `"${value}"`;

    return value;
  }
  // ---------------------------------------------------------------------  
    // ---------------------------------------------------------------------
  async function downloadDelimited(format) {
    const isCSV = format === 'csv';
    const delimiter = isCSV ? ',' : '\t';
    const extension = isCSV ? 'csv' : 'tsv';
    const mimeType = isCSV
      ? 'text/csv;charset=utf-8'
      : 'text/tab-separated-values;charset=utf-8';

    const button = document.getElementById(
      isCSV ? 'dxlcoop-download-csv' : 'dxlcoop-download-tsv'
    );
    const oldText = button ? button.textContent : '';

    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing...';
    }

    try {
      const searchText =
        document.getElementById('dxlcoop-search')?.value.trim() || '';

      const downloadJobs = searchText
        ? jobs.filter(job => job.rows.some(row => row.style.display !== 'none'))
        : jobs;
      /*
       * Download every job regardless of the Show Details state.
       * fetchJob() will use memory/local cache when available.
       */
      const results = await Promise.all(downloadJobs.map(async job => {
        try {
          return await fetchJob(job);
        } catch (e) {
          console.error('dxlcoop: unable to download job', job.link.href, e);

          return {
            'Job Number': jobCacheKey(job.link.href) || '',
            'URL': job.link.href,
            'Download Error': e.message
          };
        }
      }));

      const preferred = [
        'Employer',
        'Job Title',
        'URL',
        'Position Description',
        'Qualifications',
        'Additional Application Instructions',
        'Majors Sought',
        'Level(s) of Experience Sought',
        'Transportation to work',
        'Travel required for position',
        'Minimum GPA',
        'Citizenship Restriction',
        'Compensation Status',
        'Other Compensation',
        'Other Compensation Details',
        'Approximate Hours Per Week',
        'Job Number',
        'Begin Term',
        'Hiring Office Location',
        "Job's Type",
        "Job's Duration",
        "Job's Length",
        "Job's Status",
        'Company Description',
        'Number of Openings',
        'Exposure to hazardous and/or biohazardous materials',
        'Research Position',
        'Students are hired by a third-party employer',
        'Recommended Qualifications',
        'Position Address',
        'Anticipated travel information',
        'Pre-Employment Screening Requirements',
        'Download Error'
      ];

      const allKeys = new Set();

      for (const data of results)
        for (const key of Object.keys(data))
          allKeys.add(key);

      const columns = [];

      for (const key of preferred) {
        if (allKeys.has(key)) {
          columns.push(key);
          allKeys.delete(key);
        }
      }

      // Include unexpected Banner fields instead of discarding them.
      columns.push(...[...allKeys].sort());

      const lines = [
        columns.map(key => delimitedValue(key, delimiter)).join(delimiter),
        ...results.map(data =>
          columns
            .map(key => delimitedValue(data[key], delimiter))
            .join(delimiter)
        )
      ];

      const blob = new Blob(
        [lines.join('\r\n')],
        { type: mimeType }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download =
        `dxlcoop-${pageKey}-${new Date().toISOString().slice(0, 10)}.${extension}`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  init();
})();