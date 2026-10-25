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
const routeFields = [
  { key: 'time', label: 'Time' },
  { key: 'distance', label: 'Distance' }
];

  const defaults = {
    showDetails: false, company: false, description: true, qualifications: true,
    instructions: false, location: false, compensation: false, requirements: false,
    startingAddresses: [],  distance: false, time: false, sortBy: '',
    showRatings: true, sortByRating: true
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

  let googleRoutesApiKey = '';


let state = { ...defaults };
  let jobs = [];
  const cache = new Map();
  let startingAddresses = [];
  let ratings = {};

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
function optionsUrl() {
  return chrome.runtime.getURL('options.html');
}
// ---------------------------------------------------------------------  
function appendOptionsLink(container, text, linkText) {
  container.appendChild(document.createTextNode(text));

  const a = document.createElement('a');
  a.href = optionsUrl();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = linkText;

  container.appendChild(a);
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
        rows,
        ratingKey: link.textContent.trim(),
        rating: 0
      };
    });
  }
// ---------------------------------------------------------------------
function renderFieldValue(container, data, field) {
  if (field.dataKey) {
    container.textContent = data[field.dataKey] || '(not provided)';
    return;
  }

  if (!field.dataKeys) {
    container.textContent = '(not provided)';
    return;
  }

  let count = 0;

  for (const key of field.dataKeys) {
    const fieldValue = data[key];

    if (!fieldValue)
      continue;

    if (count++)
      container.appendChild(document.createElement('br'));

    container.appendChild(
      document.createTextNode(key + ': ')
    );

    if (key === 'Position Address') {
      const a = document.createElement('a');
      a.href = googleMapsDirectionsUrl(fieldValue);
      a.textContent = fieldValue;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = 'Open driving directions in Google Maps';

      container.appendChild(a);
    } else {
      container.appendChild(
        document.createTextNode(fieldValue)
      );
    }
  }

  if (!count)
    container.textContent = '(not provided)';
}

// ---------------------------------------------------------------------
function updateDetailOptionsVisibility() {
  for (const label of document.querySelectorAll('.dxlcoop-detail-option'))
    label.style.display = state.showDetails ? '' : 'none';
}
// ---------------------------------------------------------------------
function isSearchPageUrl(href) {
  try {
    const u = new URL(href, location.href);

    return u.hostname === 'banner.drexel.edu' &&
      u.pathname === '/duprod/hwczksjsd.P_StudentJobSearchDisplay' &&
      u.searchParams.has('i_total_recs') &&
      u.searchParams.has('i_recs_per_page') &&
      u.searchParams.has('i_curr_page');
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------
function getSearchPagination() {
  if (pageKey !== 'search')
    return null;

  const links = [...table.querySelectorAll('a[href]')]
    .filter(a => isSearchPageUrl(a.href));

  if (!links.length)
    return null;

  /*
   * Get pagination information from any of the page links.
   */
  const u = new URL(links[0].href, location.href);

  const totalRecords =
    Number(u.searchParams.get('i_total_recs'));

  const recordsPerPage =
    Number(u.searchParams.get('i_recs_per_page'));

  if (!totalRecords || !recordsPerPage)
    return null;

  const totalPages =
    Math.ceil(totalRecords / recordsPerPage);

  if (totalPages <= 1)
    return null;

  /*
   * Use the current document URL when possible, otherwise page 1.
   */
  let currentPage = 1;

  const currentUrl = new URL(location.href);

  if (currentUrl.searchParams.has('i_curr_page'))
    currentPage = Number(currentUrl.searchParams.get('i_curr_page')) || 1;

  return {
    totalRecords,
    recordsPerPage,
    totalPages,
    currentPage,
    templateUrl: u
  };
}
// ---------------------------------------------------------------------
function isRecordCountRow(row) {
  return !!row.querySelector('.delabel') &&
    /Records\s+\d+\s+to\s+\d+\s+of\s+\d+\s+shown/i
      .test(row.textContent);
}

// ---------------------------------------------------------------------
function isSearchNavigationRow(row) {
  return [...row.querySelectorAll('a[href]')]
    .some(a => isSearchPageUrl(a.href));
}

// ---------------------------------------------------------------------
function isSearchHeaderSeparatorRow(row) {
  /*
   * The two rows between navigation and the first job contain only HRs.
   */
  return !!row.querySelector('hr') &&
    !row.querySelector('a[href]');
}

// ---------------------------------------------------------------------
function removeSearchTableHeaderRows(tableElement) {
  const rows = [...tableElement.rows];

  let navigationSeen = false;

  for (const row of rows) {
    if (isRecordCountRow(row)) {
      row.remove();
      continue;
    }

    if (isSearchNavigationRow(row)) {
      navigationSeen = true;
      row.remove();
      continue;
    }

    /*
     * Remove the HR separator rows immediately following pagination.
     */
    if (navigationSeen && isSearchHeaderSeparatorRow(row)) {
      row.remove();
      continue;
    }

    /*
     * First real job means the pagination/header area has ended.
     */
    if ([...row.querySelectorAll('a[href]')].some(a => isJobUrl(a.href)))
      navigationSeen = false;
  }
}
// ---------------------------------------------------------------------
function updateSearchRecordCount(totalRecords) {
  const rows = [...table.rows]
    .filter(row => isRecordCountRow(row));

  for (const row of rows) {
    const div = row.querySelector('.centeraligntext');

    if (div)
      div.textContent =
        `Records 1 to ${totalRecords} of ${totalRecords} shown`;
  }
}
// ---------------------------------------------------------------------
function removeCurrentSearchNavigation() {
  for (const row of [...table.rows]) {
    if (isSearchNavigationRow(row))
      row.remove();
  }
}
// ---------------------------------------------------------------------
async function loadAllSearchPages(button) {
  const pagination = getSearchPagination();

  if (!pagination)
    return;

  const oldText = button.textContent;

  button.disabled = true;

  try {
    const tbody = table.tBodies[0] || table;

    for (let page = 1; page <= pagination.totalPages; page++) {
      if (page === pagination.currentPage)
        continue;

      button.textContent =
        `Loading ${page}/${pagination.totalPages}...`;

      const u = new URL(pagination.templateUrl.href);

      u.searchParams.set('i_curr_page', page);

      const response = await fetch(u.href, {
        credentials: 'include'
      });

      if (!response.ok)
        throw new Error(
          `Unable to load search page ${page}: HTTP ${response.status}`
        );

      const html = await response.text();

      const doc =
        new DOMParser().parseFromString(html, 'text/html');

      const fetchedTable =
        doc.querySelector('table.dataentrytable');

      if (!fetchedTable)
        throw new Error(
          `Unable to find job table on search page ${page}`
        );

      /*
       * Strip the fetched page's record count, navigation, and
       * pagination-header separator rows.
       */
      removeSearchTableHeaderRows(fetchedTable);

      /*
       * Move the remaining rows into the current page.
       */
      const fetchedBody =
        fetchedTable.tBodies[0] || fetchedTable;

      for (const row of [...fetchedBody.rows])
        tbody.appendChild(document.adoptNode(row));
    }

    /*
     * Current table now contains every page.
     */
    updateSearchRecordCount(pagination.totalRecords);
    removeCurrentSearchNavigation();

    /*
     * Rebuild jobs because findJobs() originally ran before these
     * additional rows existed.
     */
jobs = findJobs();
renderAllRatings();

await Promise.all(jobs.map(async job => {
  try {
    await fetchJob(job);
  } catch (e) {
    console.error(
      'dxlcoop: unable to load employer for',
      job.link.href,
      e
    );
  }
}));

  if (state.sortBy) await updateDrivingData(true);
  if (state.sortBy || state.sortByRating) sortJobs();

    /*
     * The button is no longer useful after all pages are loaded.
     */
    button.remove();

    /*
     * Reapply the current display/filter state to the newly added jobs.
     */
    if (state.showDetails)
      await showAll();
    else
      applySearch();

  } catch (e) {
    console.error('dxlcoop: unable to load all search pages', e);

    button.disabled = false;
    button.textContent = oldText;

    alert('Unable to load all search pages: ' + e.message);
  }
}
// ---------------------------------------------------------------------  
  function createOptions() {
    const div = document.createElement('div');
    div.id = 'dxlcoop-options';
    const options = [{ key: 'showDetails', label: 'Show Details' }, ...fields,  ...routeFields];

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
          if (opt.key === 'distance' || opt.key === 'time')
            await updateDrivingData();

          renderAll();
        }
      });

      label.append(cb, document.createTextNode(' ' + opt.label));
      div.appendChild(label);
    }


const ratingLabel = document.createElement('label');

const ratingCheckbox = document.createElement('input');
ratingCheckbox.type = 'checkbox';
ratingCheckbox.id = 'dxlcoop-show-ratings';
ratingCheckbox.checked = !!state.showRatings;

ratingCheckbox.addEventListener('change', async () => {
  state.showRatings = ratingCheckbox.checked;

  await storageSet({
    [pageKey]: state
  });

  renderAllRatings();
});

ratingLabel.append(
  ratingCheckbox,
  document.createTextNode(' Ratings')
);

div.appendChild(ratingLabel);

const ratingSortLabel = document.createElement('label');

const ratingSortCheckbox = document.createElement('input');
ratingSortCheckbox.type = 'checkbox';
ratingSortCheckbox.id = 'dxlcoop-sort-rating';
ratingSortCheckbox.checked = !!state.sortByRating;

ratingSortCheckbox.addEventListener('change', async () => {
  state.sortByRating = ratingSortCheckbox.checked;

  await storageSet({
    [pageKey]: state
  });

  /*
   * Sorting is triggered by changing the sort option itself,
   * but NOT by clicking an individual job's rating stars.
   */
  sortJobs();
});

ratingSortLabel.append(
  ratingSortCheckbox,
  document.createTextNode(' Sort by rating')
);

div.appendChild(ratingSortLabel);




    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'dxlcoop-search';
    searchInput.placeholder = 'search & filter';
    searchInput.addEventListener('input', async () => {
      const query = parseSearchQuery(searchInput.value);
      if (query.constraints.length) {
        await updateDrivingData(true);

        if (state.sortBy)
          sortJobs();
      }
      applySearch();
    });
    div.appendChild(searchInput);


    


const sortSelect = document.createElement('select');
sortSelect.id = 'dxlcoop-sort';
sortSelect.title = 'Sort jobs by travel time or distance';

for (const [value, label] of [
  ['', 'Sort by'],
  ['time-asc', 'Time (asc)'],
  ['time-desc', 'Time (desc)'],
  ['distance-asc', 'Distance (asc)'],
  ['distance-desc', 'Distance (desc)']
]) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  sortSelect.appendChild(option);
}

sortSelect.value = state.sortBy || '';

sortSelect.addEventListener('change', async () => {
  state.sortBy = sortSelect.value;
  await storageSet({ [pageKey]: state });

  if (state.sortBy) {
    await updateDrivingData(true);
    sortJobs();
  }
});

div.appendChild(sortSelect);



if (pageKey === 'search' && getSearchPagination()) {
  const allPagesButton = document.createElement('button');

  allPagesButton.type = 'button';
  allPagesButton.id = 'dxlcoop-all-pages';
  allPagesButton.textContent = 'All pages';
  allPagesButton.title = 'Load all job search result pages';

  allPagesButton.addEventListener('click', () =>
    loadAllSearchPages(allPagesButton)
  );

  div.appendChild(allPagesButton);
}

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


//-------------------------------------------------------------------------------
const usableAddresses =
  startingAddresses.filter(item => item?.address?.trim());

if (usableAddresses.length) {
  const addressContainer = document.createElement('span');
  addressContainer.id = 'dxlcoop-starting-addresses';

  const addressLink = document.createElement('a');
  addressLink.href = optionsUrl();
  addressLink.target = '_blank';
  addressLink.rel = 'noopener noreferrer';
  addressLink.textContent = 'Starting address';
  addressLink.title = 'Configure starting addresses';

  addressContainer.append(
    addressLink,
    document.createTextNode(': ')
  );

  /*
   * Backward compatibility with the old single-address setting.
   */
  let selectedNames = Array.isArray(state.startingAddresses)
    ? state.startingAddresses
    : [];

  if (!selectedNames.length && state.startingAddress)
    selectedNames = [state.startingAddress];

  /*
   * Default to the first configured address.
   */
  if (!selectedNames.length) {
    selectedNames = [
      usableAddresses[0].name?.trim() || ''
    ];

    state.startingAddresses = selectedNames;
    delete state.startingAddress;

    storageSet({
      [pageKey]: state
    });
  }


  //------------------------------------------------------------------
for (const mode of ['drive', 'transit']) {
  for (const item of usableAddresses) {
    const name = item.name?.trim() || 'Unnamed address';
    const value = `${mode}:${name}`;

    const label = document.createElement('label');
    label.className = 'dxlcoop-starting-address-option';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = value;
    cb.checked = selectedNames.includes(value);

    cb.addEventListener('change', async () => {
      state.startingAddresses = [
        ...addressContainer.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ].map(cb => cb.value);

      delete state.startingAddress;

      await storageSet({
        [pageKey]: state
      });

      const needsRoutes =
        state.showDetails &&
        (state.distance || state.time);

      const searchQuery = parseSearchQuery(
        document.getElementById('dxlcoop-search')?.value || ''
      );

      const needsRouteFilter =
        searchQuery.constraints.length > 0;

      if (needsRoutes || state.sortBy || needsRouteFilter)
        await updateDrivingData(
          !!state.sortBy || needsRouteFilter
        );

      if (state.sortBy)
        sortJobs();

      if (state.showDetails)
        renderAll();
      else
        applySearch();
    });

    label.append(
      cb,
      document.createTextNode(' ' + value)
    );

    addressContainer.appendChild(label);
  }
}
//-----------------------------------------------------------------------------
  div.appendChild(addressContainer);


} else {
  const configure = document.createElement('a');
  configure.href = optionsUrl();
  configure.target = '_blank';
  configure.rel = 'noopener noreferrer';
  configure.textContent = 'Configure addresses';
  configure.className = 'dxlcoop-configure-addresses';
  div.appendChild(configure);
}
//-------------------------------------------------------------------------------


    table.parentNode.insertBefore(div, table);    
        updateDetailOptionsVisibility();

  }

// ---------------------------------------------------------------------
function routeSortValue(job, sortBy) {
  if (sortBy.startsWith('distance'))
    return minimumDrivingDistance(job);

  if (sortBy.startsWith('time'))
    return minimumDrivingTime(job);

  return null;
}
// ---------------------------------------------------------------------
function sortJobs() {
  const sortBy =
    document.getElementById('dxlcoop-sort')?.value || '';

if (!sortBy && !state.sortByRating)
  return;

  const descending = sortBy.endsWith('-desc');


const sorted = jobs
  .map((job, index) => ({
    job,
    index,
    rating: jobRating(job) || 3,
    value: sortBy
      ? routeSortValue(job, sortBy)
      : null
  }))
  .sort((a, b) => {
    /*
     * Rating is always the primary sort, highest first.
     * Unrated jobs have rating 0.
     */
    if (state.sortByRating && a.rating !== b.rating)
      return b.rating - a.rating;

    /*
     * Within each rating, apply the selected route sort.
     */
    if (sortBy) {
      if (a.value == null && b.value == null)
        return a.index - b.index;

      if (a.value == null)
        return 1;

      if (b.value == null)
        return -1;

      if (a.value !== b.value)
        return descending
          ? b.value - a.value
          : a.value - b.value;
    }

    return a.index - b.index;
  })
  .map(item => item.job);


const tbody = table.tBodies[0] || table;

/*
 * Banner tables may contain a records-count row both above and
 * below the jobs. Keep the bottom one below the sorted jobs.
 */
const recordCountRows = [...tbody.rows]
  .filter(row => isRecordCountRow(row));

const footerRow = recordCountRows.at(-1) || null;

for (const job of sorted) {
  for (const row of job.rows) {
    if (footerRow)
      tbody.insertBefore(row, footerRow);
    else
      tbody.appendChild(row);
  }
}

  jobs = sorted;

  applySearch();
}
// ---------------------------------------------------------------------
function showRoutesProgress() {
  let status = document.getElementById('dxlcoop-routes-progress');

  if (status)
    return;

  const options = document.getElementById('dxlcoop-options');

  if (!options)
    return;

  status = document.createElement('span');
  status.id = 'dxlcoop-routes-progress';

  const spinner = document.createElement('span');
  spinner.className = 'dxlcoop-spinner';

  const text = document.createElement('span');
  text.textContent = ' Retrieving Distances and Times from Google...';

  status.append(spinner, text);
  options.appendChild(status);
}

// ---------------------------------------------------------------------
function hideRoutesProgress() {
  document.getElementById('dxlcoop-routes-progress')?.remove();
}
// ---------------------------------------------------------------------
async function updateDrivingData(force = false) {
  /*
   * Never retain route values belonging to a previous selection.
   */
  for (const job of jobs)
    job.routes = [];

  if (!force && !state.showDetails)
    return;

  if (!force && !state.distance && !state.time)
    return;

  if (!googleRoutesApiKey)
    return;

  const selectedOrigins = selectedStartingAddresses();

  if (!selectedOrigins.length)
    return;

  await Promise.all(jobs.map(async job => {
    if (!job.data)
      await fetchJob(job);
  }));

const origins =
  selectedOrigins.map(item => item.routeOrigin);

  const destinations = jobs
    .map(job => job.data?.['Position Address']?.trim())
    .filter(Boolean);

  try {
    await GoogleRoutes.computeRouteMatrix(
      googleRoutesApiKey,
      origins,
      destinations,
      showRoutesProgress
    );
  } finally {
    hideRoutesProgress();
  }

  for (const job of jobs) {
    const destination =
      job.data?.['Position Address']?.trim();

    job.routes = [];

    if (!destination)
      continue;

    for (const origin of selectedOrigins) {
const route = await GoogleRoutes.getCached(
  origin.routeOrigin,
  destination
);

job.routes.push({
  name: origin.name,
  address: origin.address,
  routeOrigin: origin.routeOrigin,
  route
});

    }
  }
}

// ---------------------------------------------------------------------
function minimumDrivingDistance(job) {
  const values = (job.routes || [])
    .map(item => item.route?.distanceMeters)
    .filter(value => value != null);

  return values.length
    ? Math.min(...values)
    : null;
}
// ---------------------------------------------------------------------
function minimumDrivingTime(job) {
  const values = (job.routes || [])
    .map(item => routeDurationSeconds(item.route?.duration))
    .filter(value => value != null);

  return values.length
    ? Math.min(...values)
    : null;
}
// ---------------------------------------------------------------------
function formatDrivingDistance(meters) {
  if (meters == null)
    return 'Not available';

  const miles = meters / 1609.344;

  return miles < 10
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(miles)} mi`;
}
// ---------------------------------------------------------------------
function routeDurationSeconds(duration) {
  if (!duration)
    return null;

  const match = String(duration).match(/^([\d.]+)s$/);
  return match ? Number(match[1]) : null;
}
// ---------------------------------------------------------------------

function formatDrivingTime(duration) {
  const seconds = routeDurationSeconds(duration);

  if (seconds == null)
    return 'Not available';

  const minutes = Math.round(seconds / 60);

  if (minutes < 60)
    return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder
    ? `${hours} hr ${remainder} min`
    : `${hours} hr`;
}
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
function selectedStartingAddresses() {
  const container =
    document.getElementById('dxlcoop-starting-addresses');

  if (!container)
    return [];

  const selectedValues = [
    ...container.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ].map(cb => cb.value);

  return selectedValues
    .map(value => {
      const m = value.match(/^(drive|transit):(.*)$/i);

      const mode = m
        ? m[1].toLowerCase()
        : 'drive';

      const name = m
        ? m[2]
        : value;

      const item = startingAddresses.find(
        item => item.name?.trim() === name
      );

      if (!item?.address?.trim())
        return null;

      return {
        name: `${mode}:${name}`,
        mode,
        address: item.address.trim(),
        routeOrigin: `${mode}:${item.address.trim()}`
      };
    })
    .filter(Boolean);
}
// ---------------------------------------------------------------------
function googleMapsDirectionsUrl(destination) {
  destination = destination?.trim();

  if (!destination)
    return '';

const origin =  selectedStartingAddresses()[0]?.address || '';

  if (origin) {
    return 'https://www.google.com/maps/dir/' +
      encodeURIComponent(origin) + '/' +
      encodeURIComponent(destination);
  }

  return 'https://www.google.com/maps/dir//' +
    encodeURIComponent(destination);
}


// ---------------------------------------------------------------------
function googleMapsRouteUrl(origin, destination, mode = 'drive') {
  origin = origin?.trim();
  destination = destination?.trim();

  if (!origin || !destination)
    return '';

  const url = new URL(
    'https://www.google.com/maps/dir/'
  );

  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);

  /*
   * Google Maps Directions URLs support "driving" and "transit".
   */
  url.searchParams.set(
    'travelmode',
    mode === 'transit' ? 'transit' : 'driving'
  );

  return url.href;
}
// ---------------------------------------------------------------------  
function appendSingleLineField(
  container,
  label,
  value,
  href = '',
  bold = false
) {
  const line = document.createElement('div');
  line.className = 'dxlcoop-field-singleline';

  const name = document.createElement('span');
  name.className = 'dxlcoop-field-name-singleline';
  name.textContent = label + ': ';

  let val;

  if (href) {
    val = document.createElement('a');
    val.href = href;
    val.target = '_blank';
    val.rel = 'noopener noreferrer';
    val.title = 'Open route in Google Maps';
    val.textContent = value;
  } else {
    val = document.createElement('span');
    val.textContent = value;
  }

  if (bold)
    val.style.fontWeight = 'bold';

  line.append(name, val);
  container.appendChild(line);

  return val;
}
// ---------------------------------------------------------------------  
function appendRouteConfigurationMessage(container, label, type) {
  const line = document.createElement('div');
  line.className = 'dxlcoop-field-singleline';

  const name = document.createElement('span');
  name.className = 'dxlcoop-field-name-singleline';
  name.textContent = label + ': ';

  line.appendChild(name);

  if (type === 'apikey') {
    line.appendChild(
      document.createTextNode('Requires Google Routes API key configured in ')
    );

    const a = document.createElement('a');
    a.href = optionsUrl();
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Options';

    line.appendChild(a);

  } else if (type === 'address') {
    line.appendChild(
      document.createTextNode('Select a starting address')
    );
  }

  container.appendChild(line);
}
// ---------------------------------------------------------------------  
// ---------------------------------------------------------------------
function normalizeText(el) {
  if (!el)
    return '';

  /*
   * Work on a clone so we can convert HTML layout elements into
   * explicit newlines without modifying the actual document.
   */
  const clone = el.cloneNode(true);

  /*
   * Convert elements that represent line/block boundaries into
   * newlines before extracting text.
   */
  for (const br of clone.querySelectorAll('br'))
    br.replaceWith('\n');

  for (const block of clone.querySelectorAll('p, div')) {
    block.before('\n');
    block.after('\n');
  }

  return (clone.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
// ---------------------------------------------------------------------
function normalizePositionAddress(value) {
  const seen = new Set();
  const lines = [];

  for (const line of String(value || '').split(/\r?\n/)) {
    const cleaned = line
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned)
      continue;

    /*
     * Case-insensitive uniqueness while preserving the original
     * occurrence and order.
     */
    const key = cleaned.toLowerCase();

    if (seen.has(key))
      continue;

    seen.add(key);
    lines.push(cleaned);
  }

  return lines.join(' ');
}
// ---------------------------------------------------------------------
function normalizeFieldValue(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
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
// ---------------------------------------------------------------------
function addEmployerToJobTitle(job) {
  if (!job.data)
    return;

  let employer = job.data['Employer']?.trim();

  if (!employer)
    return;

  /*
   * Remove trailing employer number:
   *
   *   University of Penn School of Medicine (23236)
   *
   * becomes:
   *
   *   University of Penn School of Medicine
   */
  employer = employer
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();

  if (!employer)
    return;

  /*
   * Avoid inserting the employer more than once.
   */
  if (job.link.previousElementSibling?.classList.contains(
    'dxlcoop-employer'
  ))
    return;

  const span = document.createElement('span');
  span.className = 'dxlcoop-employer';
  span.textContent = employer + ': ';

  job.link.before(span);
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
 * "field: value" entries.
 */
if (!labelText.trim().endsWith(':'))
  continue;

if (label === 'Position Address')
  value = normalizePositionAddress(value);
else
  value = normalizeFieldValue(value);

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
    if (job.data) {
      addEmployerToJobTitle(job);
      return job.data;
    }
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
      addEmployerToJobTitle(job);
      return job.data;
    }

    // Next check the persistent local cache.
    const storageKey = localCacheKey(job.link.href);
    const saved = await storageGet(storageKey);

    if (saved[storageKey]) {
      job.data = saved[storageKey];

      // Also populate the faster in-memory cache.
      cache.set(cacheKey, Promise.resolve(job.data));

      addEmployerToJobTitle(job);

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
      addEmployerToJobTitle(job);
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

  /*
   * The jobs array may have been rebuilt, for example after loading
   * additional search-result pages. Reuse an existing details element
   * rather than creating a duplicate.
   */
  const existing = job.link.nextElementSibling;

  if (existing?.classList.contains('dxlcoop-details')) {
    job.details = existing;
    return existing;
  }

  const div = document.createElement('div');
  div.className = 'dxlcoop-details';

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
      renderFieldValue(value, job.data, field);

      block.append(name, value);
      div.appendChild(block);
    }

if (state.distance || state.time) {
  const destination = job.data['Position Address']?.trim();
  const origins = selectedStartingAddresses();

  if (!googleRoutesApiKey) {
    if (state.time)
      appendRouteConfigurationMessage(
        div, 'Time', 'apikey'
      );

    if (state.distance)
      appendRouteConfigurationMessage(
        div, 'Distance', 'apikey'
      );

  } else if (!origins.length) {
    if (state.time)
      appendRouteConfigurationMessage(
        div, 'Time', 'address'
      );

    if (state.distance)
      appendRouteConfigurationMessage(
        div, 'Distance', 'address'
      );

  } else if (!destination) {
    if (state.time)
      appendSingleLineField(
        div, 'Time', 'Position address not available'
      );

    if (state.distance)
      appendSingleLineField(
        div, 'Distance', 'Position address not available'
      );

  } else {

    
if (state.time) {
  const bestTime = minimumDrivingTime(job);

  for (const item of job.routes || []) {
    const seconds =
      routeDurationSeconds(item.route?.duration);

    const href = item.route
      ? googleMapsRouteUrl(
          item.address,
          destination,
          item.name.startsWith('transit:')
            ? 'transit'
            : 'drive'
        )
      : '';

    appendSingleLineField(
      div,
      `Time (${item.name})`,
      item.route
        ? formatDrivingTime(item.route.duration)
        : 'Not available',
      href,
      seconds != null && seconds === bestTime
    );
  }
}

if (state.distance) {
  const bestDistance = minimumDrivingDistance(job);

  for (const item of job.routes || []) {
    const meters = item.route?.distanceMeters ?? null;

    const href = item.route
      ? googleMapsRouteUrl(
          item.address,
          destination,
          item.name.startsWith('transit:')
            ? 'transit'
            : 'drive'
        )
      : '';

    appendSingleLineField(
      div,
      `Distance (${item.name})`,
      item.route
        ? formatDrivingDistance(item.route.distanceMeters)
        : 'Not available',
      href,
      meters != null && meters === bestDistance
    );
  }
}


  }
}

if (!count && !state.distance && !state.time)
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

    if (state.distance || state.time) {
  try {
    await updateDrivingData();
  } catch (e) {
    console.error('dxlcoop: Routes API error', e);
  }

  if (state.showDetails)
    renderAll();
}

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

  const constraints = [];

  /*
   * Extract distance/time constraints before parsing the remaining
   * text query.
   *
   * Examples:
   *   distance<20
   *   distance<=20.5
   *   distance>5
   *   time<=45
   *
   * Distance is in miles; time is in minutes.
   */
  query = query.replace(
    /\b(distance|time)\s*(<=|>=|<|>)\s*(\d+(?:\.\d+)?)\b/gi,
    (match, type, operator, value) => {
      constraints.push({
        type: type.toLowerCase(),
        operator,
        value: Number(value)
      });

      return ' ';
    }
  );

  /*
   * Removing a constraint can leave a dangling AND/OR:
   *
   *   python AND distance<20
   *
   * becomes:
   *
   *   python AND
   *
   * Remove operators at the beginning/end.
   */
  query = query
    .replace(/^\s*(?:AND|OR)\b\s*/i, '')
    .replace(/\s*\b(?:AND|OR)\s*$/i, '')
    .trim();

  if (!query)
    return {
      terms: [],
      operator: 'AND',
      constraints
    };

  const hasAND = /\bAND\b/i.test(query);
  const hasOR  = /\bOR\b/i.test(query);

  let operator;
  let terms;

  if (hasOR && !hasAND) {
    operator = 'OR';
    terms = query.split(/\s+OR\s+/i);
  } else {
    operator = 'AND';
    terms = query.split(/\s+(?:AND|OR)\s+|\s+/i);
  }

  terms = terms
    .map(term => term.trim())
    .filter(Boolean);

  return {
    terms,
    operator,
    constraints
  };
}

// ---------------------------------------------------------------------
function compareConstraint(actual, operator, expected) {
  switch (operator) {
    case '<':  return actual < expected;
    case '<=': return actual <= expected;
    case '>':  return actual > expected;
    case '>=': return actual >= expected;
    default:   return true;
  }
}

// ---------------------------------------------------------------------
function matchesRouteConstraints(job, constraints) {
  if (!constraints.length)
    return true;

  for (const constraint of constraints) {
    let actual = null;

    if (constraint.type === 'distance') {
      const meters = minimumDrivingDistance(job);

      if (meters != null)
        actual = meters / 1609.344;

    } else if (constraint.type === 'time') {
      const seconds = minimumDrivingTime(job);

      if (seconds != null)
        actual = seconds / 60;
    }

    /*
     * No route information available for this job:
     * ignore the constraint.
     */
    if (actual == null)
      continue;

    if (!compareConstraint(
      actual,
      constraint.operator,
      constraint.value
    ))
      return false;
  }

  return true;
}

// ---------------------------------------------------------------------
function updateFilterCount(matchCount, filterActive) {
  const rows = [...table.rows]
    .filter(row => isRecordCountRow(row));

  for (const row of rows) {
    const div = row.querySelector('.centeraligntext');

    if (!div)
      continue;

    /*
     * Remove a previously appended filter count.
     */
    let text = div.textContent
      .replace(/\s*\(\d+\s+match(?:es)?\s+filter\)\s*$/i, '')
      .trim();

    if (filterActive) {
      text += ` (${matchCount} ${
        matchCount === 1 ? 'matches' : 'match'
      } filter)`;
    }

    div.textContent = text;
  }
}

  // ---------------------------------------------------------------------
function applySearch() {
  const searchInput = document.getElementById('dxlcoop-search');

  if (!searchInput)
    return;

    const searchText = searchInput.value.trim();
    const query = parseSearchQuery(searchText);
  let matchCount = 0;
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
    * Distance/time constraints are always additional constraints
    * on the text query.
    */
    found = found && matchesRouteConstraints(job, query.constraints);

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

      if (found) matchCount++;

      for (const row of job.rows)
        row.style.display = hide ? 'none' : '';
    }
    updateFilterCount(matchCount, searchText !== '');
  }
  // ---------------------------------------------------------------------  
  async function init() {
    const saved = await storageGet([pageKey, 'startingAddresses','googleRoutesApiKey','ratings']);

    if (saved[pageKey] && typeof saved[pageKey] === 'object')
      state = { ...defaults, ...saved[pageKey] };

    startingAddresses = Array.isArray(saved.startingAddresses) ? saved.startingAddresses : [];
    googleRoutesApiKey =  saved.googleRoutesApiKey?.trim() || '';  
    ratings = saved.ratings && typeof saved.ratings === 'object' ? saved.ratings : {};

jobs = findJobs();
createOptions();
renderAllRatings();

/*
 * Load job data so employer names can always be added to job titles.
 * fetchJob() normally retrieves this from the local cache.
 */
await Promise.all(jobs.map(async job => {
  try {
    await fetchJob(job);
  } catch (e) {
    console.error(
      'dxlcoop: unable to load employer for',
      job.link.href,
      e
    );
  }
}));

  if (state.sortBy) await updateDrivingData(true);
  if (state.sortBy || state.sortByRating) sortJobs();

if (state.showDetails)
  await showAll();

  }

// ---------------------------------------------------------------------
function allStartingAddresses() {
  const result = [];

  for (const mode of ['drive', 'transit']) {
    for (const item of startingAddresses) {
      const name = item?.name?.trim();
      const address = item?.address?.trim();

      if (!name || !address)
        continue;

      result.push({
        name: `${mode}:${name}`,
        mode,
        address,
        routeOrigin: `${mode}:${address}`
      });
    }
  }

  return result;
}
// ---------------------------------------------------------------------
function createRatingStars(job) {
  const nobr = document.createElement('nobr');
  nobr.className = 'dxlcoop-rating';

  const rating = jobRating(job);

  for (let i = 1; i <= 5; i++) {
    const img = document.createElement('img');

    img.src = chrome.runtime.getURL('star.png');
    img.className = 'dxlcoop-rating-star';

    if (i > rating)
      img.classList.add('dxlcoop-rating-star-faded');

    img.alt = `${i} star${i === 1 ? '' : 's'}`;
    img.title = rating === i
      ? `Remove ${i}-star rating`
      : `Rate ${i} stars`;

    img.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      /*
       * Clicking the current rating unsets it.
       */
      await setJobRating(
        job,
        jobRating(job) === i ? 0 : i
      );
    });

    nobr.appendChild(img);
  }

  return nobr;
}


// ---------------------------------------------------------------------
function jobRating(job) {
  return Number(ratings[job.ratingKey]) || 0;
}

// ---------------------------------------------------------------------
async function setJobRating(job, rating) {
  if (rating)
    ratings[job.ratingKey] = rating;
  else
    delete ratings[job.ratingKey];

  job.rating = rating;

  await storageSet({ ratings });

  renderJobRating(job);

  /*
   * Deliberately do NOT call sortJobs().
   * Rating changes should not make the job jump around.
   */
}
// ---------------------------------------------------------------------
function ratingCell(job) {
  const row = job.link.closest('tr');

  if (!row)
    return null;

  const columnIndex =
    pageKey === 'cart' ? 0 : 1;

  return row.cells[columnIndex] || null;
}

// ---------------------------------------------------------------------
function renderJobRating(job) {
  /*
   * Remove an existing rating widget first.
   */
  for (const existing of job.rows[0]?.querySelectorAll(
    '.dxlcoop-rating'
  ) || [])
    existing.remove();

  if (!state.showRatings)
    return;

  const cell = ratingCell(job);

  if (!cell)
    return;

  const stars = createRatingStars(job);

  /*
   * Rating appears at the beginning of the requested cell.
   */
  cell.insertBefore(stars, cell.firstChild);
  cell.insertBefore(
    document.createTextNode(' '),
    stars.nextSibling
  );
}

// ---------------------------------------------------------------------
function renderAllRatings() {
  for (const job of jobs)
    renderJobRating(job);
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


//const downloadOrigins = selectedStartingAddresses();
const downloadOrigins = allStartingAddresses();

const results = await Promise.all(downloadJobs.map(async job => {
  try {
    const data = {
      ...await fetchJob(job)
    };

    const destination =
      data['Position Address']?.trim();

    const routes = [];

    if (destination) {
      for (const origin of downloadOrigins) {
        const route = await GoogleRoutes.getCached(
          origin.routeOrigin,
          destination
        );
        routes.push({
          name: origin.name,
          route
        });

        data[`Distance (${origin.name})`] =
          route?.distanceMeters != null
            ? formatDrivingDistance(route.distanceMeters)
            : '';

        data[`Time (${origin.name})`] =
          route?.duration
            ? formatDrivingTime(route.duration)
            : '';
      }
    }

    const distances = routes
      .map(item => item.route?.distanceMeters)
      .filter(value => value != null);

    const times = routes
      .map(item => routeDurationSeconds(item.route?.duration))
      .filter(value => value != null);

    data['Distance'] = distances.length
      ? formatDrivingDistance(Math.min(...distances))
      : '';

    data['Time'] = times.length
      ? formatDrivingTime(Math.min(...times) + 's')
      : '';

    return data;

  } catch (e) {
    console.error(
      'dxlcoop: unable to download job',
      job.link.href,
      e
    );

    return {
      'Job Number': jobCacheKey(job.link.href) || '',
      'URL': job.link.href,
      'Distance': '',
      'Time': '',
      'Download Error': e.message
    };
  }
}));


      const preferred = [
        'Employer',
        'Job Title',
        'URL',
        'Time',

...downloadOrigins.map(origin =>
  `Time (${origin.name})`
),
        'Distance',
...downloadOrigins.map(origin =>
  `Distance (${origin.name})`
),
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