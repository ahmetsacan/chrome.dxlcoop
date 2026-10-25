'use strict';

const API_KEY_STORAGE_KEY = 'googleRoutesApiKey';
const ADDRESSES_STORAGE_KEY = 'startingAddresses';
const ROUTE_CACHE_PREFIX = 'dxlcoop.routecache:';

function storageRemove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

async function clearDrivingCache() {
  await GoogleRoutes.clearCache();
  showStatus('Saved driving distances & times cleared');
}

document.getElementById('clearDrivingCache').addEventListener('click', clearDrivingCache);


let saveStatusTimer = null;

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, resolve));
}

// ---------------------------------------------------------------------
function showStatus(message) {
  const status = document.getElementById('status');

  status.textContent = message;
  status.classList.add('visible');

  if (saveStatusTimer)
    clearTimeout(saveStatusTimer);

  saveStatusTimer = setTimeout(() => {
    status.classList.remove('visible');
  }, 1500);
}

// ---------------------------------------------------------------------
function getAddresses() {
  return [...document.querySelectorAll('#addresses tbody tr')].map(row => ({
    name: row.querySelector('.address-name').value.trim(),
    address: row.querySelector('.address-value').value.trim()
  }));
}

// ---------------------------------------------------------------------
async function saveOptions() {
  const apiKey =
    document.getElementById('googleRoutesApiKey').value.trim();

  const addresses = getAddresses();

  await storageSet({
    [API_KEY_STORAGE_KEY]: apiKey,
    [ADDRESSES_STORAGE_KEY]: addresses
  });

  showStatus('Saved');
}

// ---------------------------------------------------------------------
function addAddressRow(name = '', address = '') {
  const tbody = document.querySelector('#addresses tbody');

  const row = document.createElement('tr');

  const nameCell = document.createElement('td');
  const addressCell = document.createElement('td');
  const removeCell = document.createElement('td');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'address-name';
  nameInput.value = name;

  const addressInput = document.createElement('input');
  addressInput.type = 'text';
  addressInput.className = 'address-value';
  addressInput.value = address;
  addressInput.autocomplete = 'street-address';

  nameInput.addEventListener('change', saveOptions);
  addressInput.addEventListener('change', saveOptions);

  nameCell.appendChild(nameInput);
  addressCell.appendChild(addressInput);

  row.append(nameCell, addressCell, removeCell);
  tbody.appendChild(row);

  // The first address cannot be removed.
  if (tbody.children.length > 1) {
    const removeLink = document.createElement('a');
    removeLink.href = '#';
    removeLink.className = 'remove-address';
    removeLink.textContent = 'Remove';

    removeLink.addEventListener('click', async event => {
      event.preventDefault();
      row.remove();
      await saveOptions();
    });

    removeCell.appendChild(removeLink);
  }
}
// ---------------------------------------------------------------------
function nextAddressName() {
  const count = document.querySelectorAll('#addresses tbody tr').length;

  return count === 0 ? 'Home' : `Address${count + 1}`;
}

// ---------------------------------------------------------------------
async function addNewAddress(event) {
  event.preventDefault();

  addAddressRow(nextAddressName(), '');

  await saveOptions();

  const inputs = document.querySelectorAll('.address-value');
  inputs[inputs.length - 1].focus();
}

// ---------------------------------------------------------------------
async function loadOptions() {
  const saved = await storageGet([
    API_KEY_STORAGE_KEY,
    ADDRESSES_STORAGE_KEY
  ]);

  document.getElementById('googleRoutesApiKey').value =
    saved[API_KEY_STORAGE_KEY] || '';

  let addresses = saved[ADDRESSES_STORAGE_KEY];

  if (!Array.isArray(addresses) || !addresses.length)
    addresses = [{ name: 'Home', address: '' }];

  for (const item of addresses)
    addAddressRow(item.name || '', item.address || '');
}

// ---------------------------------------------------------------------
function toggleApiKey() {
  const input = document.getElementById('googleRoutesApiKey');
  const button = document.getElementById('showApiKey');

  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = 'Hide';
  } else {
    input.type = 'password';
    button.textContent = 'Show';
  }
}

document.getElementById('googleRoutesApiKey')
  .addEventListener('change', saveOptions);

document.getElementById('showApiKey')
  .addEventListener('click', toggleApiKey);

document.getElementById('addAddress')
  .addEventListener('click', addNewAddress);

loadOptions();