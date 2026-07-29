/* ══════════════════════════════════════════════════════════════
   PayZone Afrique — Moteur bancaire générique
   Utilisé par Attijari Mobile, CIH BANK et Wafacash.
   Toute la configuration vient de window.BANK (défini dans la page).
   Fonctions : ouverture de compte, code secret, solde, virements
   inter-applications (Wave + 3 banques), génération de cartes
   virtuelles, RIB/IBAN, factures, recharges, historique,
   espace administrateur.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const B = window.BANK;

/* ── Comptes administrateurs (identifiants de connexion) ── */
const ADMINS = {
  attijari: { phone: '600000001', pin: '1234', prenom: 'Admin', nom: 'Attijari' },
  cih:      { phone: '600000002', pin: '1234', prenom: 'Admin', nom: 'CIH' },
  wafacash: { phone: '600000003', pin: '1234', prenom: 'Admin', nom: 'Wafacash' },
};
const ADMIN = ADMINS[B.key] || { phone: '600000009', pin: '1234', prenom: 'Admin', nom: B.name };

/* ── Registres de toutes les applications PayZone (relations entre les 4) ── */
const APPS = [
  { key: 'wave',     label: 'Wave',            store: 'wave_accounts',        dial: '+225', symbol: 'F'   },
  { key: 'attijari', label: 'Attijari Mobile', store: 'pz_attijari_accounts', dial: '+212', symbol: 'DH'  },
  { key: 'cih',      label: 'CIH BANK',        store: 'pz_cih_accounts',      dial: '+212', symbol: 'MAD' },
  { key: 'wafacash', label: 'Wafacash',        store: 'pz_wafacash_accounts', dial: '+212', symbol: 'DH'  },
];
const STORE   = 'pz_' + B.key + '_accounts';
const SESSION = 'pz_' + B.key + '_session';
const ACTIVITY= 'pz_' + B.key + '_activity';
const PIN_TIMEOUT = 60 * 60 * 1000;

/* ── Utilitaires ── */
const $  = id => document.getElementById(id);
const digits = s => (s || '').replace(/\D/g, '');
const norm = s => { let p = digits(s); if (p.length > 12) p = p.slice(-12); return p.replace(/^0+/, ''); };
const money = n => (n < 0 ? '-' : '') + Math.abs(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  .replace(/[\u202f\s]/g, '.').replace(/,/, ',');
const fmt = n => money(n) + ' ' + B.symbol;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const js  = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const fullName = a => ((a.prenom || '') + ' ' + (a.nom || '')).trim();
const MOIS = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
const nowLabel = (d) => { d = d || new Date();
  return `${MOIS[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const ref = p => p + Date.now().toString().slice(-8);

/* ── Base locale ── */
const DB = {
  all(store) { try { return JSON.parse(localStorage.getItem(store || STORE) || '[]'); } catch (e) { return []; } },
  save(list, store) { localStorage.setItem(store || STORE, JSON.stringify(list)); },
  session() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } },
  setSession(phone) { localStorage.setItem(SESSION, JSON.stringify({ phone: norm(phone) })); },
  clear() { localStorage.removeItem(SESSION); localStorage.removeItem(ACTIVITY); },
  activity() { return parseInt(localStorage.getItem(ACTIVITY) || '0', 10); },
  touch() { localStorage.setItem(ACTIVITY, Date.now().toString()); },
};
const find = phone => DB.all().find(a => norm(a.phone) === norm(phone));
function persist(acc) {
  acc.phone = norm(acc.phone);
  const all = DB.all();
  const i = all.findIndex(a => norm(a.phone) === acc.phone);
  if (i >= 0) all[i] = acc; else all.push(acc);
  DB.save(all);
}
/* Annuaire inter-applications : retrouve un compte dans les 4 registres */
function directory() {
  const out = [];
  APPS.forEach(app => DB.all(app.store).forEach(a => out.push({ app, acc: a })));
  return out;
}
function findAnywhere(phone) {
  const p = norm(phone);
  return directory().find(e => norm(e.acc.phone) === p) || null;
}
function creditExternal(entry, amount, from, note, stamp) {
  const list = DB.all(entry.app.store);
  const i = list.findIndex(a => norm(a.phone) === norm(entry.acc.phone));
  if (i < 0) return;
  const a = list[i];
  a.balance = (Number(a.balance) || 0) + amount;
  a.txs = a.txs || [];
  a.txs.unshift({ icon: '⬆️', title: `Reçu de ${from}`, person: from, phone: me.phone, code: B.dial,
    amount: amount, date: nowLabel(), sortAt: stamp, balanceAfter: a.balance, ref: ref('R'), note: note || `Via ${B.name}` });
  list[i] = a;
  DB.save(list, entry.app.store);
}

/* ── État ── */
let me = null, phoneBuf = '', pinBuf = '', pvBuf = '', balVisible = false;
let flow = null, currentCard = null, adminTarget = null, adminEditIdx = null, serviceCfg = null;

function reload() { const s = DB.session(); me = s ? (find(s.phone) || null) : null; }
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id); if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
  const tabs = { 's-home': 0, 's-cards': 1, 's-history': 2, 's-menu': 3 };
  document.querySelectorAll('.tabbar div').forEach((d, i) => d.classList.toggle('on', tabs[id] === i));
  $('tabbar').style.display = ['s-home','s-cards','s-history','s-menu'].includes(id) ? 'flex' : 'none';
}
function toast(msg, dur) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), dur || 2600);
}
function copy(txt) { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copié 📋'), () => toast('Copie impossible')); }

/* ── Comptes : identités bancaires ── */
function ribOf(acc) {
  const seed = digits(acc.phone).padStart(9, '0').slice(-9);
  const t = String(new Date(acc.createdAt || Date.now()).getTime()).slice(-6);
  return `${B.ribPrefix}${seed}${t}`;
}
function ibanOf(acc) {
  const r = ribOf(acc).replace(/\D/g, '').padStart(18, '0');
  return (B.ibanPrefix + r).replace(/(.{4})/g, '$1 ').trim();
}
function regNumber(acc) {
  return B.key.slice(0, 3).toUpperCase() + '-' + String(new Date(acc.createdAt || Date.now()).getTime()).slice(-7);
}
function accountsOf(acc) {
  acc.accounts = acc.accounts || [{ label: acc.accountType || B.accountTypes[0], rib: ribOf(acc), main: true }];
  return acc.accounts;
}

/* ── Génération de cartes virtuelles (algorithme de Luhn) ── */
function luhn(base) {
  let sum = 0, alt = true;
  for (let i = base.length - 1; i >= 0; i--) {
    let n = +base[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return String((10 - (sum % 10)) % 10);
}
function generatePan(network) {
  const prefix = network === 'Mastercard' ? '5' + Math.floor(1 + Math.random() * 4) : '4';
  let base = prefix;
  while (base.length < 15) base += Math.floor(Math.random() * 10);
  return base + luhn(base);
}
function newCard(product, network, plafond) {
  const d = new Date(); d.setFullYear(d.getFullYear() + 3);
  return {
    id: 'C' + Date.now(),
    product, network,
    pan: generatePan(network),
    exp: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(-2),
    cvv: String(Math.floor(100 + Math.random() * 900)),
    holder: fullName(me).toUpperCase(),
    balance: 0,
    plafond: plafond,
    active: true,
    createdAt: new Date().toISOString(),
  };
}
const panMask = p => '•••• •••• •••• ' + p.slice(-4);
const panSpaced = p => p.replace(/(.{4})/g, '$1 ').trim();

/* ══════════ CONSTRUCTION DE L'INTERFACE ══════════ */
function keypad(prefix) {
  let h = '<div class="keypad">';
  for (let i = 1; i <= 9; i++) h += `<button class="key" onclick="${prefix}Key('${i}')">${i}</button>`;
  h += `<button class="key" onclick="${prefix}Del()">⌫</button>`;
  h += `<button class="key" onclick="${prefix}Key('0')">0</button>`;
  h += `<button class="key" style="visibility:hidden"></button></div>`;
  return h;
}
function head(title, back) {
  return `<div class="topbar"><button class="back" onclick="${back || 'BankApp.home()'}">‹</button><h2>${esc(title)}</h2></div>`;
}

function buildUI() {
  document.title = B.name;
  const r = document.documentElement.style;
  r.setProperty('--pri', B.primary); r.setProperty('--pri-d', B.primaryDark);
  r.setProperty('--soft', B.soft); r.setProperty('--ink', B.ink);
  r.setProperty('--card-a', B.cardA); r.setProperty('--card-b', B.cardB);

  const app = document.createElement('div');
  app.id = 'app';
  app.innerHTML = `
  <!-- SPLASH -->
  <div class="screen" id="s-splash">
    <div>
      <div class="splash-logo"><img src="${B.logo}" alt="${esc(B.name)}"/></div>
      <div class="splash-name">${esc(B.name)}</div>
      <div class="splash-legal">${esc(B.legal)}</div>
      <div class="splash-slogan">${esc(B.slogan)}</div>
      <div class="splash-dots"><i></i><i></i><i></i></div>
    </div>
  </div>

  <!-- CONNEXION -->
  <div class="screen" id="s-phone"><div class="auth">
    <div class="auth-logo"><img src="${B.logo}" alt=""/></div>
    <h1>Bienvenue sur ${esc(B.name)}</h1>
    <p class="lead">Saisissez votre numéro de téléphone pour vous connecter ou ouvrir un compte en quelques minutes.</p>
    <div class="phone-box">
      <span class="dial">${B.dial}</span>
      <span class="digits" id="ph-digits"><span class="ph">${esc(B.phoneHint)}</span></span>
    </div>
    <div class="hint">Numéro à ${B.phoneLen} chiffres · ${esc(B.legal)}</div>
    ${keypad('BankApp.ph')}
    <button class="btn disabled" id="ph-btn" onclick="BankApp.next()">Continuer</button>
  </div></div>

  <!-- OUVERTURE DE COMPTE -->
  <div class="screen" id="s-register">
    ${head('Ouverture de compte', 'BankApp.toPhone()')}
    <div class="pad">
      <div class="recap" style="margin-bottom:14px"><div><span>Numéro</span><b id="reg-phone"></b></div></div>
      <div class="field"><label>Prénom</label><input id="r-prenom" placeholder="Prénom"/></div>
      <div class="field"><label>Nom</label><input id="r-nom" placeholder="Nom"/></div>
      <div class="field"><label>Civilité</label><select id="r-sexe"><option value="">Choisir…</option><option value="M">Monsieur</option><option value="F">Madame</option></select></div>
      <div class="field"><label>Email</label><input id="r-email" type="email" placeholder="nom@email.com"/></div>
      <div class="field"><label>N° de pièce d'identité (CIN / Passeport)</label><input id="r-cin" placeholder="AB123456"/></div>
      <div class="field"><label>Type de compte</label><select id="r-type">${B.accountTypes.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label>Code secret (4 chiffres)</label><input id="r-pin" inputmode="numeric" maxlength="4" placeholder="••••"/></div>
      <div class="err" id="r-err">Merci de renseigner tous les champs (code secret à 4 chiffres).</div>
      <button class="btn" onclick="BankApp.register()">Ouvrir mon compte</button>
    </div>
  </div>

  <!-- CODE SECRET -->
  <div class="screen" id="s-pin"><div class="auth" style="text-align:center">
    <div class="auth-logo" style="margin:0 auto 16px"><img src="${B.logo}" alt=""/></div>
    <h1 style="font-size:20px" id="pv-name">Bonjour</h1>
    <p class="lead">Saisissez votre code secret pour accéder à votre espace.</p>
    <div class="pin-dots" id="pv-dots"><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>
    ${keypad('BankApp.pv')}
    <button class="btn ghost" onclick="BankApp.logout()">Changer de numéro</button>
  </div></div>

  <!-- ACCUEIL -->
  <div class="screen" id="s-home">
    <div class="hero">
      <div class="hero-top">
        <div class="brandbar"><img src="${B.logo}" alt=""/></div>
        <div class="who" style="text-align:right"><b id="h-name"></b><span id="h-phone"></span></div>
        <div class="avatar" id="h-av" onclick="BankApp.profile()"></div>
      </div>
      <div class="bal-label">Solde disponible</div>
      <div class="bal-row"><div class="bal-amt" id="h-bal">••••</div>
        <button class="eye" id="h-eye" onclick="BankApp.toggleBal()">👁</button></div>
      <div class="acc-line" id="h-acc"></div>
    </div>
    <div class="sheet">
      <div class="quick" id="h-quick"></div>
      <div class="sec-h">Ma carte</div>
      <div id="h-card"></div>
      <div class="sec-h">Dernières opérations</div>
      <div class="panel" id="h-txs"></div>
    </div>
  </div>

  <!-- MES COMPTES -->
  <div class="screen" id="s-accounts">${head('Mes comptes')}<div class="pad" id="acc-body"></div></div>

  <!-- RIB -->
  <div class="screen" id="s-rib">${head('Mon RIB / IBAN')}<div class="pad" id="rib-body"></div></div>

  <!-- CARTES -->
  <div class="screen" id="s-cards">${head('Mes cartes')}<div class="pad" id="cards-body"></div></div>

  <!-- NOUVELLE CARTE -->
  <div class="screen" id="s-newcard">${head('Créer une carte virtuelle', 'BankApp.cards()')}
    <div class="pad">
      <div class="field"><label>Type de carte</label><select id="nc-product">${B.cardProducts.map(p => `<option>${esc(p)}</option>`).join('')}</select></div>
      <div class="field"><label>Réseau</label><select id="nc-net"><option>Visa</option><option>Mastercard</option></select></div>
      <div class="field"><label>Plafond mensuel (${B.symbol})</label><input id="nc-plafond" inputmode="numeric" value="10000"/></div>
      <div class="field"><label>Montant à charger depuis le compte (${B.symbol})</label><input id="nc-load" inputmode="numeric" value="0"/></div>
      <div class="helpbox"><b>Comment ça marche</b>La carte est générée instantanément avec un numéro valide (16 chiffres), une date d'expiration à 3 ans et un cryptogramme. Elle est utilisable pour vos paiements en ligne, dans la limite du montant chargé.</div>
      <button class="btn" onclick="BankApp.createCard()">Générer ma carte</button>
    </div>
  </div>

  <!-- DÉTAIL CARTE -->
  <div class="screen" id="s-card">${head('Détail de la carte', 'BankApp.cards()')}<div class="pad" id="card-body"></div></div>

  <!-- VIREMENT : bénéficiaire -->
  <div class="screen" id="s-transfer">${head('Virement / Transfert')}
    <div class="pad">
      <div class="field"><label>Rechercher un bénéficiaire</label><input id="t-search" placeholder="Nom ou numéro" oninput="BankApp.searchBenef(this.value)"/></div>
      <div class="panel" id="t-list"></div>
      <div class="sec-h">Nouveau bénéficiaire</div>
      <div class="field"><label>Nom du bénéficiaire</label><input id="t-name" placeholder="Nom complet"/></div>
      <div class="field"><label>Numéro / téléphone</label><input id="t-phone" inputmode="numeric" placeholder="${esc(B.phoneHint)}"/></div>
      <button class="btn ghost" onclick="BankApp.newBenef()">Continuer</button>
    </div>
  </div>

  <!-- MONTANT -->
  <div class="screen" id="s-amount">${head('Montant', 'BankApp.transfer()')}
    <div class="pad">
      <div class="panel" style="margin-bottom:14px"><div class="row" style="cursor:default" id="am-benef"></div></div>
      <div class="field"><label>Montant (${B.symbol})</label><input id="am-input" inputmode="numeric" placeholder="0" oninput="BankApp.onAmount()"/></div>
      <div class="field"><label>Motif (facultatif)</label><input id="am-note" placeholder="Motif de l'opération"/></div>
      <div class="recap" id="am-recap"></div>
      <div class="err" id="am-err" style="margin-top:10px">Solde insuffisant pour cette opération.</div>
      <div id="am-hint" style="font-size:12px;color:var(--grey);margin-top:10px"></div>
      <button class="btn disabled" id="am-btn" onclick="BankApp.askPin()">Valider l'opération</button>
    </div>
  </div>

  <!-- SERVICE (factures / recharge) -->
  <div class="screen" id="s-service">${head('Service')}
    <div class="pad">
      <div class="field"><label id="sv-label">Référence</label><input id="sv-ref" placeholder=""/></div>
      <div class="field"><label>Montant (${B.symbol})</label><input id="sv-amount" inputmode="numeric" placeholder="0"/></div>
      <button class="btn" onclick="BankApp.payService()">Payer</button>
    </div>
  </div>

  <!-- HISTORIQUE -->
  <div class="screen" id="s-history">${head('Historique')}<div class="pad" id="hist-body"></div></div>

  <!-- DÉTAIL OPÉRATION -->
  <div class="screen" id="s-tx">${head("Détail de l'opération", 'BankApp.history()')}<div class="pad" id="tx-body"></div></div>

  <!-- MENU -->
  <div class="screen" id="s-menu">${head('Services')}<div class="pad"><div class="panel" id="menu-body"></div>
    <button class="btn ghost" style="margin-top:18px" onclick="BankApp.profile()">Mon profil</button>
    <button class="btn dark" onclick="BankApp.logout()">Se déconnecter</button></div></div>

  <!-- PROFIL -->
  <div class="screen" id="s-profile">${head('Mon profil')}<div class="pad" id="pr-body"></div></div>

  <!-- ADMIN -->
  <div class="screen" id="s-admin">${head('Espace administrateur')}<div class="pad" id="admin-body"></div></div>

  <!-- MODALES -->
  <div class="modal" id="m-pin"><div class="box">
    <h3>Confirmation</h3><p class="sub">Saisissez votre code secret pour valider l'opération.</p>
    <div class="pin-dots" id="pin-dots"><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>
    ${keypad('BankApp.pin')}
    <button class="btn ghost" onclick="BankApp.closePin()">Annuler</button>
  </div></div>

  <div class="modal" id="m-success"><div class="box">
    <div style="text-align:center;padding:6px 0 14px">
      <div style="font-size:46px">✅</div>
      <h3 id="sc-title" style="margin-top:8px">Opération réussie</h3>
      <div style="font-size:30px;font-weight:800;color:var(--pri);margin-top:8px" id="sc-amount"></div>
      <div style="color:var(--grey);font-size:13px" id="sc-to"></div>
    </div>
    <div class="recap" id="sc-recap"></div>
    <button class="btn" onclick="BankApp.closeSuccess()">Terminer</button>
  </div></div>

  <div class="modal" id="m-credit"><div class="box">
    <h3 id="cr-title">Créditer</h3><p class="sub" id="cr-user"></p>
    <div class="field"><label>Montant (${B.symbol})</label><input id="cr-amount" inputmode="numeric" placeholder="0"/></div>
    <div class="field"><label>Libellé</label><input id="cr-note" placeholder="Crédit administrateur"/></div>
    <button class="btn" onclick="BankApp.doCredit()">Créditer le compte</button>
    <button class="btn ghost" onclick="BankApp.closeCredit()">Annuler</button>
  </div></div>

  <div class="modal" id="m-tx"><div class="box">
    <h3 id="atx-title">Ajouter une opération</h3><p class="sub" id="atx-user"></p>
    <div class="field"><label>Libellé</label><input id="atx-label" placeholder="Ex. Virement reçu"/></div>
    <div class="field"><label>Contrepartie</label><input id="atx-person" placeholder="Nom / société"/></div>
    <div class="field"><label>Icône</label><select id="atx-icon">${['🏦','💳','⇄','🧾','📱','🛒','💸','⛽','🍽️','🏥','🎓','✈️','💡','💧','🏠','🎁'].map(i => `<option>${i}</option>`).join('')}</select></div>
    <div class="field"><label>Sens</label><select id="atx-sign"><option value="+">Crédit (entrée)</option><option value="-">Débit (sortie)</option></select></div>
    <div class="field"><label>Montant (${B.symbol})</label><input id="atx-amount" inputmode="numeric" placeholder="0"/></div>
    <div class="field"><label>Date et heure</label><input id="atx-date" type="datetime-local"/></div>
    <button class="btn" onclick="BankApp.saveTx()">Enregistrer</button>
    <button class="btn ghost" onclick="BankApp.closeTxModal()">Annuler</button>
  </div></div>

  <div class="tabbar" id="tabbar" style="display:none">
    <div onclick="BankApp.home()"><i>🏠</i>Accueil</div>
    <div onclick="BankApp.cards()"><i>💳</i>Cartes</div>
    <div onclick="BankApp.history()"><i>🕘</i>Historique</div>
    <div onclick="BankApp.menu()"><i>☰</i>Services</div>
  </div>
  <div class="toast" id="toast"></div>`;
  document.body.appendChild(app);
}

/* ══════════ DÉMARRAGE ══════════ */
function init() {
  buildUI();
  reload();
  go('s-splash');
  const delay = me ? 900 : 2200;
  setTimeout(afterSplash, delay);
  document.addEventListener('click', DB.touch);
}
function afterSplash() {
  reload();
  if (me) {
    const idle = Date.now() - DB.activity();
    if (DB.activity() && idle < PIN_TIMEOUT) { DB.touch(); home(); }
    else showPin();
  } else go('s-phone');
}

/* ── Saisie du numéro ── */
function phKey(k) { if (phoneBuf.length >= B.phoneLen) return; phoneBuf += k; drawPhone(); }
function phDel() { phoneBuf = phoneBuf.slice(0, -1); drawPhone(); }
function drawPhone() {
  const d = $('ph-digits');
  d.innerHTML = phoneBuf ? esc(phoneBuf.replace(/(\d{2})(?=\d)/g, '$1 ')) : `<span class="ph">${esc(B.phoneHint)}</span>`;
  $('ph-btn').classList.toggle('disabled', phoneBuf.length < 6);
}
function next() {
  if (phoneBuf.length < 6) return;
  const phone = norm(phoneBuf);
  if (phone === norm(ADMIN.phone)) { ensureAdmin(); DB.setSession(phone); reload(); showPin(); return; }
  if (find(phone)) { DB.setSession(phone); reload(); showPin(); }
  else { $('reg-phone').textContent = B.dial + ' ' + phoneBuf.replace(/(\d{2})(?=\d)/g, '$1 '); go('s-register'); }
}
function toPhone() { phoneBuf = ''; drawPhone(); go('s-phone'); }

function ensureAdmin() {
  let a = find(ADMIN.phone);
  if (a) return a;
  a = {
    prenom: ADMIN.prenom, nom: ADMIN.nom, sexe: 'M', email: 'admin@' + B.key + '.ma', cin: 'ADMIN',
    phone: norm(ADMIN.phone), pin: ADMIN.pin, balance: 0, isAdmin: true,
    accountType: 'Compte administrateur', cards: [], txs: [], createdAt: new Date().toISOString(),
  };
  a.accounts = [{ label: 'Compte administrateur', rib: ribOf(a), main: true }];
  persist(a);
  return a;
}

/* ── Ouverture de compte ── */
function register() {
  const v = id => ($(id).value || '').trim();
  const pin = digits(v('r-pin'));
  if (!v('r-prenom') || !v('r-nom') || !v('r-sexe') || !v('r-email') || !v('r-cin') || pin.length !== 4) {
    $('r-err').classList.add('show'); return;
  }
  const acc = {
    prenom: v('r-prenom'), nom: v('r-nom'), sexe: v('r-sexe'), email: v('r-email'), cin: v('r-cin'),
    phone: norm(phoneBuf), pin, balance: 0, isAdmin: false,
    accountType: v('r-type'), cards: [], txs: [], createdAt: new Date().toISOString(),
  };
  acc.accounts = [{ label: acc.accountType, rib: ribOf(acc), main: true }];
  persist(acc);
  DB.setSession(acc.phone); DB.touch(); reload();
  home();
  toast(`Compte ouvert ✅ ${B.name} · ${fullName(acc)}`, 3500);
}

/* ── Code secret ── */
function showPin() {
  pvBuf = ''; drawPv();
  const s = DB.session(); const a = s ? find(s.phone) : null;
  $('pv-name').textContent = a ? 'Bonjour ' + a.prenom : 'Bonjour';
  go('s-pin');
}
function drawPv() { $('pv-dots').querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('on', i < pvBuf.length)); }
function pvKey(k) {
  if (pvBuf.length >= 4) return;
  pvBuf += k; drawPv();
  if (pvBuf.length === 4) setTimeout(() => {
    reload();
    if (!me || pvBuf !== me.pin) { toast('Code secret incorrect ❌'); pvBuf = ''; drawPv(); return; }
    DB.touch(); home();
  }, 180);
}
function pvDel() { pvBuf = pvBuf.slice(0, -1); drawPv(); }
function logout() { DB.clear(); me = null; phoneBuf = ''; drawPhone(); go('s-phone'); }

/* ══════════ ACCUEIL ══════════ */
function home() {
  reload();
  if (!me) { go('s-phone'); return; }
  me.cards = me.cards || []; me.txs = me.txs || [];
  $('h-name').textContent = fullName(me);
  $('h-phone').textContent = B.dial + ' ' + me.phone;
  $('h-av').textContent = (me.prenom[0] || '?').toUpperCase();
  $('h-bal').innerHTML = balVisible
    ? `${esc(money(me.balance))}<span class="bal-cur">${esc(B.symbol)}</span>`
    : `••••••<span class="bal-cur">${esc(B.symbol)}</span>`;
  $('h-eye').textContent = balVisible ? '🙈' : '👁';
  $('h-acc').textContent = (me.isAdmin ? '⚡ Administrateur · ' : '') + accountsOf(me)[0].label + ' · ' + ribOf(me);

  const q = B.quick.concat(me.isAdmin ? [{ icon: '⚡', label: 'Administration', action: 'admin' }] : []);
  $('h-quick').innerHTML = q.map((a, i) => `
    <div class="q" onclick="BankApp.action(${i})"><div class="ic">${a.icon}</div><span>${esc(a.label)}</span></div>`).join('');
  quickRef = q;

  const c = me.cards.find(x => x.active) || me.cards[0];
  $('h-card').innerHTML = c ? cardHTML(c, true) : `
    <div class="panel"><div class="row" onclick="BankApp.newCardScreen()">
      <div class="ic">💳</div><div class="mid"><b>Créer ma carte virtuelle</b><span>${esc(B.cardProducts[0])}</span></div><div class="arrow">›</div></div></div>`;

  const txs = me.txs.slice(0, 6);
  $('h-txs').innerHTML = txs.length ? txs.map((t, i) => txRow(t, i)).join('')
    : '<div class="empty"><div class="big">📭</div><div style="margin-top:8px">Aucune opération pour le moment</div></div>';
  go('s-home');
}
let quickRef = [];
function toggleBal() { balVisible = !balVisible; home(); }
function txRow(t, i) {
  return `<div class="tx" onclick="BankApp.openTx(${i})">
    <div class="ic">${t.icon || '•'}</div>
    <div class="mid"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.date)}${t.person ? ' • ' + esc(t.person) : ''}</div></div>
    <div class="a ${t.amount < 0 ? 'neg' : 'pos'}">${esc(fmt(t.amount))}</div></div>`;
}
function action(i) { runAction(quickRef[i]); }
function runAction(a) {
  if (!a) return;
  switch (a.action) {
    case 'transfer': transfer(); break;
    case 'newcard':  newCardScreen(); break;
    case 'cards':    cards(); break;
    case 'accounts': accounts(); break;
    case 'rib':      rib(); break;
    case 'history':  history_(); break;
    case 'admin':    admin(); break;
    case 'service':  openService(a); break;
    default: toast('Service bientôt disponible');
  }
}

/* ══════════ COMPTES / RIB ══════════ */
function accounts() {
  reload();
  const list = accountsOf(me);
  $('acc-body').innerHTML = list.map(a => `
    <div class="admin-card">
      <div style="font-size:12px;font-weight:800;color:var(--grey);text-transform:uppercase;letter-spacing:.8px">${esc(a.label)}</div>
      <div style="font-size:27px;font-weight:800;margin:6px 0 2px">${esc(fmt(me.balance))}</div>
      <div style="font-size:12px;color:var(--grey)">RIB ${esc(a.rib)}</div>
      <div class="admin-actions">
        <button class="mini solid" onclick="BankApp.transfer()">Virement</button>
        <button class="mini" onclick="BankApp.rib()">Mon RIB</button>
        <button class="mini" onclick="BankApp.history()">Historique</button>
      </div>
    </div>`).join('') + `
    <div class="helpbox"><b>Ouvrir un compte supplémentaire</b>Choisissez le type de compte puis validez.</div>
    <div class="field"><select id="acc-new">${B.accountTypes.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
    <button class="btn ghost" onclick="BankApp.addAccount()">Ouvrir ce compte</button>`;
  go('s-accounts');
}
function addAccount() {
  const label = $('acc-new').value;
  accountsOf(me).push({ label, rib: ribOf(me) + String(me.accounts.length + 1) });
  persist(me); reload(); accounts(); toast('Compte ouvert ✅');
}
function rib() {
  reload();
  const r = ribOf(me), ib = ibanOf(me);
  $('rib-body').innerHTML = `
    <div class="recap">
      <div><span>Titulaire</span><b>${esc(fullName(me))}</b></div>
      <div><span>Banque</span><b>${esc(B.legal)}</b></div>
      <div><span>Type de compte</span><b>${esc(accountsOf(me)[0].label)}</b></div>
      <div><span>RIB</span><b>${esc(r)}</b></div>
      <div><span>IBAN</span><b>${esc(ib)}</b></div>
      <div><span>BIC / SWIFT</span><b>${esc(B.ribPrefix)}MAMC</b></div>
      <div><span>Téléphone</span><b>${B.dial} ${esc(me.phone)}</b></div>
      <div><span>N° d'inscription</span><b>${esc(regNumber(me))}</b></div>
    </div>
    <button class="btn ghost" onclick="BankApp.copy('${js(ib)}')">📋 Copier l'IBAN</button>
    <button class="btn ghost" onclick="BankApp.copy('${js(r)}')">📋 Copier le RIB</button>`;
  go('s-rib');
}

/* ══════════ CARTES ══════════ */
function cardHTML(c, compact) {
  return `<div class="bankcard ${c.active ? '' : 'frozen'}" onclick="BankApp.openCard('${c.id}')">
    <div class="bc-top"><div class="bc-prod">${esc(c.product)}</div><div class="bc-net">${esc(c.network)}</div></div>
    <div class="chip"></div>
    <div class="bc-pan">${esc(compact ? panMask(c.pan) : panSpaced(c.pan))}</div>
    <div class="bc-bot">
      <div><span>Titulaire</span><b>${esc(c.holder)}</b></div>
      <div><span>Expire</span><b>${esc(c.exp)}</b></div>
      <div><span>Solde</span><b>${esc(fmt(c.balance))}</b></div>
    </div></div>`;
}
function cards() {
  reload(); me.cards = me.cards || [];
  $('cards-body').innerHTML = (me.cards.length
    ? me.cards.map(c => cardHTML(c, true)).join('')
    : `<div class="empty"><div class="big">💳</div><div style="margin-top:8px">Aucune carte pour le moment</div></div>`)
    + `<button class="btn" onclick="BankApp.newCardScreen()">＋ Créer une carte virtuelle</button>`;
  go('s-cards');
}
function newCardScreen() { reload(); go('s-newcard'); }
function createCard() {
  reload();
  const plafond = parseInt(digits($('nc-plafond').value) || '0', 10);
  const load = parseInt(digits($('nc-load').value) || '0', 10);
  if (!me.isAdmin && load > me.balance) { toast('Solde insuffisant pour charger la carte'); return; }
  const c = newCard($('nc-product').value, $('nc-net').value, plafond);
  if (load > 0) {
    c.balance = load;
    if (!me.isAdmin) me.balance -= load;
    me.txs.unshift({ icon: '💳', title: 'Chargement carte ' + c.product, person: c.product, amount: -load,
      date: nowLabel(), sortAt: Date.now(), balanceAfter: me.balance, ref: ref('CB'), note: 'Carte ' + panMask(c.pan) });
  }
  me.cards = me.cards || []; me.cards.unshift(c);
  me.txs.unshift({ icon: '💳', title: 'Création carte ' + c.product, person: B.name, amount: 0,
    date: nowLabel(), sortAt: Date.now(), balanceAfter: me.balance, ref: ref('CB'), note: panMask(c.pan) });
  persist(me); reload();
  toast('Carte générée ✅'); openCard(c.id);
}
function openCard(id) {
  reload();
  const c = (me.cards || []).find(x => x.id === id);
  if (!c) { cards(); return; }
  currentCard = id;
  $('card-body').innerHTML = cardHTML(c, false) + `
    <div class="recap">
      <div><span>Numéro de carte</span><b>${esc(panSpaced(c.pan))}</b></div>
      <div><span>Expiration</span><b>${esc(c.exp)}</b></div>
      <div><span>Cryptogramme (CVV)</span><b>${esc(c.cvv)}</b></div>
      <div><span>Titulaire</span><b>${esc(c.holder)}</b></div>
      <div><span>Réseau</span><b>${esc(c.network)}</b></div>
      <div><span>Solde de la carte</span><b>${esc(fmt(c.balance))}</b></div>
      <div><span>Plafond mensuel</span><b>${esc(fmt(c.plafond))}</b></div>
      <div><span>Statut</span><b><span class="badge ${c.active ? 'on' : 'off'}">${c.active ? 'ACTIVE' : 'BLOQUÉE'}</span></b></div>
      <div><span>Créée le</span><b>${new Date(c.createdAt).toLocaleDateString('fr-FR')}</b></div>
    </div>
    <div class="field" style="margin-top:14px"><label>Recharger la carte (${esc(B.symbol)})</label><input id="cd-load" inputmode="numeric" placeholder="0"/></div>
    <button class="btn" onclick="BankApp.loadCard()">Recharger depuis le compte</button>
    <button class="btn ghost" onclick="BankApp.toggleCard()">${c.active ? '🔒 Bloquer la carte' : '🔓 Débloquer la carte'}</button>
    <button class="btn ghost" onclick="BankApp.copy('${js(c.pan)}')">📋 Copier le numéro</button>
    <button class="btn dark" onclick="BankApp.deleteCard()">🗑️ Supprimer la carte</button>`;
  go('s-card');
}
function loadCard() {
  reload();
  const c = me.cards.find(x => x.id === currentCard);
  const v = parseInt(digits($('cd-load').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  if (!me.isAdmin && v > me.balance) { toast('Solde insuffisant'); return; }
  if (!me.isAdmin) me.balance -= v;
  c.balance += v;
  me.txs.unshift({ icon: '💳', title: 'Rechargement carte', person: c.product, amount: -v, date: nowLabel(),
    sortAt: Date.now(), balanceAfter: me.balance, ref: ref('CB'), note: panMask(c.pan) });
  persist(me); reload(); openCard(c.id); toast('Carte rechargée ✅');
}
function toggleCard() {
  reload();
  const c = me.cards.find(x => x.id === currentCard);
  c.active = !c.active; persist(me); reload(); openCard(c.id);
  toast(c.active ? 'Carte débloquée 🔓' : 'Carte bloquée 🔒');
}
function deleteCard() {
  reload();
  const c = me.cards.find(x => x.id === currentCard);
  if (!confirm('Supprimer définitivement cette carte ?')) return;
  if (c.balance > 0) { me.balance += c.balance;
    me.txs.unshift({ icon: '💳', title: 'Remboursement carte', person: c.product, amount: c.balance, date: nowLabel(),
      sortAt: Date.now(), balanceAfter: me.balance, ref: ref('CB'), note: panMask(c.pan) }); }
  me.cards = me.cards.filter(x => x.id !== c.id);
  persist(me); reload(); cards(); toast('Carte supprimée 🗑️');
}

/* ══════════ VIREMENTS (inter-applications) ══════════ */
function transfer() { reload(); $('t-search').value = ''; $('t-name').value = ''; $('t-phone').value = ''; searchBenef(''); go('s-transfer'); }
function searchBenef(q) {
  const all = directory().filter(e => !(e.app.key === B.key && norm(e.acc.phone) === norm(me.phone)));
  const f = all.filter(e => {
    if (!q) return true;
    const s = q.toLowerCase();
    return fullName(e.acc).toLowerCase().includes(s) || norm(e.acc.phone).includes(digits(q));
  }).slice(0, 40);
  $('t-list').innerHTML = f.length ? f.map(e => `
    <div class="list-item" onclick="BankApp.pick('${js(e.acc.phone)}','${js(fullName(e.acc))}','${e.app.key}')">
      <div class="li-av">${esc((e.acc.prenom || '?')[0].toUpperCase())}</div>
      <div><div class="li-name">${esc(fullName(e.acc))}</div><div class="li-sub">${e.app.dial} ${esc(e.acc.phone)}</div></div>
      <span class="tag">${esc(e.app.label)}</span>
    </div>`).join('') : `<div class="empty">Aucun bénéficiaire trouvé.<br/>Utilisez « Nouveau bénéficiaire » ci-dessous.</div>`;
}
function pick(phone, name, appKey) {
  flow = { to: { phone, name, appKey }, kind: 'transfer' };
  openAmount();
}
function newBenef() {
  const name = $('t-name').value.trim(), phone = norm($('t-phone').value);
  if (name.length < 2 || phone.length < 6) { toast('Nom et numéro requis'); return; }
  const e = findAnywhere(phone);
  flow = { to: { phone, name: e ? fullName(e.acc) : name, appKey: e ? e.app.key : null }, kind: 'transfer' };
  openAmount();
}
function openService(cfg) {
  serviceCfg = cfg;
  $('sv-label').textContent = cfg.field || 'Référence';
  $('sv-ref').placeholder = cfg.placeholder || '';
  $('sv-ref').value = ''; $('sv-amount').value = '';
  document.querySelector('#s-service .topbar h2').textContent = cfg.name || cfg.label || 'Service';
  go('s-service');
}
function payService() {
  reload();
  const r = $('sv-ref').value.trim();
  const v = parseInt(digits($('sv-amount').value) || '0', 10);
  if (!r || !v) { toast('Référence et montant requis'); return; }
  flow = { kind: 'service', to: { name: serviceCfg.name || serviceCfg.label, phone: r, appKey: null }, amount: v, fee: 0, note: r };
  askPin();
}
function openAmount() {
  const dest = flow.to;
  const target = dest.appKey ? APPS.find(a => a.key === dest.appKey) : null;
  $('am-benef').innerHTML = `<div class="ic">${dest.appKey && dest.appKey !== B.key ? '🌍' : '👤'}</div>
    <div class="mid"><b>${esc(dest.name)}</b><span>${esc((target ? target.dial : B.dial) + ' ' + dest.phone)}${target ? ' · ' + esc(target.label) : ' · Bénéficiaire externe'}</span></div>`;
  $('am-input').value = ''; $('am-note').value = ''; $('am-recap').innerHTML = '';
  $('am-err').classList.remove('show'); $('am-btn').classList.add('disabled');
  $('am-hint').textContent = me.isAdmin ? '⚡ Administrateur — solde illimité' : 'Solde disponible : ' + fmt(me.balance);
  go('s-amount');
}
function onAmount() {
  const v = parseInt(digits($('am-input').value) || '0', 10);
  const fee = Math.round(v * (B.feeRate || 0) * 100) / 100;
  flow.amount = v; flow.fee = fee;
  $('am-recap').innerHTML = v ? `
    <div><span>Montant</span><b>${esc(fmt(v))}</b></div>
    <div><span>Frais</span><b>${fee === 0 ? 'Sans frais' : esc(fmt(fee))}</b></div>
    <div><span>Total débité</span><b>${esc(fmt(v + fee))}</b></div>
    ${me.isAdmin ? '<div><span>Mode</span><b>⚡ Illimité</b></div>' : `<div><span>Nouveau solde</span><b>${esc(fmt(me.balance - v - fee))}</b></div>`}` : '';
  const insuf = !me.isAdmin && v > 0 && v + fee > me.balance;
  $('am-err').classList.toggle('show', insuf);
  $('am-btn').classList.toggle('disabled', !v || insuf);
}
function askPin() { pinBuf = ''; drawPinDots(); $('m-pin').classList.add('show'); }
function closePin() { $('m-pin').classList.remove('show'); }
function drawPinDots() { $('pin-dots').querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length)); }
function pinKey(k) {
  if (pinBuf.length >= 4) return;
  pinBuf += k; drawPinDots();
  if (pinBuf.length === 4) setTimeout(() => {
    if (pinBuf !== me.pin) { toast('Code secret incorrect ❌'); pinBuf = ''; drawPinDots(); return; }
    closePin(); execute();
  }, 180);
}
function pinDel() { pinBuf = pinBuf.slice(0, -1); drawPinDots(); }

function execute() {
  reload();
  const total = (flow.amount || 0) + (flow.fee || 0);
  if (!me.isAdmin && total > me.balance) { toast('Solde insuffisant'); return; }
  const r = ref(B.key.slice(0, 1).toUpperCase()), stamp = Date.now();
  const note = flow.note || ($('am-note') && $('am-note').value.trim()) || '';
  if (!me.isAdmin) me.balance -= total;
  const title = flow.kind === 'service' ? `${flow.to.name}` : `Virement à ${flow.to.name}`;
  me.txs.unshift({ icon: flow.kind === 'service' ? '🧾' : '⇄', title, person: flow.to.name, phone: flow.to.phone,
    code: B.dial, amount: -total, date: nowLabel(), sortAt: stamp, balanceAfter: me.balance, ref: r, note });
  persist(me);

  let destLabel = 'Bénéficiaire externe';
  if (flow.kind === 'transfer') {
    const e = findAnywhere(flow.to.phone);
    if (e) {
      destLabel = e.app.label;
      if (e.app.key === B.key) {
        const d = find(e.acc.phone);
        d.balance = (Number(d.balance) || 0) + flow.amount;
        d.txs = d.txs || [];
        d.txs.unshift({ icon: '⬆️', title: `Virement reçu de ${fullName(me)}`, person: fullName(me), phone: me.phone,
          code: B.dial, amount: flow.amount, date: nowLabel(), sortAt: stamp, balanceAfter: d.balance, ref: r, note });
        persist(d);
      } else {
        creditExternal(e, flow.amount, fullName(me) + ' (' + B.name + ')', note, stamp);
      }
    }
  }
  reload();
  $('sc-title').textContent = flow.kind === 'service' ? 'Paiement effectué' : 'Virement exécuté';
  $('sc-amount').textContent = fmt(flow.amount);
  $('sc-to').textContent = '→ ' + flow.to.name;
  $('sc-recap').innerHTML = `
    <div><span>Frais</span><b>${flow.fee ? esc(fmt(flow.fee)) : 'Sans frais'}</b></div>
    <div><span>Destination</span><b>${esc(destLabel)}</b></div>
    ${flow.to.phone ? `<div><span>${flow.kind === 'service' ? 'Référence' : 'Numéro'}</span><b>${esc(flow.to.phone)}</b></div>` : ''}
    ${note ? `<div><span>Motif</span><b>${esc(note)}</b></div>` : ''}
    ${me.isAdmin ? '' : `<div><span>Nouveau solde</span><b>${esc(fmt(me.balance))}</b></div>`}
    <div><span>Référence</span><b>${esc(r)}</b></div>
    <div><span>Date</span><b>${esc(nowLabel())}</b></div>`;
  $('m-success').classList.add('show');
}
function closeSuccess() { $('m-success').classList.remove('show'); home(); }

/* ══════════ HISTORIQUE ══════════ */
function history_() {
  reload();
  const txs = me.txs || [];
  const credit = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debit  = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  $('hist-body').innerHTML = `
    <div class="recap" style="margin-bottom:14px">
      <div><span>Total crédité</span><b style="color:var(--pos)">${esc(fmt(credit))}</b></div>
      <div><span>Total débité</span><b style="color:var(--neg)">${esc(fmt(debit))}</b></div>
      <div><span>Opérations</span><b>${txs.length}</b></div>
    </div>
    <div class="panel">${txs.length ? txs.map((t, i) => txRow(t, i)).join('') : '<div class="empty">Aucune opération</div>'}</div>`;
  go('s-history');
}
function openTx(i) {
  const t = me.txs[i];
  $('tx-body').innerHTML = `
    <div style="text-align:center;padding:18px 0 22px">
      <div style="font-size:44px">${t.icon || '•'}</div>
      <div style="font-size:32px;font-weight:800;color:var(--pri);margin-top:8px">${esc(fmt(t.amount))}</div>
      <div style="color:var(--grey);font-size:13px;margin-top:4px">${esc(t.date)}</div>
    </div>
    <div class="recap">
      <div><span>Libellé</span><b>${esc(t.title)}</b></div>
      <div><span>${t.amount < 0 ? 'Bénéficiaire' : 'Émetteur'}</span><b>${esc(t.person || '—')}</b></div>
      ${t.phone ? `<div><span>Référence tiers</span><b>${esc(t.phone)}</b></div>` : ''}
      ${t.note ? `<div><span>Motif</span><b>${esc(t.note)}</b></div>` : ''}
      <div><span>Solde après</span><b>${esc(fmt(t.balanceAfter))}</b></div>
      <div><span>Référence</span><b>${esc(t.ref)}</b></div>
    </div>`;
  go('s-tx');
}

/* ══════════ MENU / PROFIL ══════════ */
function menu() {
  const items = B.menu.concat(me && me.isAdmin ? [{ icon: '⚡', label: 'Espace administrateur', sub: 'Gestion des comptes clients', action: 'admin' }] : []);
  menuRef = items;
  $('menu-body').innerHTML = items.map((m, i) => `
    <div class="row" onclick="BankApp.menuAction(${i})">
      <div class="ic">${m.icon}</div><div class="mid"><b>${esc(m.label)}</b><span>${esc(m.sub || '')}</span></div><div class="arrow">›</div></div>`).join('');
  go('s-menu');
}
let menuRef = [];
function menuAction(i) { runAction(menuRef[i]); }
function profile() {
  reload();
  $('pr-body').innerHTML = `
    <div class="recap">
      <div><span>Titulaire</span><b>${esc(fullName(me))}</b></div>
      <div><span>Civilité</span><b>${me.sexe === 'M' ? 'Monsieur' : me.sexe === 'F' ? 'Madame' : '—'}</b></div>
      <div><span>Email</span><b>${esc(me.email || '—')}</b></div>
      <div><span>Pièce d'identité</span><b>${esc(me.cin || '—')}</b></div>
      <div><span>Téléphone</span><b>${B.dial} ${esc(me.phone)}</b></div>
      <div><span>Type de compte</span><b>${esc(me.isAdmin ? 'Administrateur' : accountsOf(me)[0].label)}</b></div>
      <div><span>Solde</span><b>${esc(fmt(me.balance))}</b></div>
      <div><span>Cartes</span><b>${(me.cards || []).length}</b></div>
      <div><span>Opérations</span><b>${(me.txs || []).length}</b></div>
      <div><span>Client depuis</span><b>${new Date(me.createdAt).toLocaleDateString('fr-FR')}</b></div>
    </div>
    <button class="btn ghost" onclick="BankApp.changePin()">🔑 Modifier mon code secret</button>
    ${me.isAdmin ? '<button class="btn" onclick="BankApp.admin()">⚡ Espace administrateur</button>' : ''}
    <button class="btn dark" onclick="BankApp.logout()">Se déconnecter</button>`;
  go('s-profile');
}
function changePin() {
  const p = prompt('Nouveau code secret (4 chiffres) :', '');
  if (p === null) return;
  const pin = digits(p);
  if (pin.length !== 4) { toast('4 chiffres requis'); return; }
  me.pin = pin; persist(me); reload(); toast('Code secret modifié ✅');
}

/* ══════════ ADMINISTRATION ══════════ */
function admin() {
  reload();
  if (!me || !me.isAdmin) { toast('Accès réservé'); return; }
  const users = DB.all().slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const fonds = users.filter(u => !u.isAdmin).reduce((s, u) => s + (Number(u.balance) || 0), 0);
  const cartes = users.reduce((s, u) => s + (u.cards || []).length, 0);
  $('admin-body').innerHTML = `
    <div class="admin-card" style="text-align:center">
      <div style="font-size:11px;font-weight:800;color:var(--grey);text-transform:uppercase;letter-spacing:1px">Encours clients ${esc(B.name)}</div>
      <div style="font-size:30px;font-weight:800;color:var(--pri);margin-top:6px">${esc(fmt(fonds))}</div>
      <div style="font-size:12px;color:var(--grey);margin-top:4px">${users.length} compte(s) · ${cartes} carte(s) émise(s)</div>
    </div>
    <div class="helpbox"><b>Mode d'emploi</b>
      • <b>Créditer</b> : ajouter des fonds au compte client.<br/>
      • <b>＋ Opération</b> : créer une opération (libellé, contrepartie, icône, date, montant).<br/>
      • <b>Modifier / Supprimer</b> sur chaque ligne d'opération.<br/>
      • <b>Solde</b>, <b>Code secret</b>, <b>Infos client</b>, <b>Supprimer le compte</b>.
    </div>
    <div class="sec-h">Comptes clients</div>` +
    (users.length ? users.map(u => `
      <div class="admin-card">
        <div class="admin-head">
          <div class="li-av">${esc((u.prenom || '?')[0].toUpperCase())}</div>
          <div style="flex:1">
            <div style="font-weight:800">${esc(fullName(u))}${u.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</div>
            <div style="font-size:12px;color:var(--grey)">${B.dial} ${esc(u.phone)} · ${esc(u.accountType || '')}</div>
          </div>
          <div style="font-weight:800;color:var(--pri)">${esc(fmt(u.balance))}</div>
        </div>
        <div class="recap" style="margin-top:10px">
          <div><span>N° d'inscription</span><b>${esc(regNumber(u))}</b></div>
          <div><span>Email</span><b>${esc(u.email || '—')}</b></div>
          <div><span>RIB</span><b>${esc(ribOf(u))}</b></div>
          <div><span>Cartes</span><b>${(u.cards || []).length}</b></div>
          <div><span>Opérations</span><b>${(u.txs || []).length}</b></div>
        </div>
        ${(u.cards || []).length ? `<div class="sec-h" style="margin:14px 4px 8px">Cartes émises</div>` +
          u.cards.map(c => `<div class="recap" style="margin-bottom:8px">
            <div><span>${esc(c.product)} · ${esc(c.network)}</span><b>${esc(panSpaced(c.pan))}</b></div>
            <div><span>Exp / CVV</span><b>${esc(c.exp)} · ${esc(c.cvv)}</b></div>
            <div><span>Solde carte</span><b>${esc(fmt(c.balance))}</b></div>
          </div>`).join('') : ''}
        <div class="sec-h" style="margin:14px 4px 8px">Opérations</div>
        ${(u.txs || []).length ? u.txs.map((t, i) => `
          <div class="tx" style="cursor:default">
            <div class="ic">${t.icon || '•'}</div>
            <div class="mid"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.date)}${t.person ? ' • ' + esc(t.person) : ''}</div>
              <div style="margin-top:6px;display:flex;gap:6px">
                <button class="mini" onclick="BankApp.editTx('${js(u.phone)}',${i})">Modifier</button>
                <button class="mini danger" onclick="BankApp.delTx('${js(u.phone)}',${i})">Supprimer</button>
              </div></div>
            <div class="a ${t.amount < 0 ? 'neg' : 'pos'}">${esc(fmt(t.amount))}</div>
          </div>`).join('') : '<div class="empty" style="padding:14px">Aucune opération</div>'}
        <div class="admin-actions">
          <button class="mini solid" onclick="BankApp.openCredit('${js(u.phone)}')">Créditer</button>
          <button class="mini" onclick="BankApp.addTx('${js(u.phone)}')">＋ Opération</button>
          <button class="mini" onclick="BankApp.setBalance('${js(u.phone)}')">💰 Définir le solde</button>
          <button class="mini" onclick="BankApp.editInfo('${js(u.phone)}')">✏️ Infos client</button>
          <button class="mini" onclick="BankApp.resetPin('${js(u.phone)}')">🔑 Code secret</button>
          <button class="mini" onclick="BankApp.adminCard('${js(u.phone)}')">💳 Émettre une carte</button>
          <button class="mini danger" onclick="BankApp.delUser('${js(u.phone)}')">🗑️ Supprimer</button>
        </div>
      </div>`).join('') : '<div class="empty">Aucun client inscrit</div>');
  go('s-admin');
}
function recalc(acc) {
  const asc = (acc.txs || []).slice().sort((a, b) => (a.sortAt || 0) - (b.sortAt || 0));
  let bal = Number(acc.openingBalance) || 0;
  asc.forEach(t => { bal += Number(t.amount) || 0; t.balanceAfter = bal; });
  acc.balance = bal;
  acc.txs = (acc.txs || []).sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0));
}
function openCredit(phone) {
  adminTarget = phone;
  const a = find(phone);
  $('cr-title').textContent = 'Créditer ' + fullName(a);
  $('cr-user').textContent = B.dial + ' ' + a.phone + ' · Solde : ' + fmt(a.balance);
  $('cr-amount').value = ''; $('cr-note').value = '';
  $('m-credit').classList.add('show');
}
function closeCredit() { $('m-credit').classList.remove('show'); }
function doCredit() {
  const v = parseInt(digits($('cr-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  const a = find(adminTarget);
  a.balance = (Number(a.balance) || 0) + v;
  a.txs = a.txs || [];
  a.txs.unshift({ icon: '🏦', title: 'Crédit ' + B.name, person: $('cr-note').value.trim() || 'Administration ' + B.name,
    amount: v, date: nowLabel(), sortAt: Date.now(), balanceAfter: a.balance, ref: ref('AD'), note: $('cr-note').value.trim() });
  persist(a); closeCredit(); toast(`${fmt(v)} crédités ✅`); admin();
}
function addTx(phone) {
  adminTarget = phone; adminEditIdx = null;
  const a = find(phone);
  $('atx-title').textContent = 'Ajouter une opération';
  $('atx-user').textContent = fullName(a) + ' · Solde : ' + fmt(a.balance);
  $('atx-label').value = ''; $('atx-person').value = ''; $('atx-amount').value = ''; $('atx-sign').value = '+';
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  $('atx-date').value = d.toISOString().slice(0, 16);
  $('m-tx').classList.add('show');
}
function editTx(phone, i) {
  adminTarget = phone; adminEditIdx = i;
  const a = find(phone), t = a.txs[i];
  $('atx-title').textContent = 'Modifier l\'opération';
  $('atx-user').textContent = fullName(a) + ' · Solde : ' + fmt(a.balance);
  $('atx-label').value = t.title || ''; $('atx-person').value = t.person || '';
  $('atx-icon').value = t.icon || '🏦';
  $('atx-sign').value = (t.amount || 0) < 0 ? '-' : '+';
  $('atx-amount').value = String(Math.abs(t.amount || 0));
  const d = new Date(t.sortAt || Date.now()); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  $('atx-date').value = d.toISOString().slice(0, 16);
  $('m-tx').classList.add('show');
}
function closeTxModal() { $('m-tx').classList.remove('show'); }
function saveTx() {
  const a = find(adminTarget);
  const v = parseInt(digits($('atx-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  const when = $('atx-date').value ? new Date($('atx-date').value) : new Date();
  const tx = {
    icon: $('atx-icon').value,
    title: $('atx-label').value.trim() || 'Opération',
    person: $('atx-person').value.trim(),
    amount: ($('atx-sign').value === '-' ? -v : v),
    date: nowLabel(when), sortAt: when.getTime(), ref: ref('OP'), note: '',
  };
  a.txs = a.txs || [];
  if (typeof a.openingBalance !== 'number') {
    a.openingBalance = (Number(a.balance) || 0) - a.txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }
  if (adminEditIdx === null) a.txs.unshift(tx); else a.txs[adminEditIdx] = Object.assign(a.txs[adminEditIdx], tx);
  recalc(a); persist(a); closeTxModal(); toast('Opération enregistrée ✅'); admin();
}
function delTx(phone, i) {
  const a = find(phone);
  if (!confirm('Supprimer cette opération ?')) return;
  if (typeof a.openingBalance !== 'number') {
    a.openingBalance = (Number(a.balance) || 0) - (a.txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }
  a.txs.splice(i, 1); recalc(a); persist(a); toast('Opération supprimée 🗑️'); admin();
}
function setBalance(phone) {
  const a = find(phone);
  const v = prompt('Nouveau solde pour ' + fullName(a) + ' (' + B.symbol + ') :', String(a.balance || 0));
  if (v === null) return;
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
  a.openingBalance = (Number(a.openingBalance) || 0) + (n - (Number(a.balance) || 0));
  a.balance = n; recalc(a); persist(a); toast('Solde mis à jour · ' + fmt(a.balance)); admin();
}
function editInfo(phone) {
  const a = find(phone);
  const p = prompt('Prénom :', a.prenom || ''); if (p === null) return;
  const n = prompt('Nom :', a.nom || ''); if (n === null) return;
  const e = prompt('Email :', a.email || ''); if (e === null) return;
  const t = prompt('Téléphone :', a.phone || ''); if (t === null) return;
  const np = norm(t);
  if (np.length < 6) { toast('Numéro invalide'); return; }
  const others = DB.all().filter(x => norm(x.phone) !== norm(a.phone));
  if (others.some(x => norm(x.phone) === np)) { toast('Numéro déjà utilisé'); return; }
  a.prenom = p.trim() || a.prenom; a.nom = n.trim(); a.email = e.trim();
  const was = a.phone; a.phone = np;
  others.push(a); DB.save(others);
  const s = DB.session(); if (s && norm(s.phone) === norm(was)) DB.setSession(np);
  reload(); toast('Informations mises à jour ✅'); admin();
}
function resetPin(phone) {
  const a = find(phone);
  const p = prompt('Nouveau code secret (4 chiffres) pour ' + fullName(a) + ' :', '0000');
  if (p === null) return;
  const pin = digits(p);
  if (pin.length !== 4) { toast('4 chiffres requis'); return; }
  a.pin = pin; persist(a); toast('Code secret réinitialisé ✅'); admin();
}
function adminCard(phone) {
  const a = find(phone);
  const product = prompt('Type de carte :\n' + B.cardProducts.join('\n'), B.cardProducts[0]);
  if (product === null) return;
  const plafond = parseInt(digits(prompt('Plafond mensuel (' + B.symbol + ') :', '10000') || '0'), 10);
  const holder = fullName(a).toUpperCase();
  const d = new Date(); d.setFullYear(d.getFullYear() + 3);
  const net = /master/i.test(product) ? 'Mastercard' : 'Visa';
  const c = {
    id: 'C' + Date.now(), product, network: net, pan: generatePan(net),
    exp: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(-2),
    cvv: String(Math.floor(100 + Math.random() * 900)), holder, balance: 0, plafond, active: true,
    createdAt: new Date().toISOString(),
  };
  a.cards = a.cards || []; a.cards.unshift(c);
  a.txs = a.txs || [];
  a.txs.unshift({ icon: '💳', title: 'Émission carte ' + product, person: B.name, amount: 0, date: nowLabel(),
    sortAt: Date.now(), balanceAfter: a.balance, ref: ref('CB'), note: panMask(c.pan) });
  persist(a); toast('Carte émise ✅ ' + panMask(c.pan)); admin();
}
function delUser(phone) {
  const a = find(phone);
  if (!confirm('Supprimer définitivement le compte de ' + fullName(a) + ' ?')) return;
  DB.save(DB.all().filter(x => norm(x.phone) !== norm(phone)));
  toast('Compte supprimé 🗑️'); admin();
}

/* ── API publique ── */
window.BankApp = {
  phKey, phDel, next, toPhone, register, pvKey, pvDel, logout,
  home, toggleBal, action, menu, menuAction, profile, changePin,
  accounts, addAccount, rib,
  cards, newCardScreen, createCard, openCard, loadCard, toggleCard, deleteCard,
  transfer, searchBenef, pick, newBenef, onAmount, askPin, closePin, pinKey, pinDel, closeSuccess,
  payService, history: history_, openTx, copy,
  admin, openCredit, closeCredit, doCredit, addTx, editTx, closeTxModal, saveTx, delTx,
  setBalance, editInfo, resetPin, adminCard, delUser,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
