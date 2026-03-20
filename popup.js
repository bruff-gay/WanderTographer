// ============================================
// WANDERTOGRAPHER - popup.js
// ============================================

const CONFIG_KEYS = ['platform', 'token', 'owner', 'repo', 'path', 'branch'];

const APIS = {
  github: {
    baseUrl: 'https://api.github.com',
    headers: function(token) {
      return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      };
    }
  },
  codeberg: {
    baseUrl: 'https://codeberg.org/api/v1',
    headers: function(token) {
      return {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      };
    }
  }
};

function toBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString);
}

function fromBase64(str) {
  const binaryString = atob(str);
  const utf8Bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  return new TextDecoder().decode(utf8Bytes);
}

async function getCurrentUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.url : null;
  } catch (e) {
    console.error('Failed to get current URL:', e);
    return null;
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'status-error' : 'status-success';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function apiRequest(method, url, token, platform, body) {
  const config = APIS[platform];
  if (!config) throw new Error(`Unknown platform: ${platform}`);

  const options = { method, headers: config.headers(token) };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${errorText}`);
  }
  return response.json();
}

// ============================================
// PARSE JAVASCRIPT OBJECT (not JSON)
// ============================================

function parseJsObject(jsCode) {
  // Convert JavaScript object literal to valid JSON
  let jsonLike = jsCode
    // Replace unquoted property names with quoted ones
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Replace single quotes with double quotes
    .replace(/'/g, '"')
    // Remove trailing commas before ] or }
    .replace(/,\s*([\]\}])/g, '$1');

  return JSON.parse(jsonLike);
}

// ============================================
// MAIN LOGIC
// ============================================

async function addUrl(targetKey) {
  const settings = {};
  const idMap = { 'token': 'accessToken', 'path': 'filePath' };

  for (const key of CONFIG_KEYS) {
    const id = idMap[key] || key;
    const element = document.getElementById(id);
    settings[key] = element ? element.value.trim() : '';
  }

  if (!settings.token) {
    showStatus('Error: Please enter an Access Token.', 'error');
    return;
  }

  if (!APIS[settings.platform]) {
    showStatus('Error: Invalid platform selected.', 'error');
    return;
  }

  try {
    showStatus('Fetching file...', 'success');

    const currentUrl = await getCurrentUrl();
    if (!currentUrl) throw new Error('Could not get current tab URL.');

    const apiBase = APIS[settings.platform].baseUrl;
    const fileApiUrl = `${apiBase}/repos/${settings.owner}/${settings.repo}/contents/${settings.path}?ref=${settings.branch}`;

    const fileData = await apiRequest('GET', fileApiUrl, settings.token, settings.platform);
    if (!fileData.content) throw new Error('Empty file content received.');

    const jsContent = fromBase64(fileData.content);
    console.log('Raw content preview:', jsContent.substring(0, 300));

    // Extract window.wander = { ... };
    const wanderMatch = jsContent.match(/window\.wander\s*=\s*(\{[\s\S]*?\})\s*;?\s*$/);
    if (!wanderMatch) {
      console.error('Full content:', jsContent);
      throw new Error('Could not find window.wander object in file.');
    }

    // Parse using custom function that handles JS object syntax
    let wanderObj;
    try {
      wanderObj = parseJsObject(wanderMatch[1]);
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
      console.error('Attempted to parse:', wanderMatch[1].substring(0, 300));
      throw new Error('Failed to parse window.wander object: ' + parseErr.message);
    }

    // Ensure target array exists
    if (!Array.isArray(wanderObj[targetKey])) {
      wanderObj[targetKey] = [];
    }

    // Check for duplicates
    const normalizedCurrent = currentUrl.replace(/\/$/, '');
    const exists = wanderObj[targetKey].some(url => {
      const normalized = (url || '').replace(/\/$/, '');
      return normalized === normalizedCurrent;
    });

    if (exists) {
      showStatus(`URL already exists in ${targetKey}.`, 'error');
      return;
    }

    // Add URL
    wanderObj[targetKey].push(currentUrl);

    // Reconstruct file preserving original style (single quotes for pages, double for consoles)
    const consolesStr = (wanderObj.consoles || []).map(url => `"${url}"`).join(', ');
    const pagesStr = (wanderObj.pages || []).map(url => `'${url}'`).join(', ');

    const updatedJsContent = `window.wander = { consoles: [ ${consolesStr} ], pages: [ ${pagesStr} ], }`;

    showStatus('Updating file...', 'success');

    const updateBody = {
      message: `Update wander.js via WanderTographer (Add to ${targetKey})`,
      content: toBase64(updatedJsContent),
      sha: fileData.sha,
      branch: settings.branch
    };

    await apiRequest('PUT', fileApiUrl, settings.token, settings.platform, updateBody);

    showStatus(`Success! Added to ${targetKey}.`, 'success');

  } catch (error) {
    console.error('WanderTographer error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

function loadSettings() {
  chrome.storage.local.get(CONFIG_KEYS, (result) => {
    const idMap = { 'token': 'accessToken', 'path': 'filePath' };
    for (const key of CONFIG_KEYS) {
      const id = idMap[key] || key;
      const element = document.getElementById(id);
      if (element && result[key]) element.value = result[key];
    }
  });
}

function saveSettings() {
  const data = {};
  const idMap = { 'token': 'accessToken', 'path': 'filePath' };
  for (const key of CONFIG_KEYS) {
    const id = idMap[key] || key;
    const element = document.getElementById(id);
    data[key] = element ? element.value.trim() : '';
  }
  chrome.storage.local.set(data, () => showStatus('Configuration saved.', 'success'));
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  const saveBtn = document.getElementById('saveBtn');
  const addPagesBtn = document.getElementById('addPagesBtn');
  const addConsolesBtn = document.getElementById('addConsolesBtn');

  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (addPagesBtn) addPagesBtn.addEventListener('click', () => addUrl('pages'));
  if (addConsolesBtn) addConsolesBtn.addEventListener('click', () => addUrl('consoles'));
});

