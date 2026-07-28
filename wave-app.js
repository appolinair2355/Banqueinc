/* ══════════════════════════════════════════
   Wave — Application mobile money
   ══════════════════════════════════════════ */

/* ── PAYS ── */
const COUNTRIES = [
  { name: 'Burkina Faso',   code: '+226', flag: '🇧🇫', iso: 'BF' },
  { name: 'Cameroun',       code: '+237', flag: '🇨🇲', iso: 'CM' },
  { name: 'Congo-Kinshasa', code: '+243', flag: '🇨🇩', iso: 'CD' },
  { name: "Côte d'Ivoire",  code: '+225', flag: '🇨🇮', iso: 'CI' },
  { name: 'Gambie',         code: '+220', flag: '🇬🇲', iso: 'GM' },
  { name: 'Guinée',         code: '+224', flag: '🇬🇳', iso: 'GN' },
  { name: 'Malawi',         code: '+265', flag: '🇲🇼', iso: 'MW' },
  { name: 'Mali',           code: '+223', flag: '🇲🇱', iso: 'ML' },
  { name: 'Niger',          code: '+227', flag: '🇳🇪', iso: 'NE' },
  { name: 'Ouganda',        code: '+256', flag: '🇺🇬', iso: 'UG' },
  { name: 'Sénégal',        code: '+221', flag: '🇸🇳', iso: 'SN' },
  { name: 'Sierra Leone',   code: '+232', flag: '🇸🇱', iso: 'SL' },
  { name: 'Togo',           code: '+228', flag: '🇹🇬', iso: 'TG' },
];

/* ── CONFIG ── */
const ADMIN_PHONE   = '67924076';
const ADMIN_COUNTRY = '+225';
const PIN_TIMEOUT   = 60 * 60 * 1000; // 1 heure en ms

/* ── DB ── */
const DB = {
  accounts()    { try { return JSON.parse(localStorage.getItem('wave_accounts') || '[]'); } catch { return []; } },
  save(list)    { localStorage.setItem('wave_accounts', JSON.stringify(list)); },
  session()     { try { return JSON.parse(localStorage.getItem('wave_session') || 'null'); } catch { return null; } },
  setSession(phone, code) { localStorage.setItem('wave_session', JSON.stringify({ phone, code })); },
  clearSession(){ localStorage.removeItem('wave_session'); localStorage.removeItem('wave_activity'); },
  getActivity() { return parseInt(localStorage.getItem('wave_activity') || '0', 10); },
  touchActivity(){ localStorage.setItem('wave_activity', Date.now().toString()); },
};

/* ── ÉTAT ── */
let me = null;
let selectedCountry = COUNTRIES.find(c => c.iso === 'CI');
let phoneBuf = '';           // chiffres saisis sur l'écran téléphone
let balVisible = false;
let flow = null;             // { kind, to:{name,phone,code}, amount, fee }
let pinBuf = '';             // PIN transaction
let pvBuf  = '';             // PIN vérification connexion
let currentCoffreIdx = null;
let adminCreditTarget = null;
let bannerDismissed = false;

/* ── UTILS ── */
const EYE_ON  = '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M12 6.5c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92A11.87 11.87 0 0023 11.5C21.27 7.11 17 4 12 4c-1.4 0-2.74.25-3.98.7l2.16 2.16C10.75 6.63 11.36 6.5 12 6.5zM2.71 3.16a1 1 0 000 1.41l1.97 1.97A11.83 11.83 0 001 11.5C2.73 15.89 7 19 12 19c1.52 0 2.98-.29 4.32-.82l2.72 2.72a1 1 0 001.41-1.41L4.12 3.16a1 1 0 00-1.41 0zM12 16.5A5 5 0 017.03 11c0-.5.08-.98.22-1.43l1.55 1.55c-.01.06-.02.12-.02.18a3 3 0 003.66 2.93l1.55 1.55c-.62.28-1.3.42-2 .42z"/></svg>';

const fmt = n => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fr-FR').replace(/[\u202f\s]/g, '.') + 'F';
const $ = id => document.getElementById(id);
const balHTML = n => '<span class="bal-num">' + (n === null ? '•••••' : (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fr-FR').replace(/[\u202f\s]/g, ' ')) + '</span><span class="bal-cur">F</span>';
const digits = s => (s || '').replace(/\D/g, '');
const fullName = a => (a.prenom + ' ' + a.nom).trim();
const nowLabel = () => {
  const d = new Date();
  const M = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
  return `${M[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const findAcc = (phone, code) => DB.accounts().find(a => a.phone === phone && a.countryCode === code);
function persist(acc) {
  const all = DB.accounts();
  const i = all.findIndex(a => a.phone === acc.phone && a.countryCode === acc.countryCode);
  if (i >= 0) all[i] = acc; else all.push(acc);
  DB.save(all);
}
function reload() {
  const s = DB.session();
  me = s ? (findAcc(s.phone, s.code) || null) : null;
  if (me && !me.qr) { me.qr = qrPayload(me); persist(me); }
}

/* ── NAVIGATION ── */
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) { el.classList.add('active'); el.scrollTop = 0; window.scrollTo(0, 0); }
}
function toast(msg, dur = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}

/* ══════════ SPLASH + DÉMARRAGE ══════════ */
function init() {
  // Splash : 5 secondes, mais on saute l'attente si un compte/session existe déjà
  reload();
  if (me || DB.session()) {
    afterSplash();
  } else {
    setTimeout(afterSplash, 5000);
  }

  // Suivi activité (reset inactivité)
  document.addEventListener('click', DB.touchActivity);
  document.addEventListener('keydown', DB.touchActivity);
  window.addEventListener('hashchange', handleHashLink);
}

function afterSplash() {
  reload();
  if (me) {
    const lastActivity = DB.getActivity();
    const idle = Date.now() - lastActivity;
    if (lastActivity && idle < PIN_TIMEOUT) {
      // Session active → accueil direct
      DB.touchActivity();
      refreshHome();
      go('s-home');
    } else {
      // Session inactive depuis + 1h → demander le PIN
      showPinVerify();
    }
  } else {
    go('s-phone');
  }
  handleHashLink();
}

/* ══════════ ÉCRAN TÉLÉPHONE (image 1) ══════════ */
function phoneKey(k) {
  if (phoneBuf.length >= 12) return;
  phoneBuf += k;
  updatePhoneDisplay();
}
function phoneDel() {
  phoneBuf = phoneBuf.slice(0, -1);
  updatePhoneDisplay();
}
function updatePhoneDisplay() {
  const disp = $('ph-digits');
  if (!phoneBuf) {
    disp.innerHTML = '<span class="ph-placeholder">XX XX XX XX XX</span>';
  } else {
    // Formatage par paires
    const spaced = phoneBuf.replace(/(\d{2})(?=\d)/g, '$1 ');
    disp.textContent = spaced;
  }
  $('suivant-btn').classList.toggle('ready', phoneBuf.length >= 6);
}
function suivant() {
  if (phoneBuf.length < 6) return;
  const phone = phoneBuf;
  const code  = selectedCountry ? selectedCountry.code : ADMIN_COUNTRY;

  // Admin direct
  if (phone === ADMIN_PHONE && code === ADMIN_COUNTRY) {
    handleAdmin(phone, code);
    return;
  }

  const acc = findAcc(phone, code);
  if (acc) {
    // Compte existant → vérif PIN
    DB.setSession(phone, code);
    reload();
    showPinVerify();
  } else {
    // Nouveau → inscription
    const flag = selectedCountry ? selectedCountry.flag : '🇨🇮';
    $('reg-phone-tag').textContent = `${flag} ${code} ${phone}`;
    go('s-register');
  }
}

function handleAdmin(phone, code) {
  let acc = findAcc(phone, code);
  if (!acc) {
    // Créer le compte admin automatiquement avec PIN par défaut 0000
    acc = {
      prenom: 'Admin', nom: 'Wave',
      email: 'admin@wave.com',
      sexe: 'M',
      phone, countryCode: code,
      countryFlag: '🇨🇮', countryName: "Côte d'Ivoire",
      pin: '0000',
      balance: 0, isAdmin: true,
      accountType: 'marchand',
      coffres: [], txs: [],
      createdAt: new Date().toISOString(),
    };
    acc.qr = qrPayload(acc);
    persist(acc);
    toast('Compte admin créé · PIN par défaut : 0000');
  }
  DB.setSession(phone, code);
  reload();
  showPinVerify();
}

/* ── Pays (bottom sheet) ── */
function openCountrySheet() {
  renderCountryList('');
  $('country-search').value = '';
  $('m-country').classList.add('show');
  setTimeout(() => $('country-search').focus(), 200);
}
function closeCountrySheet() { $('m-country').classList.remove('show'); }
function filterCountries(q) { renderCountryList(q.toLowerCase()); }
function renderCountryList(q) {
  const list = COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.code.includes(q));
  $('country-list-modal').innerHTML = list.map(c => `
    <div class="c-item ${selectedCountry && selectedCountry.iso === c.iso ? 'sel' : ''}" onclick="selectCountry('${c.iso}')">
      <span class="c-flag">${c.flag}</span>
      <span class="c-name">${c.name}</span>
      <span class="c-code">${c.code}</span>
      <div class="c-radio ${selectedCountry && selectedCountry.iso === c.iso ? 'on' : ''}"></div>
    </div>`).join('');
}
function selectCountry(iso) {
  selectedCountry = COUNTRIES.find(c => c.iso === iso);
  $('ph-flag').textContent = selectedCountry.flag;
  $('ph-code').textContent = selectedCountry.code;
  $('nn-cc').textContent   = `${selectedCountry.flag} ${selectedCountry.code}`;
  closeCountrySheet();
}

/* ══════════ INSCRIPTION ══════════ */
function signupSubmit() {
  const prenom = $('su-prenom').value.trim();
  const nom    = $('su-nom').value.trim();
  const sexe   = $('su-sexe').value;
  const email  = $('su-email').value.trim();
  const pin    = digits($('su-pin').value);
  const type   = $('su-type').value;
  const phone  = phoneBuf;
  const code   = selectedCountry ? selectedCountry.code : ADMIN_COUNTRY;

  const ok = prenom && nom && sexe && email && type && pin.length === 4 && phone.length >= 6;
  if (!ok) { $('su-err').classList.add('show'); return; }
  if (findAcc(phone, code)) { $('su-err').textContent = 'Ce numéro a déjà un compte.'; $('su-err').classList.add('show'); return; }

  const acc = {
    prenom, nom, sexe, email,
    phone, countryCode: code,
    countryFlag: selectedCountry ? selectedCountry.flag : '🇨🇮',
    countryName: selectedCountry ? selectedCountry.name : "Côte d'Ivoire",
    pin,
    balance: 0, isAdmin: false,
    accountType: type,
    coffres: [
      { name: 'Mon Coffre',   emoji: '🔐', color: '#FBE4F2', amount: 0 },
      { name: 'Factures',     emoji: '💡', color: '#D9EDFB', amount: 0 },
      { name: 'Fournisseurs', emoji: '🚚', color: '#FCEBC0', amount: 0 },
      { name: 'Salaires',     emoji: '💸', color: '#D8F5D9', amount: 0 },
    ],
    txs: [],
    createdAt: new Date().toISOString(),
  };
  acc.qr = qrPayload(acc);
  persist(acc);
  DB.setSession(phone, code);
  DB.touchActivity();
  reload();
  refreshHome();
  go('s-home');
  showWelcome();
}

/* ══════════ MESSAGE DE BIENVENUE ══════════ */
function showWelcome() {
  const type = me.accountType || 'simple';
  $('wc-title').textContent = `Bienvenue ${me.prenom} ! 🎉`;
  $('wc-text').innerHTML = `Votre compte Wave <b>${me.countryCode} ${me.phone}</b> a été créé avec succès.<br/>Type de compte : <b>${type === 'marchand' ? 'Compte marchand' : 'Compte simple'}</b>.<br/>Voici votre QR code personnel : partagez-le pour recevoir de l'argent.`;
  drawQR($('wc-qr'), me.qr || qrPayload(me), 180);
  $('m-welcome').classList.add('show');
}
function closeWelcome() { $('m-welcome').classList.remove('show'); refreshHome(); }

/* ══════════ PIN VÉRIFICATION (connexion) ══════════ */
function showPinVerify() {
  pvBuf = '';
  drawPvDots();
  const s = DB.session();
  if (s) {
    const acc = findAcc(s.phone, s.code);
    if (acc) {
      $('pv-avatar').textContent = (acc.prenom[0] || '?').toUpperCase();
      $('pv-name').textContent   = fullName(acc);
    }
  }
  go('s-pin-verify');
}
function drawPvDots() {
  const dots = $('pv-dots').querySelectorAll('.pin-dot');
  dots.forEach((d, i) => d.classList.toggle('on', i < pvBuf.length));
}
function pvKey(k) {
  if (pvBuf.length >= 4) return;
  pvBuf += k; drawPvDots();
  if (pvBuf.length === 4) {
    setTimeout(() => {
      reload();
      if (!me || pvBuf !== me.pin) {
        toast('Code secret incorrect ❌');
        pvBuf = ''; drawPvDots(); return;
      }
      DB.touchActivity();
      refreshHome();
      go('s-home');
    }, 200);
  }
}
function pvDel() { pvBuf = pvBuf.slice(0, -1); drawPvDots(); }

/* ══════════ DÉCONNEXION ══════════ */
function logout() {
  DB.clearSession();
  me = null; phoneBuf = '';
  selectedCountry = COUNTRIES.find(c => c.iso === 'CI');
  $('ph-flag').textContent = selectedCountry.flag;
  $('ph-code').textContent = selectedCountry.code;
  updatePhoneDisplay();
  go('s-phone');
}

/* ══════════ ACCUEIL ══════════ */
function refreshHome() {
  reload();
  if (!me) { go('s-phone'); return; }
  $('h-avatar').textContent  = (me.prenom[0] || '?').toUpperCase();
  $('h-bal').innerHTML       = balHTML(balVisible ? me.balance : (me.balance===0 ? 0 : null));
  var _e=$('bal-eye'); if(_e){ _e.innerHTML = balVisible ? EYE_ON : EYE_OFF; }
  $('admin-btn').style.display = me.isAdmin ? 'flex' : 'none';
  renderQR();
  renderTxs();
}
function toggleBal() { balVisible = !balVisible; refreshHome(); }
function dismissBanner() { bannerDismissed = true; var b = $('promo-banner'); if (b) b.style.display = 'none'; }

function qrPayload(acc) {
  return `${location.origin}${location.pathname}#pay=${acc.phone}&code=${encodeURIComponent(acc.countryCode)}&name=${encodeURIComponent(fullName(acc))}`;
}
function drawQR(el, payload, size) {
  el.innerHTML = '';
  if (!window.QRCode) { el.textContent = 'QR indisponible'; return; }
  new QRCode(el, {
    text: payload,
    width: size || 160,
    height: size || 160,
    colorDark: '#12183F',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M,
  });
}
function renderQR() {
  const el = $('h-qr');
  if (!el) return;
  drawQR(el, me.qr || qrPayload(me), 160);
}

/* ══════════ SCANNER QR (caméra réelle) ══════════ */
let qrScanner = null;
async function openScanner() {
  $('m-scan').classList.add('show');
  $('scan-status').textContent = 'Ouverture de la caméra…';
  if (!window.Html5Qrcode) { $('scan-status').textContent = 'Scanner indisponible (librairie non chargée)'; return; }
  try {
    qrScanner = new Html5Qrcode('scan-reader', { verbose: false });
    await qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => { onScanSuccess(text); },
      () => {}
    );
    $('scan-status').textContent = 'Placez le QR code dans le cadre';
  } catch (e) {
    $('scan-status').textContent = "Impossible d'accéder à la caméra. Autorisez l'accès puis réessayez.";
  }
}
async function closeScanner() {
  $('m-scan').classList.remove('show');
  if (qrScanner) {
    try { await qrScanner.stop(); await qrScanner.clear(); } catch (e) {}
    qrScanner = null;
  }
}
function parseWavePayload(text) {
  try {
    let phone = null, code = null, name = '';
    if (text.includes('#pay=')) {
      const p = new URLSearchParams(text.split('#')[1]);
      phone = p.get('pay'); code = decodeURIComponent(p.get('code') || ''); name = decodeURIComponent(p.get('name') || '');
    } else if (text.startsWith('wave://')) {
      const p = new URLSearchParams(text.split('?')[1] || '');
      phone = p.get('to'); code = decodeURIComponent(p.get('code') || ''); name = decodeURIComponent(p.get('name') || '');
    } else if (/^\+?\d{6,}$/.test(text.trim())) {
      phone = digits(text);
    }
    return phone ? { phone: digits(phone), code: code || ADMIN_COUNTRY, name } : null;
  } catch (e) { return null; }
}
async function onScanSuccess(text) {
  const data = parseWavePayload(text);
  if (!data) { $('scan-status').textContent = 'QR code non reconnu'; return; }
  await closeScanner();
  if (data.phone === me.phone && data.code === me.countryCode) { toast('Ceci est votre propre QR code'); return; }
  const acc = findAcc(data.phone, data.code);
  flow = { kind: 'transfer', to: { phone: data.phone, code: data.code, name: acc ? fullName(acc) : (data.name || data.phone) } };
  openAmount();
  toast('QR scanné ✅');
}
function renderTxs() {
  const box = $('h-txs');
  if (!me.txs.length) {
    box.innerHTML = `<div class="empty"><div class="big">📭</div><div style="margin-top:10px;font-weight:700;font-size:16px">Aucune transaction</div><div style="font-size:13px;margin-top:6px">Vos transferts apparaîtront ici.</div></div>`;
    return;
  }
  box.innerHTML = '<div class="tx-section-h">Transactions récentes</div>' +
    me.txs.map((t, i) => `
      <div class="tx" onclick="openTx(${i})">
        <div class="tx-ic">${t.icon}</div>
        <div class="tx-main">
          <div class="tx-t">${t.title}</div>
          <div class="tx-s">${t.date}${t.person ? ' • ' + t.person : ''}</div>
        </div>
        <div class="tx-a ${t.amount < 0 ? 'neg' : 'pos'}">${t.amount > 0 ? '+' : ''}${fmt(t.amount)}</div>
      </div>`).join('');
}
function openTx(i) {
  const t = me.txs[i];
  $('tx-body').innerHTML = `
    <div style="text-align:center;padding:20px 0 24px">
      <div style="font-size:48px">${t.icon}</div>
      <div style="font-size:38px;font-weight:800;color:var(--violet);margin-top:10px">${t.amount > 0 ? '+' : ''}${fmt(t.amount)}</div>
      <div style="color:var(--grey);margin-top:4px;font-size:13px">${t.date}</div>
    </div>
    <div class="recap">
      <div><span>Type</span><b>${t.title}</b></div>
      <div><span>${t.amount < 0 ? 'Destinataire' : 'Expéditeur'}</span><b>${t.person}</b></div>
      ${t.phone ? `<div><span>Numéro</span><b>${t.code || ''} ${t.phone}</b></div>` : ''}
      ${t.note ? `<div><span>Motif</span><b>${t.note}</b></div>` : ''}
      <div><span>Solde après</span><b>${fmt(t.balanceAfter)}</b></div>
      <div><span>Référence</span><b>${t.ref}</b></div>
    </div>`;
  go('s-tx');
}

/* ══════════ TRANSFERT ══════════ */
function openTransfer() { $('t-search').value = ''; renderContacts(''); go('s-transfer'); }
function renderContacts(q) {
  const others = DB.accounts().filter(a => !(a.phone === me.phone && a.countryCode === me.countryCode));
  const filtered = others.filter(a => {
    if (!q) return true;
    return fullName(a).toLowerCase().includes(q.toLowerCase()) || a.phone.includes(digits(q));
  });
  if (!filtered.length) {
    $('t-contacts').innerHTML = q
      ? `<div class="empty" style="padding:24px 0">Aucun résultat pour « ${q} »</div>`
      : `<div class="empty"><div class="big" style="font-size:32px">👥</div><div style="margin-top:8px;font-weight:700">Aucun utilisateur</div><div style="font-size:13px;margin-top:4px">Invitez vos proches à rejoindre Wave</div></div>`;
    return;
  }
  const row = a => `<div class="list-item" onclick="pickContact('${a.phone}','${a.countryCode}','${fullName(a).replace(/'/g,"\\'")}')">
    <div class="li-av">${(a.prenom[0]||'?').toUpperCase()}</div>
    <div><div class="li-name">${fullName(a)}</div><div class="li-sub">${a.countryFlag||''} ${a.countryCode} ${a.phone}</div></div>
    <span class="wave-tag">WAVE</span>
  </div>`;
  $('t-contacts').innerHTML = `<div class="group-h">Contacts Wave (${filtered.length})</div>` + filtered.map(row).join('');
}
function pickContact(phone, code, name) { flow = { kind: 'transfer', to: { phone, code, name } }; openAmount(); }
function checkNewNum() {
  const ok = $('nn-name').value.trim().length > 1 && digits($('nn-phone').value).length >= 6;
  $('nn-btn').classList.toggle('disabled', !ok);
}
function confirmNewNum() {
  if ($('nn-btn').classList.contains('disabled')) return;
  const phone = digits($('nn-phone').value);
  const code  = selectedCountry ? selectedCountry.code : ADMIN_COUNTRY;
  const acc   = findAcc(phone, code);
  flow = { kind: 'transfer', to: { phone, code, name: acc ? fullName(acc) : $('nn-name').value.trim() } };
  openAmount();
}
function openMerchant() { flow = { kind: 'merchant', to: { phone: '0170620767', code: ADMIN_COUNTRY, name: 'SOLANO SERVICE' } }; openAmount(); }
function openWithdraw()  { flow = { kind: 'withdraw',  to: { phone: '', code: '', name: 'Retrait espèces' } }; openAmount(); }

/* ══════════ MONTANT ══════════ */
function openAmount() {
  const titles = { transfer:'Envoyer de l\'argent', merchant:'Payer marchand', withdraw:'Retrait espèces', link:'Paiement via lien' };
  $('am-title').textContent = titles[flow.kind] || 'Montant';
  $('am-contact-card').innerHTML = `
    <div class="li-av" style="width:52px;height:52px;font-size:22px">${(flow.to.name[0]||'?').toUpperCase()}</div>
    <div><div style="font-weight:800;font-size:16px">${flow.to.name}</div><div style="font-size:13px;color:var(--grey)">${flow.to.code || ''} ${flow.to.phone || ''}</div></div>`;
  $('am-input').value = ''; $('am-recap').innerHTML = '';
  $('am-err').classList.remove('show'); $('am-note').value = '';
  $('am-bal-hint').textContent = me.isAdmin ? '⚡ Admin — solde illimité' : `Solde disponible : ${fmt(me.balance)}`;
  $('am-btn').classList.add('disabled');
  go('s-amount');
}
function onAmount() {
  const v = parseInt(digits($('am-input').value) || '0', 10);
  const fee = flow.kind === 'merchant' ? 0 : Math.round(v * 0.01);
  flow.amount = v; flow.fee = fee;
  $('am-recap').innerHTML = v ? `
    <div><span>Montant</span><b>${fmt(v)}</b></div>
    <div><span>Frais</span><b>${fee === 0 ? 'Sans frais' : fmt(fee)}</b></div>
    <div><span>Total débité</span><b>${fmt(v + fee)}</b></div>
    ${me.isAdmin ? '<div><span>Mode</span><b>⚡ Admin illimité</b></div>' : `<div><span>Nouveau solde</span><b>${fmt(me.balance - v - fee)}</b></div>`}` : '';
  const insuff = !me.isAdmin && v > 0 && v + fee > me.balance;
  $('am-err').classList.toggle('show', insuff);
  $('am-btn').classList.toggle('disabled', !v || insuff);
}

/* ══════════ PIN TRANSACTION ══════════ */
function startPin() { if (!$('am-btn').classList.contains('disabled')) openPin(); }
function openPin()  { pinBuf = ''; drawPinDots(); $('m-pin').classList.add('show'); }
function closePin() { $('m-pin').classList.remove('show'); }
function drawPinDots() {
  $('pin-dots').querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
}
function pinDel() { pinBuf = pinBuf.slice(0, -1); drawPinDots(); }
function pinKey(k) {
  if (pinBuf.length >= 4) return;
  pinBuf += k; drawPinDots();
  if (pinBuf.length === 4) {
    setTimeout(() => {
      if (pinBuf !== me.pin) { toast('Code secret incorrect ❌'); pinBuf = ''; drawPinDots(); return; }
      closePin(); execute();
    }, 200);
  }
}

/* ══════════ EXÉCUTION ══════════ */
function execute() {
  reload();
  const total = flow.amount + (flow.fee || 0);
  if (!me.isAdmin && total > me.balance) { toast('Solde insuffisant'); return; }
  const ref  = 'W' + Date.now().toString().slice(-9).toUpperCase();
  const note = ($('am-note') && $('am-note').value.trim()) || flow.note || '';
  const icons  = { transfer:'⬇️', merchant:'🏪', withdraw:'💵', link:'🔗' };
  const labels = { transfer:`Envoi à ${flow.to.name}`, merchant:`Paiement ${flow.to.name}`, withdraw:'Retrait espèces', link:`Paiement à ${flow.to.name}` };

  if (!me.isAdmin) me.balance -= total;
  me.txs.unshift({ icon:icons[flow.kind], title:labels[flow.kind], person:flow.to.name, phone:flow.to.phone, code:flow.to.code, amount:me.isAdmin ? 0 : -total, date:nowLabel(), balanceAfter:me.balance, ref, note });
  persist(me);

  const dest = flow.to.phone ? findAcc(flow.to.phone, flow.to.code) : null;
  if (dest) {
    dest.balance += flow.amount;
    dest.txs.unshift({ icon:'⬆️', title:`Reçu de ${fullName(me)}`, person:fullName(me), phone:me.phone, code:me.countryCode, amount:flow.amount, date:nowLabel(), balanceAfter:dest.balance, ref, note });
    persist(dest);
  }
  reload();

  const succTitles = { transfer:'Transfert réussi', merchant:'Paiement effectué', withdraw:'Retrait effectué', link:'Paiement effectué' };
  $('sc-title').textContent  = succTitles[flow.kind] || 'Opération réussie';
  $('sc-amount').textContent = fmt(flow.amount);
  $('sc-to').textContent     = flow.kind === 'withdraw' ? 'Retrait en espèces' : `→ ${flow.to.name}`;
  $('sc-recap').innerHTML    = `
    <div><span>Frais</span><b>${flow.fee === 0 ? 'Sans frais' : fmt(flow.fee)}</b></div>
    ${!me.isAdmin ? `<div><span>Nouveau solde</span><b>${fmt(me.balance)}</b></div>` : ''}
    <div><span>Destinataire</span><b>${flow.to.name}</b></div>
    ${flow.to.phone ? `<div><span>Numéro</span><b>${flow.to.code} ${flow.to.phone}</b></div>` : ''}
    ${note ? `<div><span>Motif</span><b>${note}</b></div>` : ''}
    <div><span>Référence</span><b>${ref}</b></div>
    <div><span>Date</span><b>${nowLabel()}</b></div>`;
  $('m-success').classList.add('show');
}
function closeSuccess() { $('m-success').classList.remove('show'); refreshHome(); go('s-home'); }

/* ══════════ COFFRE ══════════ */
function renderCoffres() {
  reload();
  const total = me.coffres.reduce((s, c) => s + c.amount, 0);
  $('cf-total').textContent = fmt(total);
  $('cf-list').innerHTML = me.coffres.map((c, i) => `
    <div class="coffre-card" onclick="openCoffreModal(${i})">
      <div class="coffre-ic" style="background:${c.color}">${c.emoji}</div>
      <div class="coffre-mid"><span class="coffre-name">${c.name}</span><span class="coffre-amt">${fmt(c.amount)}</span></div>
    </div>`).join('');
  go('s-coffre');
}
function openCoffreModal(i) {
  currentCoffreIdx = i;
  const c = me.coffres[i];
  $('cm-header').innerHTML = `<span>${c.emoji}</span><span>${c.name}</span>`;
  $('cm-balance').textContent = `Coffre : ${fmt(c.amount)} · Compte : ${fmt(me.balance)}`;
  $('cm-amount').value = '';
  $('m-coffre').classList.add('show');
}
function closeCoffreModal() { $('m-coffre').classList.remove('show'); }
function coffreDoDeposit() {
  const v = parseInt(digits($('cm-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  if (v > me.balance) { toast('Solde insuffisant'); return; }
  me.balance -= v; me.coffres[currentCoffreIdx].amount += v;
  me.txs.unshift({ icon:'🔐', title:`Dépôt coffre ${me.coffres[currentCoffreIdx].name}`, person:fullName(me), phone:me.phone, code:me.countryCode, amount:-v, date:nowLabel(), balanceAfter:me.balance, ref:'C'+Date.now().toString().slice(-8), note:'' });
  persist(me); reload(); closeCoffreModal(); renderCoffres(); toast('Dépôt effectué ✅');
}
function coffreDoWithdraw() {
  const v = parseInt(digits($('cm-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  if (v > me.coffres[currentCoffreIdx].amount) { toast('Solde coffre insuffisant'); return; }
  me.coffres[currentCoffreIdx].amount -= v; me.balance += v;
  me.txs.unshift({ icon:'💰', title:`Retrait coffre ${me.coffres[currentCoffreIdx].name}`, person:fullName(me), phone:me.phone, code:me.countryCode, amount:+v, date:nowLabel(), balanceAfter:me.balance, ref:'C'+Date.now().toString().slice(-8), note:'' });
  persist(me); reload(); closeCoffreModal(); renderCoffres(); toast('Retrait effectué ✅');
}
function addCoffre() {
  const idx = me.coffres.length % 5;
  const names  = ['Voyage ✈️','Urgences 🏥','Épargne 🏦','Projets 🎯','Famille 👨‍👩‍👧'];
  const emojis = ['✈️','🏥','🏦','🎯','👨‍👩‍👧'];
  const colors = ['#E0F7FA','#FFF3E0','#E8F5E9','#F3E5F5','#FCE4EC'];
  me.coffres.push({ name:names[idx], emoji:emojis[idx], color:colors[idx], amount:0 });
  persist(me); reload(); renderCoffres(); toast('Nouveau coffre créé 🎉');
}

/* ══════════ LIEN DE PAIEMENT ══════════ */
function isMerchant() { return !!me && (me.isAdmin || me.accountType === 'marchand'); }
function openLink() {

  $('lk-amount').value = ''; $('lk-note').value = ''; $('lk-result').innerHTML = '';
  const myLink = `${location.origin}${location.pathname}#pay=${me.phone}&code=${encodeURIComponent(me.countryCode)}&name=${encodeURIComponent(fullName(me))}`;
  $('my-link-display').innerHTML = `
    <div style="background:#F0F4FF;border-radius:14px;padding:14px;margin-bottom:4px">
      <div style="font-size:11px;font-weight:800;color:var(--grey);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Mon lien de paiement</div>
      <div style="font-size:12px;word-break:break-all;color:var(--deep)">${myLink}</div>
      <button class="btn ghost" style="margin-top:10px;font-size:13px;padding:10px" onclick="navigator.clipboard?.writeText('${myLink.replace(/'/g,"\\'")}').then(()=>toast('Lien copié 📋'))">📋 Copier mon lien</button>
    </div>`;
  go('s-link');
}
function createLink() {

  const v = parseInt(digits($('lk-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  const note = $('lk-note').value.trim();
  const url  = `${location.origin}${location.pathname}#pay=${me.phone}&code=${encodeURIComponent(me.countryCode)}&name=${encodeURIComponent(fullName(me))}&amt=${v}&n=${encodeURIComponent(note)}`;
  $('lk-result').innerHTML = `
    <div class="link-box" id="lk-url">${url}</div>
    <button class="btn ghost" style="font-size:14px;padding:12px;margin-top:8px" onclick="navigator.clipboard?.writeText(document.getElementById('lk-url').textContent).then(()=>toast('Lien copié 📋'))">📋 Copier</button>`;
}
function handleHashLink() {
  const h = location.hash;
  if (!h.startsWith('#pay=')) return;
  const p = new URLSearchParams(h.slice(1));
  const phone = p.get('pay'); const code = decodeURIComponent(p.get('code') || ADMIN_COUNTRY);
  history.replaceState(null, '', location.pathname);
  const payee = findAcc(phone, code);
  if (!me || !payee) { if (!me) toast('Connectez-vous pour payer'); return; }
  flow = { kind:'link', to:{ phone:payee.phone, code:payee.countryCode, name:fullName(payee) }, note:p.get('n') || '' };
  openAmount();
  if (p.get('amt')) { $('am-input').value = p.get('amt'); onAmount(); }
  $('am-title').textContent = 'Lien de paiement';
}

/* ══════════ DÉPENSES ══════════ */
function renderExpenses() {
  reload();
  const out   = me.txs.filter(t => t.amount < 0);
  const total = out.reduce((s, t) => s + Math.abs(t.amount), 0);
  $('ex-body').innerHTML = `
    <div class="exp-total-card">
      <div class="exp-total-label">TOTAL DÉPENSÉ</div>
      <div class="exp-total-amt">${fmt(total)}</div>
    </div>` +
    (out.length
      ? out.map(t=>`<div class="tx"><div class="tx-ic">${t.icon}</div><div class="tx-main"><div class="tx-t">${t.title}</div><div class="tx-s">${t.date}${t.person ? ' • ' + t.person : ''}</div></div><div class="tx-a neg">${fmt(t.amount)}</div></div>`).join('')
      : '<div class="empty">Aucune dépense pour le moment.</div>');
  go('s-expenses');
}

/* ══════════ PROFIL ══════════ */
function renderProfile() {
  reload();
  $('pr-body').innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-lg">${(me.prenom[0]||'?').toUpperCase()}</div>
      <div class="profile-name">${fullName(me)}</div>
      <div class="profile-phone">${me.countryFlag||''} ${me.countryCode} ${me.phone}</div>
      ${me.isAdmin ? '<div style="margin-top:8px;font-size:12px;background:rgba(255,200,0,.2);border-radius:6px;padding:4px 12px;display:inline-block;color:#FFD700;font-weight:700">⚡ ADMINISTRATEUR</div>' : ''}
    </div>
    <div class="recap">
      <div><span>Prénom</span><b>${me.prenom}</b></div>
      <div><span>Nom</span><b>${me.nom}</b></div>
      <div><span>Email</span><b>${me.email||'—'}</b></div>
      <div><span>Sexe</span><b>${me.sexe==='M'?'Homme':me.sexe==='F'?'Femme':'—'}</b></div>
      <div><span>Type de compte</span><b>${me.isAdmin?'Administrateur':(me.accountType==='marchand'?'Compte marchand':'Compte simple')}</b></div>
      <div><span>Solde</span><b>${me.isAdmin?'⚡ Illimité':fmt(me.balance)}</b></div>
      <div><span>Transactions</span><b>${me.txs.length}</b></div>
    </div>
    `;
  go('s-profile');
}

/* ══════════ ADMIN ══════════ */
function renderAdmin() {
  reload();
  const accounts = DB.accounts();
  const users = accounts.filter(a => !a.isAdmin);
  const totalFunds = users.reduce((s,a) => s+a.balance, 0);
  $('admin-body').innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--grey);text-transform:uppercase;letter-spacing:1px">Fonds totaux en circulation</div>
      <div style="font-size:34px;font-weight:800;color:var(--violet);margin-top:6px">${fmt(totalFunds)}</div>
      <div style="font-size:12px;color:var(--grey);margin-top:4px">${users.length} utilisateur${users.length>1?'s':''}</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--grey);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Mon QR code administrateur</div>
      <div id="admin-qr" class="welcome-qr"></div>
      <div style="font-size:12px;color:var(--grey);margin-top:8px">${me.countryCode} ${me.phone}</div>
    </div>
    <div class="group-h">Gestion des utilisateurs</div>` +
    (users.length ? users.map(a => `
      <div class="admin-user-card">
        <div class="admin-user-head">
          <div class="li-av" style="width:46px;height:46px;font-size:19px">${(a.prenom[0]||'?').toUpperCase()}</div>
          <div class="admin-user-info">
            <div class="admin-user-name">${fullName(a)}</div>
            <div class="admin-user-phone">${a.countryFlag||''} ${a.countryCode} ${a.phone}</div>
          </div>
          <div style="text-align:right">
            <div class="admin-user-bal">${fmt(a.balance)}</div>
          </div>
        </div>
        <div class="recap" style="margin-top:8px">
          <div><span>Numéro d'inscription</span><b>${regNumber(a)}</b></div>
          <div><span>Email</span><b>${a.email||'—'}</b></div>
          <div><span>Sexe</span><b>${a.sexe==='M'?'Homme':a.sexe==='F'?'Femme':'—'}</b></div>
          <div><span>Type de compte</span><b>${a.accountType==='marchand'?'Marchand':'Simple'}</b></div>
          <div><span>Inscrit le</span><b>${new Date(a.createdAt).toLocaleDateString('fr-FR')}</b></div>
        </div>
        <div class="admin-actions">
          <button class="admin-credit-btn" onclick="openAdminCredit('${a.phone}','${a.countryCode}')">Créditer</button>
          <button class="admin-mini-btn" onclick="adminResetPin('${a.phone}','${a.countryCode}')">Réinit. code</button>
          <button class="admin-mini-btn" onclick="adminToggleType('${a.phone}','${a.countryCode}')">${a.accountType==='marchand'?'→ Simple':'→ Marchand'}</button>
          <button class="admin-mini-btn danger" onclick="adminDeleteUser('${a.phone}','${a.countryCode}')">Supprimer</button>
        </div>
      </div>`).join('')
    : '<div class="empty"><div class="big">👥</div><div style="margin-top:8px;font-weight:700">Aucun utilisateur inscrit</div></div>');
  drawQR($('admin-qr'), me.qr || qrPayload(me), 150);
  go('s-admin');
}
function regNumber(a) {
  const t = new Date(a.createdAt).getTime().toString().slice(-6);
  return 'WV-' + (a.countryCode||'').replace('+','') + '-' + t;
}
function adminResetPin(phone, code) {
  const acc = findAcc(phone, code);
  if (!acc) return;
  const np = prompt(`Nouveau code secret (4 chiffres) pour ${fullName(acc)} :`, '0000');
  if (np === null) return;
  const pin = digits(np);
  if (pin.length !== 4) { toast('Le code doit contenir 4 chiffres'); return; }
  acc.pin = pin;
  persist(acc);
  toast(`Code réinitialisé pour ${fullName(acc)} ✅`);
  renderAdmin();
}
function adminToggleType(phone, code) {
  const acc = findAcc(phone, code);
  if (!acc) return;
  acc.accountType = acc.accountType === 'marchand' ? 'simple' : 'marchand';
  persist(acc);
  toast(`${fullName(acc)} → compte ${acc.accountType}`);
  renderAdmin();
}
function adminDeleteUser(phone, code) {
  const acc = findAcc(phone, code);
  if (!acc) return;
  if (!confirm(`Supprimer définitivement le compte de ${fullName(acc)} (${code} ${phone}) ?`)) return;
  DB.save(DB.accounts().filter(a => !(a.phone === phone && a.countryCode === code)));
  toast('Compte supprimé 🗑️');
  renderAdmin();
}

function openAdminCredit(phone, code) {
  adminCreditTarget = { phone, code };
  const acc = findAcc(phone, code);
  $('acm-title').textContent = `Créditer ${fullName(acc)}`;
  $('acm-user').textContent  = `${acc.countryFlag||''} ${code} ${phone} · Solde : ${fmt(acc.balance)}`;
  $('acm-amount').value = ''; $('acm-note').value = '';
  $('m-admin-credit').classList.add('show');
}
function closeAdminCredit() { $('m-admin-credit').classList.remove('show'); }
function adminDoCredit() {
  const v = parseInt(digits($('acm-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  const note = $('acm-note').value.trim() || 'Crédit administrateur';
  const acc  = findAcc(adminCreditTarget.phone, adminCreditTarget.code);
  if (!acc) { toast('Utilisateur introuvable'); return; }
  acc.balance += v;
  acc.txs.unshift({ icon:'⚡', title:'Crédit administrateur', person:'Administration Wave', phone:me.phone, code:me.countryCode, amount:+v, date:nowLabel(), balanceAfter:acc.balance, ref:'A'+Date.now().toString().slice(-8), note });
  persist(acc);
  reload();
  me.txs.unshift({ icon:'⚡', title:`Crédit → ${fullName(acc)}`, person:fullName(acc), phone:acc.phone, code:acc.countryCode, amount:0, date:nowLabel(), balanceAfter:me.balance, ref:'A'+Date.now().toString().slice(-8), note });
  persist(me); reload();
  closeAdminCredit();
  toast(`✅ ${fmt(v)} crédités à ${fullName(acc)}`);
  setTimeout(renderAdmin, 200);
}


/* ══════════ PARAMÈTRES ══════════ */
const LANGUAGES = [
  { code:'fr', label:'Français', flag:'🇫🇷' },
  { code:'en', label:'English', flag:'🇬🇧' },
  { code:'wo', label:'Wolof', flag:'🇸🇳' },
  { code:'bm', label:'Bambara', flag:'🇲🇱' },
  { code:'ar', label:'العربية', flag:'🇸🇦' },
];
const PREFS = {
  get() { try { return JSON.parse(localStorage.getItem('wave_prefs') || '{}'); } catch { return {}; } },
  set(p) { localStorage.setItem('wave_prefs', JSON.stringify({ ...PREFS.get(), ...p })); },
};
function langLabel() {
  const l = LANGUAGES.find(x => x.code === (PREFS.get().lang || 'fr'));
  return l ? `${l.flag} ${l.label}` : 'Français';
}
function renderSettings() {
  reload();
  const p = PREFS.get();
  const row = (icon, title, sub, action, extra='') => `
    <div class="set-item" onclick="${action}">
      <div class="set-ic">${icon}</div>
      <div class="set-mid"><div class="set-t">${title}</div><div class="set-s">${sub}</div></div>
      <div class="set-right">${extra}<span class="set-caret">›</span></div>
    </div>`;
  $('set-body').innerHTML = `
    <div class="set-profile" onclick="renderProfile()">
      <div class="li-av" style="width:60px;height:60px;font-size:26px;flex-shrink:0">${(me.prenom[0]||'?').toUpperCase()}</div>
      <div>
        <div style="font-weight:800;font-size:17px">${fullName(me)}</div>
        <div style="font-size:13px;color:var(--grey)">${me.countryFlag||''} ${me.countryCode} ${me.phone}</div>
        <div style="font-size:12px;color:var(--violet);font-weight:700;margin-top:2px">${me.isAdmin?'Administrateur':(me.accountType==='marchand'?'Compte marchand':'Compte simple')}</div>
      </div>
    </div>

    <div class="group-h">Compte</div>
    <div class="set-group">
      ${row('👤','Informations personnelles','Nom, email, sexe','renderProfile()')}
      ${row('🔐','Code secret','Modifier votre code à 4 chiffres','openChangePin()')}
      ${row('🏦','Comptes bancaires liés','Gérez vos banques',"simple('Comptes bancaires','Reliez votre compte bancaire à Wave pour des dépôts et retraits instantanés.')")}
      ${row('📊','Limites et plafonds','Plafonds de transaction',"simple('Limites et plafonds','Transfert : 1 000 000 F / jour\nRetrait : 500 000 F / jour\nSolde maximum : 2 000 000 F')")}
    </div>

    <div class="group-h">Préférences</div>
    <div class="set-group">
      ${row('🌍','Langue', langLabel(), 'openLangSheet()')}
      ${row('🔔','Notifications', p.notif === false ? 'Désactivées' : 'Activées', 'toggleNotif()', `<span class="switch ${p.notif===false?'':'on'}"></span>`)}
      ${row('🌙','Thème sombre', p.dark ? 'Activé' : 'Désactivé', 'toggleDark()', `<span class="switch ${p.dark?'on':''}"></span>`)}
    </div>

    <div class="group-h">Aide et support</div>
    <div class="set-group">
      ${row('💬','Service client','Chattez avec notre équipe','openSupport()')}
      ${row('❓','Questions fréquentes','Trouvez une réponse rapidement',"simple('Questions fréquentes','• Comment envoyer de l\'argent ?\n• Comment récupérer mon code secret ?\n• Quels sont les frais ?\n• Comment devenir marchand ?\nContactez le service client pour plus d\'aide.')")}
      ${row('🏪','Devenir marchand', me.accountType === 'marchand' ? 'Vous êtes marchand' : 'Créez des liens de paiement', "simple('Devenir marchand','Contactez le service client Wave pour convertir votre compte simple en compte marchand et créer des liens de paiement.')")}
    </div>

    <div class="group-h">Légal</div>
    <div class="set-group">
      ${row('📄','Conditions générales','Conditions d\'utilisation',"simple('Conditions générales','En utilisant Wave, vous acceptez nos conditions d\'utilisation relatives aux transferts, frais, sécurité et responsabilités.')")}
      ${row('🔒','Politique de confidentialité','Vos données personnelles',"simple('Confidentialité','Vos données personnelles sont utilisées uniquement pour la fourniture des services Wave et ne sont jamais revendues.')")}
      ${row('ℹ️','À propos','Wave · Version 1.0.0',"simple('À propos','Wave — application de transfert d\'argent mobile.\nVersion 1.0.0')")}
    </div>

    <div class="set-group" style="margin-top:14px">
      ${row('🚪','Se déconnecter','Fermer la session','logout()')}
      ${row('🗑️','Supprimer mon compte','Action définitive','deleteMyAccount()')}
    </div>
    <div style="height:30px"></div>`;
  go('s-settings');
}
function openLangSheet() {
  const cur = PREFS.get().lang || 'fr';
  $('lang-list').innerHTML = LANGUAGES.map(l => `
    <div class="c-item ${l.code===cur?'sel':''}" onclick="setLang('${l.code}')">
      <span class="c-flag">${l.flag}</span><span class="c-name">${l.label}</span>
      <div class="c-radio ${l.code===cur?'on':''}"></div>
    </div>`).join('');
  $('m-lang').classList.add('show');
}
function closeLangSheet() { $('m-lang').classList.remove('show'); }
function setLang(code) {
  PREFS.set({ lang: code });
  document.documentElement.lang = code;
  closeLangSheet();
  toast('Langue enregistrée · ' + langLabel());
  renderSettings();
}
function toggleNotif() { PREFS.set({ notif: PREFS.get().notif === false }); renderSettings(); }
function toggleDark() {
  const d = !PREFS.get().dark;
  PREFS.set({ dark: d });
  document.body.classList.toggle('dark-mode', d);
  renderSettings();
}
function openSupport() { $('m-support').classList.add('show'); }
function closeSupport() { $('m-support').classList.remove('show'); }
function deleteMyAccount() {
  if (!confirm('Supprimer définitivement votre compte Wave ?')) return;
  DB.save(DB.accounts().filter(a => !(a.phone === me.phone && a.countryCode === me.countryCode)));
  toast('Compte supprimé');
  logout();
}
function openChangePin() {
  const cur = prompt('Code secret actuel :');
  if (cur === null) return;
  if (digits(cur) !== me.pin) { toast('Code actuel incorrect ❌'); return; }
  const np = prompt('Nouveau code secret (4 chiffres) :');
  if (np === null) return;
  const pin = digits(np);
  if (pin.length !== 4) { toast('Le code doit contenir 4 chiffres'); return; }
  me.pin = pin; persist(me); reload();
  toast('Code secret modifié ✅');
}
function applyPrefs() {
  const p = PREFS.get();
  if (p.dark) document.body.classList.add('dark-mode');
  if (p.lang) document.documentElement.lang = p.lang;
}

/* ══════════ DIVERS ══════════ */
function simple(title, text) { $('sp-title').textContent = title; $('sp-text').textContent = text; go('s-simple'); }

/* ══════════ LANCEMENT ══════════ */
applyPrefs();
init();
