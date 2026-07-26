/* ── PayZone Afrique – Logique banque partagée (Attijari / Wafacash / CIH) ── */

const DB_BK = {
  load(key) {
    try { const r = localStorage.getItem('pz_' + key); if (r) return JSON.parse(r); } catch {}
    return {
      balance: 125000,
      txs: [
        { id: '1', label: 'Salaire',      amount: 350000, date: '12 Juil.', type: 'in'  },
        { id: '2', label: 'Facture SBEE', amount: 18500,  date: '10 Juil.', type: 'out' },
        { id: '3', label: 'Retrait GAB',  amount: 50000,  date: '08 Juil.', type: 'out' },
      ]
    };
  },
  save(key, s) { localStorage.setItem('pz_' + key, JSON.stringify(s)); }
};

function initBankApp(config) {
  let state   = DB_BK.load(config.key);
  let visible = false;
  let modal   = null;

  const fmt = n => n.toLocaleString('fr-FR') + ' F';
  const $   = id => document.getElementById(id);

  /* ── Rendu ── */
  function render() {
    $('bal-display').textContent = visible ? fmt(state.balance) : '•••••• F';
    $('bal-eye').textContent     = visible ? '🙈' : '👁';
    $('card-balance').textContent = fmt(state.balance);
    renderTxs();
  }

  function renderTxs() {
    const el = $('tx-list');
    if (!state.txs.length) {
      el.innerHTML = '<div class="tx-empty">Aucune transaction</div>';
      return;
    }
    el.innerHTML = state.txs.map(t => `
      <div class="tx-item">
        <div class="tx-icon ${t.type === 'in' ? 'tx-in' : 'tx-out'}">${t.type === 'in' ? '↙' : '↗'}</div>
        <div class="tx-info">
          <div class="tx-label">${t.label}</div>
          <div class="tx-date">${t.date}</div>
        </div>
        <div class="tx-amount ${t.type === 'in' ? 'amount-in' : 'amount-out'}">
          ${t.type === 'in' ? '+' : '-'}${fmt(t.amount)}
        </div>
      </div>`).join('');
  }

  /* ── Modal ── */
  function openModal(type) {
    modal = type;
    $('modal-amount').value = '';
    $('modal-label').value  = '';
    $('modal-label-row').style.display = type === 'withdraw' ? 'none' : 'block';
    const titles  = { send: "Envoyer de l'argent", recv: 'Recevoir un dépôt', bill: 'Payer une facture', withdraw: 'Retrait GAB' };
    const lblText = { send: 'Bénéficiaire', recv: 'Émetteur', bill: 'Facturier' };
    $('modal-title').textContent = titles[type];
    if (type !== 'withdraw') $('modal-label-title').textContent = lblText[type];
    $('tx-modal').classList.add('active');
    setTimeout(() => $('modal-sheet').classList.add('open'), 10);
  }

  function closeModal() {
    $('modal-sheet').classList.remove('open');
    setTimeout(() => $('tx-modal').classList.remove('active'), 300);
    modal = null;
  }

  function submitModal() {
    const amt = parseInt($('modal-amount').value || '0', 10);
    if (!amt || amt <= 0) { $('modal-amount').focus(); return; }
    const lb   = $('modal-label').value;
    const isOut = modal === 'send' || modal === 'bill' || modal === 'withdraw';
    const labels = { send: lb || 'Transfert', recv: lb || 'Dépôt', bill: lb || 'Paiement facture', withdraw: 'Retrait GAB' };
    const now = new Date();
    const months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    const tx = { id: Date.now().toString(), label: labels[modal], amount: amt,
                 date: now.getDate() + ' ' + months[now.getMonth()], type: isOut ? 'out' : 'in' };
    state = { balance: state.balance + (isOut ? -amt : amt), txs: [tx, ...state.txs].slice(0, 20) };
    DB_BK.save(config.key, state);
    closeModal();
    render();
  }

  /* ── Listeners ── */
  $('btn-toggle-bal').onclick = () => { visible = !visible; render(); };
  $('btn-send').onclick     = () => openModal('send');
  $('btn-recv').onclick     = () => openModal('recv');
  $('btn-bill').onclick     = () => openModal('bill');
  $('btn-withdraw').onclick = () => openModal('withdraw');
  $('modal-close').onclick  = closeModal;
  $('modal-bg').onclick     = closeModal;
  $('modal-submit').onclick = submitModal;
  $('modal-submit').style.background = config.primary;
  $('modal-submit').style.color      = config.onPrimary;

  render();
}
