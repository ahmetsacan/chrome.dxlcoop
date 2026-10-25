/*
 * Google Routes API helper
 *
 * Provides cached driving distance/time calculations using
 * Google Routes API Compute Route Matrix.
 * 
 * Copyright (c) 2026 Ahmet Sacan.
 * All rights reserved.
 */

'use strict';

globalThis.GoogleRoutes = (() => {
  const API_URL =
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

  const CACHE_PREFIX = 'googleroutes.routecache:';

  const memoryCache = new Map();

  // ---------------------------------------------------------------------
  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }

  // ---------------------------------------------------------------------
  function storageSet(value) {
    return new Promise(resolve => chrome.storage.local.set(value, resolve));
  }

  // ---------------------------------------------------------------------
  function storageRemove(keys) {
    return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  }

  // ---------------------------------------------------------------------
  function normalizeAddress(address) {
    return String(address || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

// ---------------------------------------------------------------------
function parseOrigin(origin) {
  origin = String(origin || '').trim();

  const m = origin.match(/^(drive|transit):(.*)$/i);

  if (m) {
    return {
      travelMode: m[1].toUpperCase(),
      address: m[2].trim()
    };
  }

  return {
    travelMode: 'DRIVE',
    address: origin
  };
}

  // ---------------------------------------------------------------------
// ---------------------------------------------------------------------
function cacheKey(origin, destination) {
  const parsed = parseOrigin(origin);

  return parsed.travelMode.toLowerCase() + ':' +
    normalizeAddress(parsed.address) + ' -> ' +
    normalizeAddress(destination);
}
  // ---------------------------------------------------------------------
  function storageCacheKey(origin, destination) {
    return CACHE_PREFIX + cacheKey(origin, destination);
  }

  // ---------------------------------------------------------------------
  async function getCached(origin, destination) {
    const key = cacheKey(origin, destination);

    if (memoryCache.has(key))
      return memoryCache.get(key);

    const storageKey = storageCacheKey(origin, destination);
    const saved = await storageGet(storageKey);

    if (saved[storageKey]) {
      memoryCache.set(key, saved[storageKey]);
      return saved[storageKey];
    }

    return null;
  }

  // ---------------------------------------------------------------------
  async function setCached(origin, destination, value) {
    const key = cacheKey(origin, destination);
    const storageKey = storageCacheKey(origin, destination);

    memoryCache.set(key, value);

    await storageSet({
      [storageKey]: value
    });
  }

  // ---------------------------------------------------------------------
  async function clearCache() {
    memoryCache.clear();

    const all = await storageGet(null);

    const keys = Object.keys(all)
      .filter(key => key.startsWith(CACHE_PREFIX));

    if (keys.length)
      await storageRemove(keys);
  }

  // ---------------------------------------------------------------------
  function uniqueOrigins(addresses) {
    const result = [];
    const seen = new Set();

    for (const address of addresses || []) {
      const value = String(address || '').trim();

      if (!value)
        continue;

      const normalized = normalizeAddress(value);

      if (seen.has(normalized))
        continue;

      seen.add(normalized);
      result.push(value);
    }

    return result;
  }

 // ---------------------------------------------------------------------
function nextMonday9am() {
  const now = new Date();
  const result = new Date(now);

  /*
   * JS day numbers:
   * Sunday = 0, Monday = 1, ..., Saturday = 6
   *
   * "Next Monday" means the next occurrence of Monday.
   * If today is Monday, use the following Monday.
   */
  let days = (8 - now.getDay()) % 7;

  if (days === 0)
    days = 7;

  result.setDate(now.getDate() + days);
  result.setHours(9, 0, 0, 0);

  return result;
} 


  // ---------------------------------------------------------------------
async function fetchBatch(apiKey, origins, destinations, travelMode = 'DRIVE') {
  //console.log('GoogleRoutes.fetchBatch origins:', origins);
  //console.log('GoogleRoutes.fetchBatch destinations:', destinations);

const body = {
  origins: origins.map(origin => ({
    waypoint: {
      address: parseOrigin(origin).address
    }
  })),

  destinations: destinations.map(address => ({
    waypoint: { address }
  })),

  travelMode
};

if (travelMode === 'TRANSIT')
  body.arrivalTime = nextMonday9am().toISOString();

  //console.log('GoogleRoutes request:', body);

  const response = await fetch(API_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'originIndex,destinationIndex,distanceMeters,duration,status,condition'
    },

    body: JSON.stringify(body)
  });

  //console.log('GoogleRoutes response:', response.status,response.statusText);

  if (!response.ok) {
    const text = await response.text();
    console.error('GoogleRoutes error response:', text);

    throw new Error(
      `Google Routes API HTTP ${response.status}: ${text}`
    );
  }

  const elements = await response.json();

  //console.log('GoogleRoutes elements:', elements);

  for (const element of elements) {
    const origin = origins[element.originIndex];
    const destination = destinations[element.destinationIndex];

    //console.log('GoogleRoutes element:',element.originIndex,element.destinationIndex,origin,destination,element);

    if (!origin || !destination) {
      console.warn(
        'GoogleRoutes: unable to map matrix element to addresses',
        element
      );
      continue;
    }

    const value = {
      distanceMeters: element.distanceMeters ?? null,
      duration: element.duration ?? null,
      condition: element.condition || '',
      status: element.status || {}
    };

    //console.log('GoogleRoutes caching:',      origin,'->',destination,value);

    await setCached(origin, destination, value);
  }
}
  // ---------------------------------------------------------------------
  async function fetchGroup(apiKey, origins, destinations,travelMode='DRIVE') {
    /*
     * Google allows up to 50 address/place-ID waypoints total and
     * 625 route-matrix elements for ordinary DRIVE requests.
     */
    const MAX_WAYPOINTS = 50;
    const MAX_ELEMENTS = travelMode === 'TRANSIT' ? 100 : 625;

    for (let oi = 0; oi < origins.length;) {
      /*
       * Starting with at most 25 origins guarantees room for at
       * least 25 destinations under the waypoint limit.
       */
      const originCount = Math.min(
        origins.length - oi,
        25
      );

      const originBatch =
        origins.slice(oi, oi + originCount);

      const maxDestinations = Math.min(
        MAX_WAYPOINTS - originBatch.length,
        Math.floor(MAX_ELEMENTS / originBatch.length)
      );

      if (maxDestinations < 1)
        throw new Error('Unable to construct Routes API matrix batch');

      for (
        let di = 0;
        di < destinations.length;
        di += maxDestinations
      ) {
        const destinationBatch =
          destinations.slice(di, di + maxDestinations);

        await fetchBatch(
          apiKey,
          originBatch,
          destinationBatch,
            travelMode
        );
      }

      oi += originBatch.length;
    }
  }

  // ---------------------------------------------------------------------
  async function computeRouteMatrix(apiKey, startingAddresses, destinations,  onStartFetching = null) {
    apiKey = String(apiKey || '').trim();

    if (!apiKey)
      throw new Error('Google Routes API key is not configured');

    const origins = uniqueOrigins(startingAddresses);
    destinations = uniqueOrigins(destinations);

    if (!origins.length || !destinations.length)
      return {};

    /*
     * Determine exactly which pairs are absent from the cache.
     */
    const missingByOrigin = [];

    for (const origin of origins) {
      const missing = [];

      for (const destination of destinations) {
        if (!await getCached(origin, destination))
          missing.push(destination);
      }

      if (missing.length) {
        missingByOrigin.push({
          origin,
          destinations: missing
        });
      }
    }

    /*
     * Origins having the same set of missing destinations can be
     * combined into one matrix request without requesting cached pairs.
     */
    const groups = new Map();

    for (const item of missingByOrigin) {
const travelMode =
  parseOrigin(item.origin).travelMode;

const groupKey = JSON.stringify([
  travelMode,
  item.destinations.map(normalizeAddress)
]);

if (!groups.has(groupKey)) {
  groups.set(groupKey, {
    travelMode,
    origins: [],
    destinations: item.destinations
  });
}

      groups.get(groupKey).origins.push(item.origin);
    }

    if (groups.size && typeof onStartFetching === 'function') onStartFetching();

    for (const group of groups.values()) {
      await fetchGroup(
        apiKey,
        group.origins,
        group.destinations,
        group.travelMode
      );
    }

    /*
     * Return all requested results, including those that were already
     * cached before this call.
     *
     * result[origin][destination]
     */
    const result = {};

    for (const origin of origins) {
      result[origin] = {};

      for (const destination of destinations) {
        result[origin][destination] =
          await getCached(origin, destination);
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------
  return {
    computeRouteMatrix,
    getCached,
    clearCache
  };
})();
