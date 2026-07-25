/* ===== Wave — démo web (données locales partagées entre comptes du navigateur) ===== */
const DB = {
  accounts() { try { return JSON.parse(localStorage.getItem('wave_accounts') || '[]'); } catch { return []; } },
  save(a) { localStorage.setItem('wave_accounts', JSON.stringify(a)); },
  session() { return localStorage.getItem('wave_session') || ''; },
  setSession(p) { localStorage.setItem('wave_session', p); },
};
const DEMO_CONTACTS = [
  { name: '"KIMI-Cash service"', phone: '0748548518' },
  { name: '#Pøøpä_Yääbä 😎', phone: '0798562772' },
  { name: '#instruction#', phone: '0787838373' },
  { name: '(´⊙Aden Shop⊙`)', phone: '0170620767' },
  { name: '*Atta joel*', phone: '0779552735' },
  { name: 'Kouao Desire Amangoa', phone: '0152220436' },
  { name: 'Zalle W', phone: '0150341201' },
];

let me = null;
let balVisible = false;
let flow = null;            // { kind, to:{name,phone}, amount, note }
let pinBuf = '';

const fmt = n => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fr-FR').replace(/\u202f|\s/g, '.') + 'F';
const $ = id => document.getElementById(id);
const digits = s => (s || '').replace(/\D/g, '');

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id); if (el) { el.classList.add('active'); el.scrollTop = 0; window.scrollTo(0, 0); }
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function findAcc(phone) { return DB.accounts().find(a => a.phone === digits(phone)); }
function persist(acc) {
  const all = DB.accounts(); const i = all.findIndex(a => a.phone === acc.phone);
  if (i >= 0) all[i] = acc; else all.push(acc); DB.save(all);
}
function reload() { me = findAcc(DB.session()) || null; }
function fullName(a) { return (a.prenom + ' ' + a.nom).trim(); }
function nowLabel() {
  const d = new Date();
  const mois = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  return `${mois[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ===== AUTH ===== */
function loginSubmit() {
  const acc = findAcc($('li-phone').value);
  if (!acc || acc.password !== $('li-pass').value) { $('li-err').classList.add('show'); return; }
  $('li-err').classList.remove('show');
  DB.setSession(acc.phone); reload(); refreshHome(); go('s-home');
}
function signupSubmit() {
  const prenom = $('su-prenom').value.trim(), nom = $('su-nom').value.trim();
  const phone = digits($('su-phone').value), pass = $('su-pass').value, pin = digits($('su-pin').value);
  if (!prenom || !nom || phone.length < 8 || pass.length < 4 || pin.length !== 4) { $('su-err').classList.add('show'); return; }
  if (findAcc(phone)) { $('su-err').textContent = 'Ce numéro a déjà un compte'; $('su-err').classList.add('show'); return; }
  const acc = {
    prenom, nom, phone, code: '+225', password: pass, pin, balance: 0,
    coffres: [
      { name: 'Mon Coffre', emoji: '🔐', color: '#FBE4F2', amount: 0 },
      { name: 'Factures', emoji: '💡', color: '#D9EDFB', amount: 0 },
      { name: 'Fournisseurs', emoji: '🚚', color: '#FCEBC0', amount: 0 },
      { name: 'Salaires', emoji: '💸', color: '#D8F5D9', amount: 0 },
    ],
    txs: [],
  };
  persist(acc); DB.setSession(phone); reload(); refreshHome(); go('s-home');
}
function logout() { localStorage.removeItem('wave_session'); me = null; go('s-login'); }

/* ===== HOME ===== */
function toggleBal() { balVisible = !balVisible; refreshHome(); }
function refreshHome() {
  reload(); if (!me) { go('s-login'); return; }
  $('h-avatar').textContent = (me.prenom[0] || '?').toUpperCase();
  $('h-name').textContent = fullName(me);
  $('h-bal').textContent = balVisible ? fmt(me.balance) : '•••••';
  const qr = $('h-qr'); qr.innerHTML = '';
  const payload = `wave://pay?to=${me.phone}&name=${encodeURIComponent(fullName(me))}`;
  if (window.QRCode) {
    const c = document.createElement('canvas'); qr.appendChild(c);
    QRCode.toCanvas(c, payload, { width: 170, margin: 0 }, () => {});
  }
  renderTxs();
}
function renderTxs() {
  const box = $('h-txs');
  if (!me.txs.length) {
    box.innerHTML = `<div class="empty"><div class="big">📭</div><div style="margin-top:8px;font-weight:700">Aucune transaction</div><div>Vos transferts et paiements apparaîtront ici.</div></div>`;
    return;
  }
  box.innerHTML = '<div class="section-h">Transactions</div>' + me.txs.map((t, i) => `
    <div class="tx" onclick="openTx(${i})">
      <div class="tx-ic">${t.icon}</div>
      <div class="tx-main">
        <div class="tx-t">${t.title}</div>
        <div class="tx-s">${t.date} • ${t.person}</div>
      </div>
      <div class="tx-a ${t.amount < 0 ? 'neg' : 'pos'}">${fmt(t.amount)}</div>
    </div>`).join('');
}
function openTx(i) {
  const t = me.txs[i];
  $('tx-body').innerHTML = `
    <div style="text-align:center;padding:10px 0 20px">
      <div style="font-size:34px">${t.icon}</div>
      <div style="font-size:30px;font-weight:800;margin-top:8px" class="${t.amount < 0 ? '' : 'tx-a pos'}">${fmt(t.amount)}</div>
      <div style="color:var(--grey);margin-top:4px">${t.date}</div>
    </div>
    <div class="recap">
      <div><span>Type</span><b>${t.title}</b></div>
      <div><span>${t.amount < 0 ? 'Bénéficiaire' : 'Expéditeur'}</span><b>${t.person}</b></div>
      <div><span>Numéro</span><b>+225 ${t.phone || '—'}</b></div>
      ${t.note ? `<div><span>Motif</span><b>${t.note}</b></div>` : ''}
      <div><span>Solde après</span><b>${fmt(t.balanceAfter)}</b></div>
      <div><span>Référence</span><b>${t.ref}</b></div>
    </div>`;
  go('s-tx');
}

/* ===== CONTACTS / TRANSFERT ===== */
function openTransfer() { $('t-search').value = ''; renderContacts(''); go('s-transfer'); }
function renderContacts(q) {
  const accounts = DB.accounts();
  const map = new Map();
  accounts.filter(a => a.phone !== me.phone).forEach(a => map.set(a.phone, { name: fullName(a), phone: a.phone, wave: true }));
  DEMO_CONTACTS.forEach(c => { if (!map.has(digits(c.phone)) && digits(c.phone) !== me.phone) map.set(digits(c.phone), { name: c.name, phone: digits(c.phone), wave: false }); });
  const list = [...map.values()].filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(digits(q)));
  const waveOnes = list.filter(c => c.wave), others = list.filter(c => !c.wave);
  const row = c => `<div class="list-item" onclick="pickContact('${c.phone}','${c.name.replace(/'/g, "\\'")}')">
      <div class="li-av">${c.name[0] ? c.name[0].toUpperCase() : '?'}</div>
      <div><div class="li-name">${c.name}</div><div class="li-sub">${c.phone.replace(/(\d{2})(?=\d)/g, '$1 ')}</div></div>
      ${c.wave ? '<span class="wave-tag">SUR WAVE</span>' : ''}
    </div>`;
  $('t-contacts').innerHTML =
    (waveOnes.length ? `<div class="group-h">Contacts sur Wave (${waveOnes.length})</div>` + waveOnes.map(row).join('') : '') +
    (others.length ? `<div class="group-h">Autres contacts</div>` + others.map(row).join('') : '');
}
function pickContact(phone, name) { flow = { kind: 'transfer', to: { phone, name } }; openAmount(); }

function checkNewNum() {
  const ok = $('nn-name').value.trim().length > 1 && digits($('nn-phone').value).length >= 8;
  $('nn-btn').classList.toggle('disabled', !ok);
}
function confirmNewNum() {
  if ($('nn-btn').classList.contains('disabled')) return;
  const phone = digits($('nn-phone').value);
  const acc = findAcc(phone);
  flow = { kind: 'transfer', to: { phone, name: acc ? fullName(acc) : $('nn-name').value.trim() } };
  openAmount();
}
function openMerchant() { flow = { kind: 'merchant', to: { phone: '0170620767', name: 'SOLANO SERVICE' } }; openAmount(); }
function openWithdraw() { flow = { kind: 'withdraw', to: { phone: '', name: 'Retrait espèces' } }; openAmount(); }

function openAmount() {
  $('am-title').textContent = flow.kind === 'merchant' ? 'Payer marchand' : flow.kind === 'withdraw' ? 'Retrait' : 'Envoyer de l\'argent';
  $('am-to').textContent = flow.kind === 'withdraw' ? 'Retrait d\'espèces' : `À ${flow.to.name}${flow.to.phone ? ' • ' + flow.to.phone : ''}`;
  $('am-input').value = ''; $('am-recap').innerHTML = ''; $('am-err').classList.remove('show');
  $('am-bal').textContent = fmt(me.balance);
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
    <div><span>Nouveau solde</span><b>${fmt(me.balance - v - fee)}</b></div>` : '';
  const ok = v > 0 && v + fee <= me.balance;
  $('am-err').classList.toggle('show', v > 0 && v + fee > me.balance);
  $('am-btn').classList.toggle('disabled', !ok);
}

/* ===== PIN + EXECUTION ===== */
function startPin() { if ($('am-btn').classList.contains('disabled')) return; openPin(); }
function openPin() { pinBuf = ''; drawPin(); $('m-pin').classList.add('show'); }
function closePin() { $('m-pin').classList.remove('show'); }
function drawPin() { $('pin-dots').innerHTML = [0, 1, 2, 3].map(i => `<div class="pin-dot ${i < pinBuf.length ? 'on' : ''}"></div>`).join(''); }
function pinDel() { pinBuf = pinBuf.slice(0, -1); drawPin(); }
function pinKey(k) {
  if (pinBuf.length >= 4) return;
  pinBuf += k; drawPin();
  if (pinBuf.length === 4) setTimeout(() => {
    if (pinBuf !== me.pin) { toast('Code secret incorrect'); pinBuf = ''; drawPin(); return; }
    closePin(); execute();
  }, 180);
}
function execute() {
  reload();
  const total = flow.amount + (flow.fee || 0);
  if (total > me.balance) { toast('Solde insuffisant'); return; }
  const ref = 'W' + Date.now().toString().slice(-8);
  me.balance -= total;
  const titles = { transfer: `Fonds transférés vers ${flow.to.name}`, merchant: `Paiement ${flow.to.name}`, withdraw: 'Retrait d\'espèces', link: `Paiement à ${flow.to.name}` };
  const icons = { transfer: '⬇️', merchant: '🏪', withdraw: '💵', link: '🔗' };
  me.txs.unshift({
    icon: icons[flow.kind], title: titles[flow.kind], person: flow.to.name, phone: flow.to.phone,
    amount: -total, date: nowLabel(), balanceAfter: me.balance, ref, note: flow.note || '',
  });
  persist(me);

  // Crédit du destinataire s'il possède un compte Wave sur cet appareil
  const dest = flow.to.phone ? findAcc(flow.to.phone) : null;
  if (dest) {
    dest.balance += flow.amount;
    dest.txs.unshift({
      icon: '⬆️', title: `Reçu de ${fullName(me)}`, person: fullName(me), phone: me.phone,
      amount: flow.amount, date: nowLabel(), balanceAfter: dest.balance, ref, note: flow.note || '',
    });
    persist(dest);
  }
  reload();
  $('sc-title').textContent = flow.kind === 'withdraw' ? 'Retrait effectué' : 'Paiement effectué';
  $('sc-sub').textContent = `${fmt(flow.amount)} • ${flow.to.name}`;
  $('sc-recap').innerHTML = `
    <div><span>Frais</span><b>${(flow.fee || 0) === 0 ? 'Sans frais' : fmt(flow.fee)}</b></div>
    <div><span>Ancien solde</span><b>${fmt(me.balance + total)}</b></div>
    <div><span>Nouveau solde</span><b>${fmt(me.balance)}</b></div>
    <div><span>Référence</span><b>${ref}</b></div>`;
  go('s-success');
}

/* ===== COFFRE ===== */
function renderCoffres() {
  reload();
  const total = me.coffres.reduce((s, c) => s + c.amount, 0);
  $('cf-total').textContent = fmt(total);
  $('cf-list').innerHTML = me.coffres.map((c, i) => `
    <div class="coffre-card" onclick="coffreAction(${i})">
      <div class="coffre-ic" style="background:${c.color}">${c.emoji}</div>
      <div class="coffre-mid"><span class="coffre-name">${c.name}</span><span class="coffre-amt">${fmt(c.amount)}</span></div>
    </div>`).join('');
  go('s-coffre');
}
function coffreAction(i) {
  const c = me.coffres[i];
  const v = parseInt(digits(prompt(`Déposer dans « ${c.name} » (solde disponible ${fmt(me.balance)}). Montant :`, '')) || '0', 10);
  if (!v) return;
  if (v > me.balance) { toast('Solde insuffisant'); return; }
  me.balance -= v; c.amount += v;
  me.txs.unshift({ icon: '🔐', title: `Dépôt coffre ${c.name}`, person: fullName(me), phone: me.phone, amount: -v, date: nowLabel(), balanceAfter: me.balance, ref: 'C' + Date.now().toString().slice(-8) });
  persist(me); renderCoffres();
}
function addCoffre() {
  const name = (prompt('Nom du nouveau coffre :', '') || '').trim();
  if (!name) return;
  me.coffres.push({ name, emoji: '🏦', color: '#E7ECFB', amount: 0 });
  persist(me); renderCoffres();
}

/* ===== LIEN DE PAIEMENT ===== */
function openLink() { $('lk-amount').value = ''; $('lk-note').value = ''; $('lk-result').innerHTML = ''; go('s-link'); }
function createLink() {
  const v = parseInt(digits($('lk-amount').value) || '0', 10);
  if (!v) { toast('Entrez un montant'); return; }
  const note = $('lk-note').value.trim();
  const url = `${location.origin}${location.pathname}#pay=${me.phone}&amt=${v}&n=${encodeURIComponent(note)}`;
  $('lk-result').innerHTML = `<div class="link-box" id="lk-url">${url}</div>
    <button class="btn ghost" onclick="copyLink()">Copier le lien</button>`;
}
function copyLink() {
  const txt = $('lk-url').textContent;
  navigator.clipboard?.writeText(txt).then(() => toast('Lien copié'), () => toast(txt));
}
function handleHashLink() {
  const h = location.hash;
  if (!h.startsWith('#pay=')) return;
  const p = new URLSearchParams(h.slice(1));
  const payee = findAcc(p.get('pay'));
  if (!me || !payee) return;
  flow = { kind: 'link', to: { phone: payee.phone, name: fullName(payee) }, note: p.get('n') || '' };
  history.replaceState(null, '', location.pathname);
  openAmount();
  $('am-input').value = p.get('amt') || ''; onAmount();
  $('am-title').textContent = 'Lien de paiement';
}

/* ===== DIVERS ===== */
function simple(title, text) { $('sp-title').textContent = title; $('sp-text').textContent = text; go('s-simple'); }
function renderExpenses() {
  reload();
  const out = me.txs.filter(t => t.amount < 0);
  const total = out.reduce((s, t) => s + Math.abs(t.amount), 0);
  $('ex-body').innerHTML = `<div class="total-wrap"><div class="total-label">TOTAL DÉPENSÉ</div><div class="total-amt">${fmt(total)}</div></div>` +
    (out.length ? out.map(t => `<div class="tx"><div class="tx-ic">${t.icon}</div><div class="tx-main"><div class="tx-t">${t.title}</div><div class="tx-s">${t.date}</div></div><div class="tx-a neg">${fmt(t.amount)}</div></div>`).join('')
      : '<div class="empty">Aucune dépense pour le moment.</div>');
  go('s-expenses');
}
function renderProfile() {
  $('pr-body').innerHTML = `
    <div class="recap">
      <div><span>Nom</span><b>${fullName(me)}</b></div>
      <div><span>Téléphone</span><b>+225 ${me.phone}</b></div>
      <div><span>Solde</span><b>${fmt(me.balance)}</b></div>
      <div><span>Transactions</span><b>${me.txs.length}</b></div>
    </div>
    <button class="btn ghost" onclick="credit()">Recharger mon compte (démo)</button>`;
}
function credit() {
  const v = parseInt(digits(prompt('Montant du dépôt (démo) :', '10000')) || '0', 10);
  if (!v) return;
  me.balance += v;
  me.txs.unshift({ icon: '💰', title: 'Dépôt sur le compte', person: fullName(me), phone: me.phone, amount: v, date: nowLabel(), balanceAfter: me.balance, ref: 'D' + Date.now().toString().slice(-8) });
  persist(me); reload(); renderProfile(); toast('Compte rechargé');
}
document.addEventListener('click', e => {
  if (e.target.closest('#h-avatar')) setTimeout(renderProfile, 0);
});

/* ===== BOOT ===== */
reload();
if (me) { refreshHome(); go('s-home'); handleHashLink(); } else { go('s-login'); }
window.addEventListener('hashchange', handleHashLink);
