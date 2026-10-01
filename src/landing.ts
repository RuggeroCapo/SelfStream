import { AVAILABLE_LANGUAGES, DEFAULT_CONFIG } from './config';

export function generateLandingPage(manifest: any, addonBase: string): string {
    const langOptions = AVAILABLE_LANGUAGES.map(l =>
        '<option value="' + l.code + '"' + (l.code === DEFAULT_CONFIG.vixLang ? ' selected' : '') + '>' + l.flag + ' ' + l.label + '</option>'
    ).join('\n');

    const addonBaseJson = JSON.stringify(addonBase);

    return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>' + manifest.name + ' - Installation</title>' +
'<link rel="icon" href="' + manifest.logo + '">' +
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet">' +
`<style>
:root{--primary:#8A5AAB;--primary-hover:#724191;--bg:#0f0f12;--glass:rgba(255,255,255,0.05);--glass-border:rgba(255,255,255,0.1);--text:#fff;--text-muted:rgba(255,255,255,0.7)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background-color:var(--bg);background-image:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.8)),url('https://i.imgur.com/uasXEWM.jpeg');background-size:cover;background-position:center;background-attachment:fixed;color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow-x:hidden}
.container{width:100%;max-width:520px;padding:40px 20px;animation:fadeIn .8s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.card{background:var(--glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--glass-border);border-radius:24px;padding:40px;text-align:center;box-shadow:0 8px 32px 0 rgba(0,0,0,.8)}
.logo{width:120px;height:120px;border-radius:20%;margin:0 auto 24px;display:block;box-shadow:0 4px 15px rgba(0,0,0,.3)}
h1{font-family:'Outfit',sans-serif;font-size:32px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#fff 0%,#aaa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.version{font-size:14px;color:var(--text-muted);background:var(--glass-border);padding:2px 10px;border-radius:12px;display:inline-block;margin-bottom:20px}
p.description{font-size:16px;color:var(--text-muted);line-height:1.6;margin-bottom:32px}
.button-group{display:flex;flex-direction:column;gap:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:14px;font-size:16px;font-weight:600;text-decoration:none;transition:all .3s ease;cursor:pointer;border:none;width:100%}
.btn-primary{background-color:var(--primary);color:#fff}
.btn-primary:hover{background-color:var(--primary-hover);transform:translateY(-2px);box-shadow:0 5px 15px rgba(138,90,171,.4)}
.btn-secondary{background-color:var(--glass-border);color:#fff}
.btn-secondary:hover{background-color:rgba(255,255,255,.15);transform:translateY(-2px)}
.custom-kofi-union{background:#FF5E5B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .2s;font-weight:600}
.custom-kofi-union:hover{transform:scale(1.02);background:#ff4d4a}
.custom-kofi-union img{height:24px}
.helper-text{font-size:13px;line-height:1.5;color:var(--text-muted);text-align:center}
.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(138,90,171,.9);color:#fff;padding:10px 24px;border-radius:50px;font-weight:500;transition:transform .3s ease-out;z-index:1000;backdrop-filter:blur(10px)}
.toast.show{transform:translateX(-50%) translateY(0)}
.config-section{margin-bottom:28px;text-align:left}
.config-section h2{font-family:'Outfit',sans-serif;font-size:18px;margin-bottom:16px;color:var(--text-muted);text-align:center}
.source-row{background:rgba(255,255,255,.04);border:1px solid var(--glass-border);border-radius:14px;padding:16px;margin-bottom:12px;transition:all .3s ease}
.source-row.disabled{opacity:.5}
.source-header{display:flex;align-items:center;justify-content:space-between}
.source-label{font-weight:600;font-size:15px;display:flex;align-items:center;gap:8px}
.source-badge{font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.1);color:var(--text-muted)}
.toggle{position:relative;width:48px;height:26px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,.15);border-radius:26px;transition:.3s}
.toggle-slider:before{content:"";position:absolute;height:20px;width:20px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
.toggle input:checked+.toggle-slider{background:var(--primary)}
.toggle input:checked+.toggle-slider:before{transform:translateX(22px)}
.source-options{margin-top:12px;overflow:hidden;max-height:0;transition:max-height .3s ease}
.source-row.enabled .source-options{max-height:80px}
.lang-select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-family:'Inter',sans-serif;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right 10px center;background-size:16px}
.lang-select option{background:#1a1a2e;color:#fff}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:1001}
.modal.open{opacity:1;pointer-events:auto}
.modal-card{width:100%;max-width:460px;background:#17171d;border:1px solid var(--glass-border);border-radius:22px;padding:24px;box-shadow:0 18px 40px rgba(0,0,0,.45);text-align:left}
.modal-header{margin-bottom:18px}
.modal-title{font-family:'Outfit',sans-serif;font-size:24px;margin-bottom:6px}
.modal-description{font-size:14px;line-height:1.6;color:var(--text-muted)}
.auth-switch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.switch-btn{padding:11px 14px;border-radius:12px;border:1px solid var(--glass-border);background:rgba(255,255,255,.04);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s ease}
.switch-btn.active{background:rgba(138,90,171,.2);border-color:rgba(138,90,171,.7)}
.field-stack{display:flex;flex-direction:column;gap:12px}
.field-group{display:flex;flex-direction:column;gap:8px}
.field-group.hidden{display:none}
.field-label{font-size:13px;font-weight:600;color:#fff}
.field-input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--glass-border);background:rgba(255,255,255,.06);color:#fff;font-size:14px;outline:none}
.field-input:focus{border-color:rgba(138,90,171,.75);box-shadow:0 0 0 3px rgba(138,90,171,.18)}
.modal-note{font-size:12px;line-height:1.5;color:var(--text-muted)}
.status-text{min-height:20px;font-size:13px;margin-top:14px}
.status-text.error{color:#ff9d9d}
.status-text.success{color:#9ae6b4}
.status-text.info{color:#c8b4ff}
.modal-actions{display:flex;gap:12px;margin-top:18px}
.modal-actions .btn{flex:1}
@media(max-width:480px){.card{padding:30px 20px}h1{font-size:28px}.modal-card{padding:20px}.modal-actions{flex-direction:column}}
</style>
</head>
<body>
<div class="container">
<div class="card">
` +
'<img src="' + manifest.logo + '" alt="Logo" class="logo">' +
'<h1>' + manifest.name + '</h1>' +
'<span class="version">v' + manifest.version + '</span>' +
'<p class="description">' + manifest.description + '</p>' +
`
<div class="config-section">
<h2>⚙️ Source Configuration</h2>

<div class="source-row enabled" id="vix-row">
    <div class="source-header">
        <span class="source-label">📺 ViX <span class="source-badge">Multi-language</span></span>
        <label class="toggle"><input type="checkbox" id="vixEnabled" checked onchange="toggleSource('vix')"><span class="toggle-slider"></span></label>
    </div>
    <div class="source-options">
        <select id="vixLang" class="lang-select">` + langOptions + `</select>
    </div>
</div>

<div class="source-row enabled" id="cinemacity-row">
    <div class="source-header">
        <span class="source-label">🎬 CinemaCity <span class="source-badge">Multi-language</span></span>
        <label class="toggle"><input type="checkbox" id="cinemacityEnabled" checked onchange="toggleSource('cinemacity')"><span class="toggle-slider"></span></label>
    </div>
    <div class="source-options">
        <select id="cinemacityLang" class="lang-select">` + langOptions + `</select>
    </div>
</div>

<div class="source-row disabled" id="animeunity-row">
    <div class="source-header">
        <span class="source-label">🇮🇹 AnimeUnity <span class="source-badge">Only Local and 🇮🇹 · Use Kitsu</span></span>
        <label class="toggle"><input type="checkbox" id="animeunityEnabled" onchange="toggleSource('animeunity')"><span class="toggle-slider"></span></label>
    </div>
</div>
</div>

<div class="button-group">
    <button class="btn btn-primary" id="account_install_button" type="button">Install via Account Sync</button>
    <a href="#" class="btn btn-secondary" id="install_button">Open in Stremio</a>
    <button class="btn btn-secondary" type="button" onclick="copyManifest()">Copy Manifest Link</button>
    <a href="https://ko-fi.com/G2G41MG3ZN" target="_blank" class="custom-kofi-union">
        <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-fi"><span>Buy us a beer 🍻</span>
    </a>
</div>
<p class="helper-text">Use Account Sync if Android TV gets stuck while installing the local HTTP addon. Sign in with the same Stremio account used on your TV.</p>
</div>
</div>

<div id="toast" class="toast">Link copied!</div>
<div id="account_sync_modal" class="modal" aria-hidden="true">
<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal_title">
    <div class="modal-header">
        <div class="modal-title" id="modal_title">Sync Addon To Your Stremio Account</div>
        <p class="modal-description">This pushes the current manifest URL into your synced addon collection. Your TV still needs network access to <strong>` + addonBase + `</strong>.</p>
    </div>

    <div class="auth-switch">
        <button class="switch-btn active" id="auth_key_mode" type="button" onclick="setAuthMode('key')">Auth Key</button>
        <button class="switch-btn" id="credentials_mode" type="button" onclick="setAuthMode('credentials')">Email & Password</button>
    </div>

    <div class="field-stack">
        <div id="auth_key_fields" class="field-group">
            <label class="field-label" for="stremio_auth_key">Stremio Auth Key</label>
            <input class="field-input" id="stremio_auth_key" type="password" autocomplete="off" placeholder="Paste your auth key">
            <p class="modal-note">You can get it from Stremio Web DevTools with <code>JSON.parse(localStorage.getItem('profile')).auth.key</code>.</p>
        </div>

        <div id="credentials_fields" class="field-group hidden">
            <label class="field-label" for="stremio_email">Stremio Email</label>
            <input class="field-input" id="stremio_email" type="email" autocomplete="username" placeholder="you@example.com">
            <label class="field-label" for="stremio_password">Stremio Password</label>
            <input class="field-input" id="stremio_password" type="password" autocomplete="current-password" placeholder="Password">
            <p class="modal-note">Credentials are sent directly from this page to the Stremio API and are not stored on this addon server.</p>
        </div>
    </div>

    <p id="install_status" class="status-text"></p>

    <div class="modal-actions">
        <button class="btn btn-secondary" id="close_modal_button" type="button" onclick="closeAccountSyncModal()">Cancel</button>
        <button class="btn btn-primary" id="submit_account_install" type="button" onclick="installViaAccountSync()">Sync Addon</button>
    </div>
</div>
</div>

<script>
var ADDON_BASE = ` + addonBaseJson + `;
var STREMIO_API_BASE = 'https://api.strem.io/api';
var AUTH_MODE = 'key';
var IS_SYNCING = false;

function getConfig(){
    return {
        vixEnabled: document.getElementById('vixEnabled').checked,
        vixLang: document.getElementById('vixLang').value,
        cinemacityEnabled: document.getElementById('cinemacityEnabled').checked,
        cinemacityLang: document.getElementById('cinemacityLang').value,
        animeunityEnabled: document.getElementById('animeunityEnabled').checked
    };
}

function encodeConfig(cfg){
    var s = JSON.stringify(cfg);
    return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');
}

function getManifestUrl(){
    return ADDON_BASE + '/' + encodeConfig(getConfig()) + '/manifest.json';
}

function toggleSource(name){
    var rowId = name + '-row';
    if(name==='vix') rowId = 'vix-row';
    var row = document.getElementById(rowId);
    var cbId = name + 'Enabled';
    if(name==='vix') cbId = 'vixEnabled';
    var cb = document.getElementById(cbId);
    if(cb.checked){ row.classList.remove('disabled'); row.classList.add('enabled'); }
    else { row.classList.remove('enabled'); row.classList.add('disabled'); }
}

function showToast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2000);
}

function setInstallStatus(msg, kind){
    var node = document.getElementById('install_status');
    node.textContent = msg || '';
    node.className = kind ? 'status-text ' + kind : 'status-text';
}

function setAuthMode(mode){
    AUTH_MODE = mode;
    document.getElementById('auth_key_mode').classList.toggle('active', mode === 'key');
    document.getElementById('credentials_mode').classList.toggle('active', mode === 'credentials');
    document.getElementById('auth_key_fields').classList.toggle('hidden', mode !== 'key');
    document.getElementById('credentials_fields').classList.toggle('hidden', mode !== 'credentials');
    setInstallStatus('', '');
}

function openAccountSyncModal(){
    document.getElementById('account_sync_modal').classList.add('open');
    document.getElementById('account_sync_modal').setAttribute('aria-hidden', 'false');
    setInstallStatus('', '');
    if(AUTH_MODE === 'key'){
        document.getElementById('stremio_auth_key').focus();
    } else {
        document.getElementById('stremio_email').focus();
    }
}

function closeAccountSyncModal(force){
    if(IS_SYNCING && !force) return;
    document.getElementById('account_sync_modal').classList.remove('open');
    document.getElementById('account_sync_modal').setAttribute('aria-hidden', 'true');
}

function setSyncState(syncing){
    IS_SYNCING = syncing;
    document.getElementById('submit_account_install').disabled = syncing;
    document.getElementById('close_modal_button').disabled = syncing;
    document.getElementById('auth_key_mode').disabled = syncing;
    document.getElementById('credentials_mode').disabled = syncing;
    document.getElementById('stremio_auth_key').disabled = syncing;
    document.getElementById('stremio_email').disabled = syncing;
    document.getElementById('stremio_password').disabled = syncing;
    document.getElementById('submit_account_install').textContent = syncing ? 'Syncing...' : 'Sync Addon';
}

function createApiError(apiError, fallbackMessage, response){
    var message = fallbackMessage || 'Request failed.';
    var code;

    if(typeof apiError === 'string' && apiError.trim()){
        message = apiError;
    } else if(apiError && typeof apiError === 'object'){
        if(typeof apiError.message === 'string' && apiError.message.trim()){
            message = apiError.message;
        }
        if(typeof apiError.code !== 'undefined'){
            code = apiError.code;
        }
    }

    var error = new Error(message);
    if(typeof code !== 'undefined'){
        error.code = code;
    }
    if(response){
        error.status = response.status;
        error.statusText = response.statusText;
    }
    return error;
}

function getInstallErrorMessage(err){
    var message = err && err.message ? err.message : 'Failed to sync addon.';

    if(message === 'Session does not exist'){
        return AUTH_MODE === 'credentials'
            ? 'Stremio rejected the new session. Try signing in again.'
            : 'This Stremio auth key is no longer valid. Generate a fresh auth key and try again.';
    }

    return message;
}

async function fetchJson(url, options){
    var response = await fetch(url, options);
    var text = await response.text();
    var data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (err) {
        throw new Error('Unexpected response from ' + url);
    }
    if(!response.ok){
        throw createApiError(data && data.error, 'Request failed for ' + url, response);
    }
    if(data && data.error){
        throw createApiError(data.error, 'Request failed for ' + url, response);
    }
    return data;
}

async function getAuthKey(){
    if(AUTH_MODE === 'key'){
        var authKey = document.getElementById('stremio_auth_key').value.trim();
        if(!authKey) throw new Error('Enter your Stremio auth key.');
        return authKey;
    }

    var email = document.getElementById('stremio_email').value.trim();
    var password = document.getElementById('stremio_password').value;
    if(!email || !password){
        throw new Error('Enter your Stremio email and password.');
    }

    var loginData = await fetchJson(STREMIO_API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'Login',
            email: email,
            password: password
        })
    });

    if(!loginData.result || !loginData.result.authKey){
        throw new Error('Stremio did not return an auth key.');
    }

    return loginData.result.authKey;
}

function buildUpdatedAddonCollection(existingAddons, newAddon){
    var manifestId = newAddon.manifest && newAddon.manifest.id;
    var replaced = false;
    var updated = [];

    (existingAddons || []).forEach(function(addon){
        var addonId = addon && addon.manifest && addon.manifest.id;
        var sameAddon = addon && (addon.transportUrl === newAddon.transportUrl || (manifestId && addonId === manifestId));
        if(sameAddon){
            if(!replaced){
                updated.push(newAddon);
                replaced = true;
            }
            return;
        }
        updated.push(addon);
    });

    if(!replaced){
        updated.push(newAddon);
    }

    return updated;
}

async function installViaAccountSync(){
    if(IS_SYNCING) return;

    setSyncState(true);
    setInstallStatus('Contacting Stremio and pushing the configured manifest...', 'info');

    try {
        var manifestUrl = getManifestUrl();
        var manifestData = await fetchJson(manifestUrl);
        var authKey = await getAuthKey();
        var collectionData = await fetchJson(STREMIO_API_BASE + '/addonCollectionGet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'AddonCollectionGet',
                authKey: authKey,
                update: true
            })
        });

        var newAddon = {
            transportUrl: manifestUrl,
            transportName: '',
            manifest: manifestData,
            flags: {
                official: false,
                protected: false
            }
        };

        var updatedAddons = buildUpdatedAddonCollection(collectionData.result && collectionData.result.addons, newAddon);
        await fetchJson(STREMIO_API_BASE + '/addonCollectionSet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'AddonCollectionSet',
                authKey: authKey,
                addons: updatedAddons
            })
        });

        setInstallStatus('Addon synced. Open Stremio on the TV with the same account and give it a few seconds to refresh.', 'success');
        showToast('Addon synced to your Stremio account.');
        setTimeout(function(){ closeAccountSyncModal(true); }, 1400);
    } catch (err) {
        setInstallStatus(getInstallErrorMessage(err), 'error');
    } finally {
        setSyncState(false);
    }
}

document.getElementById('account_install_button').addEventListener('click', function(){
    openAccountSyncModal();
});

document.getElementById('install_button').addEventListener('click', function(e){
    e.preventDefault();
    var url = getManifestUrl();
    window.location.href = 'stremio://' + url.replace(/^https?:\\/\\//, '');
});

function copyManifest(){
    var url = getManifestUrl();
    navigator.clipboard.writeText(url).then(function(){ showToast('Link copied to clipboard!'); });
}

document.getElementById('account_sync_modal').addEventListener('click', function(e){
    if(e.target === this){
        closeAccountSyncModal();
    }
});

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
        closeAccountSyncModal();
    }
});
</script>
</body>
</html>`;
}
