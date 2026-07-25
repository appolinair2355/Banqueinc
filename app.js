// ===== STATE =====
let currentCountry = { flag: '🇨🇮', name: "Côte d'Ivoire", code: '+225' };
let selectedRecipient = { name: '', phone: '' };
let balanceVisible = false;
let activeAmountField = 'sent';
let sentRaw = '';
let receivedRaw = '';
const BALANCE = 0;

// ===== SESSION =====
function currentUser() {
  try { return JSON.parse(localStorage.getItem('wave_user') || 'null'); } catch { return null; }
}

function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';
    target.scrollTop = 0;
  }
}

function loginSubmit() {
  const phoneEl = document.getElementById('login-phone');
  const err = document.getElementById('login-error');
  const raw = (phoneEl.value || '').replace(/\D/g, '');
  if (raw.length < 8) {
    err.classList.add('show');
    phoneEl.focus();
    return;
  }
  err.classList.remove('show');
  const flag = document.getElementById('login-flag').textContent;
  const code = document.getElementById('login-code').textContent;
  const user = { phone: raw, code, flag, name: 'Utilisateur Wave' };
  localStorage.setItem('wave_user', JSON.stringify(user));
  applyUser();
  goTo('screen-home');
}

function logout() {
  localStorage.removeItem('wave_user');
  document.getElementById('login-phone').value = '';
  goTo('screen-login');
}

function applyUser() {
  const u = currentUser();
  if (!u) return;
  const pretty = u.phone.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  const phoneStr = `${u.code} ${pretty}`;
  document.getElementById('profile-phone').textContent = phoneStr;
  document.getElementById('profile-name').textContent = u.name || 'Utilisateur Wave';
  document.getElementById('profile-avatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
  updateBalanceDisplay();
}

// ===== HOME =====
function updateBalanceDisplay() {
  const el = document.getElementById('balance-display');
  const dots = document.getElementById('balance-dots-mini');
  const eye = document.getElementById('eye-icon');
  if (!el) return;
  if (balanceVisible) {
    el.textContent = BALANCE.toLocaleString('fr-FR') + ' F';
    el.style.visibility = 'visible';
    if (dots) dots.style.display = 'none';
    if (eye) eye.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>';
  } else {
    el.textContent = '';
    el.style.visibility = 'hidden';
    if (dots) dots.style.display = 'flex';
    if (eye) eye.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
}
function toggleBalance() {
  balanceVisible = !balanceVisible;
  updateBalanceDisplay();
}
function closeBanner() {
  const b = document.getElementById('update-banner');
  if (b) b.style.display = 'none';
}

// ===== CONTACTS =====
function filterContacts() {}
function selectContact(name, phone) {
  selectedRecipient = { name, phone };
  loadSendScreen();
  goTo('screen-send');
}

// ===== NEW NUMBER =====
function confirmNewRecipient() {
  const nameInput = document.getElementById('recipient-name');
  const phoneInput = document.getElementById('phone-input');
  const nameError = document.getElementById('name-error');
  if (!nameInput.value.trim()) {
    nameError.classList.add('show');
    nameInput.focus();
    return;
  }
  nameError.classList.remove('show');
  const fullPhone = currentCountry.code + ' ' + (phoneInput.value.trim() || '0X XX XX XX XX');
  selectedRecipient = { name: nameInput.value.trim(), phone: fullPhone };
  loadSendScreen();
  goTo('screen-send');
}

// ===== COUNTRY PICKER =====
function openCountryPicker() { document.getElementById('country-picker').classList.remove('hidden'); }
function closeCountryPicker() { document.getElementById('country-picker').classList.add('hidden'); }
function selectCountry(flag, name, code) {
  document.querySelectorAll('.check-mark').forEach(el => { el.textContent = ''; el.classList.remove('active'); });
  const codeKey = code.replace('+', '');
  const checkEl = document.getElementById('check-' + codeKey);
  if (checkEl) { checkEl.textContent = '✓'; checkEl.classList.add('active'); }
  currentCountry = { flag, name, code };
  const fd = document.getElementById('flag-display'); if (fd) fd.textContent = flag;
  const cd = document.getElementById('code-display'); if (cd) cd.textContent = code;
  const lf = document.getElementById('login-flag'); if (lf) lf.textContent = flag;
  const lc = document.getElementById('login-code'); if (lc) lc.textContent = code;
  closeCountryPicker();
}

// ===== SEND SCREEN =====
function loadSendScreen() {
  document.getElementById('send-recipient-name').textContent = selectedRecipient.name;
  document.getElementById('send-recipient-phone').textContent = selectedRecipient.phone;
  sentRaw = ''; receivedRaw = '';
  document.getElementById('amount-sent').value = '';
  document.getElementById('amount-received').value = '';
  updateFieldStates('sent');
  updateEnvoyerButton();
}
function updateFieldStates(active) {
  activeAmountField = active;
  const labelSent = document.getElementById('label-sent');
  const labelReceived = document.getElementById('label-received');
  const lineSent = document.querySelector('.field-underline.cyan');
  const lineReceived = document.querySelectorAll('.field-underline')[1];
  if (active === 'sent') {
    labelSent.classList.add('active'); labelReceived.classList.remove('active');
    if (lineSent) lineSent.style.background = 'var(--wave-cyan)';
    if (lineReceived) lineReceived.style.background = '#E0E0E0';
  } else {
    labelSent.classList.remove('active'); labelReceived.classList.add('active');
    if (lineSent) lineSent.style.background = '#E0E0E0';
    if (lineReceived) lineReceived.style.background = 'var(--wave-cyan)';
  }
}
function typeKey(key) {
  if (activeAmountField === 'sent') {
    if (key === '.' && sentRaw.includes('.')) return;
    if (key !== '.' && sentRaw.split('.')[0].length >= 9) return;
    sentRaw += key; updateSentDisplay(); autoCalcFromSent();
  } else {
    if (key === '.' && receivedRaw.includes('.')) return;
    if (key !== '.' && receivedRaw.split('.')[0].length >= 9) return;
    receivedRaw += key; updateReceivedDisplay(); autoCalcFromReceived();
  }
  updateEnvoyerButton();
}
function deleteKey() {
  if (activeAmountField === 'sent') { sentRaw = sentRaw.slice(0, -1); updateSentDisplay(); autoCalcFromSent(); }
  else { receivedRaw = receivedRaw.slice(0, -1); updateReceivedDisplay(); autoCalcFromReceived(); }
  updateEnvoyerButton();
}
function formatAmount(raw) {
  if (!raw || raw === '.') return raw;
  const parts = raw.split('.');
  const intPart = parseInt(parts[0], 10);
  if (isNaN(intPart)) return raw;
  const formatted = intPart.toLocaleString('fr-FR').replace(/\s/g, '.');
  return parts.length > 1 ? formatted + '.' + parts[1] : formatted;
}
function updateSentDisplay() { document.getElementById('amount-sent').value = sentRaw ? formatAmount(sentRaw) : ''; }
function updateReceivedDisplay() { document.getElementById('amount-received').value = receivedRaw ? formatAmount(receivedRaw) : ''; }
function autoCalcFromSent() {
  const v = parseFloat(sentRaw);
  if (!isNaN(v) && sentRaw !== '' && sentRaw !== '.') {
    receivedRaw = Math.floor(v * 0.99).toString(); updateReceivedDisplay();
  } else { receivedRaw = ''; document.getElementById('amount-received').value = ''; }
}
function autoCalcFromReceived() {
  const v = parseFloat(receivedRaw);
  if (!isNaN(v) && receivedRaw !== '' && receivedRaw !== '.') {
    sentRaw = Math.ceil(v / 0.99).toString(); updateSentDisplay();
  } else { sentRaw = ''; document.getElementById('amount-sent').value = ''; }
}
function updateEnvoyerButton() {
  const btn = document.getElementById('btn-envoyer'); if (!btn) return;
  if (sentRaw && parseFloat(sentRaw) > 0) btn.classList.add('ready'); else btn.classList.remove('ready');
}
function sendMoney() {
  const v = parseFloat(sentRaw);
  if (!v || v <= 0) return;
  if (v > BALANCE) { showToast('Solde insuffisant'); return; }
  const rv = parseFloat(receivedRaw) || Math.floor(v * 0.99);
  const frais = v - rv;
  document.getElementById('confirm-detail').innerHTML =
    'Vous avez envoyé <strong>' + formatAmount(sentRaw) + ' F</strong> à <strong>' + selectedRecipient.name + '</strong>.<br/>' +
    selectedRecipient.name + ' recevra <strong>' + formatAmount(receivedRaw) + ' F</strong>.<br/>' +
    'Frais Wave : <strong>' + frais.toLocaleString('fr-FR') + ' F</strong>';
  goTo('screen-confirm');
}

// ===== TOAST =====
function showToast(message) {
  const t = document.getElementById('toast');
  t.textContent = message; t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
}

// ===== INIT =====
(function init() {
  if (currentUser()) { applyUser(); goTo('screen-home'); }
  else { goTo('screen-login'); }
})();
