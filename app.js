// ===== STATE =====
let currentCountry = { flag: '🇨🇮', name: "Côte d'Ivoire", code: '+225' };
let selectedRecipient = { name: '', phone: '' };
let balanceVisible = true;
let activeAmountField = 'sent'; // 'sent' or 'received'
let sentRaw = '';
let receivedRaw = '';

// ===== NAVIGATION =====
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';
  }
  // Scroll to top
  if (target) target.scrollTop = 0;
}

// ===== HOME =====
function toggleBalance() {
  balanceVisible = !balanceVisible;
  const el = document.getElementById('balance-display');
  el.textContent = balanceVisible ? '2.000 F' : '••••••';
}

function closeBanner() {
  const b = document.querySelector('.update-banner');
  if (b) b.style.display = 'none';
}

// ===== TRANSFER / CONTACTS =====
function filterContacts(query) {
  const items = document.querySelectorAll('.contact-item');
  items.forEach(item => {
    const name = item.querySelector('.contact-name').textContent.toLowerCase();
    const phone = item.querySelector('.contact-phone').textContent;
    const match = name.includes(query.toLowerCase()) || phone.includes(query);
    item.style.display = match ? '' : 'none';
  });
}

function selectContact(name, phone) {
  selectedRecipient = { name, phone };
  loadSendScreen();
  goTo('screen-send');
}

// ===== NEW NUMBER SCREEN =====
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
function openCountryPicker() {
  document.getElementById('country-picker').classList.remove('hidden');
}
function closeCountryPicker() {
  document.getElementById('country-picker').classList.add('hidden');
}
function selectCountry(flag, name, code) {
  // clear all checks
  document.querySelectorAll('.check-mark').forEach(el => {
    el.textContent = '';
    el.classList.remove('active');
  });
  // set selected
  const codeKey = code.replace('+', '');
  const checkEl = document.getElementById('check-' + codeKey);
  if (checkEl) {
    checkEl.textContent = '✓';
    checkEl.classList.add('active');
  }
  currentCountry = { flag, name, code };
  document.getElementById('flag-display').textContent = flag;
  document.getElementById('code-display').textContent = code;
  closeCountryPicker();
}

// ===== SEND SCREEN =====
function loadSendScreen() {
  document.getElementById('send-recipient-name').textContent = selectedRecipient.name;
  document.getElementById('send-recipient-phone').textContent = selectedRecipient.phone;
  sentRaw = '';
  receivedRaw = '';
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
    labelSent.classList.add('active');
    labelReceived.classList.remove('active');
    if (lineSent) lineSent.style.background = 'var(--wave-cyan)';
    if (lineReceived) lineReceived.style.background = '#E0E0E0';
  } else {
    labelSent.classList.remove('active');
    labelReceived.classList.add('active');
    if (lineSent) lineSent.style.background = '#E0E0E0';
    if (lineReceived) lineReceived.style.background = 'var(--wave-cyan)';
  }
}

// Click on amount-sent field activates it
document.addEventListener('DOMContentLoaded', () => {
  const sentField = document.getElementById('amount-sent');
  const receivedField = document.getElementById('amount-received');
  if (sentField) sentField.addEventListener('click', () => updateFieldStates('sent'));
  if (receivedField) receivedField.addEventListener('click', () => updateFieldStates('received'));
});

function typeKey(key) {
  if (activeAmountField === 'sent') {
    // Prevent multiple dots
    if (key === '.' && sentRaw.includes('.')) return;
    // Max 9 digits before dot
    const parts = sentRaw.split('.');
    if (key !== '.' && parts[0].length >= 9) return;
    sentRaw += key;
    updateSentDisplay();
    // Auto-calculate received from sent
    autoCalcFromSent();
  } else {
    // Typing in received → calculate sent
    if (key === '.' && receivedRaw.includes('.')) return;
    const parts = receivedRaw.split('.');
    if (key !== '.' && parts[0].length >= 9) return;
    receivedRaw += key;
    updateReceivedDisplay();
    autoCalcFromReceived();
  }
  updateEnvoyerButton();
}

function deleteKey() {
  if (activeAmountField === 'sent') {
    sentRaw = sentRaw.slice(0, -1);
    updateSentDisplay();
    autoCalcFromSent();
  } else {
    receivedRaw = receivedRaw.slice(0, -1);
    updateReceivedDisplay();
    autoCalcFromReceived();
  }
  updateEnvoyerButton();
}

function formatAmount(raw) {
  if (!raw || raw === '.') return raw;
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  // Format with dot thousands separator
  const parts = raw.split('.');
  const intPart = parseInt(parts[0], 10);
  const formatted = intPart.toLocaleString('fr-FR').replace(/\s/g, '.');
  if (parts.length > 1) return formatted + '.' + parts[1];
  return formatted;
}

function updateSentDisplay() {
  const el = document.getElementById('amount-sent');
  el.value = sentRaw ? formatAmount(sentRaw) : '';
}

function updateReceivedDisplay() {
  const el = document.getElementById('amount-received');
  el.value = receivedRaw ? formatAmount(receivedRaw) : '';
}

function autoCalcFromSent() {
  // received = sent * 0.99 (1% fee deducted)
  const sentVal = parseFloat(sentRaw);
  if (!isNaN(sentVal) && sentRaw !== '' && sentRaw !== '.') {
    const received = Math.floor(sentVal * 0.99);
    receivedRaw = received.toString();
    updateReceivedDisplay();
  } else {
    receivedRaw = '';
    document.getElementById('amount-received').value = '';
  }
}

function autoCalcFromReceived() {
  // sent = received / 0.99
  const receivedVal = parseFloat(receivedRaw);
  if (!isNaN(receivedVal) && receivedRaw !== '' && receivedRaw !== '.') {
    const sent = Math.ceil(receivedVal / 0.99);
    sentRaw = sent.toString();
    updateSentDisplay();
  } else {
    sentRaw = '';
    document.getElementById('amount-sent').value = '';
  }
}

function updateEnvoyerButton() {
  const btn = document.getElementById('btn-envoyer');
  if (!btn) return;
  const hasAmount = sentRaw && parseFloat(sentRaw) > 0;
  if (hasAmount) {
    btn.classList.add('ready');
  } else {
    btn.classList.remove('ready');
  }
}

function sendMoney() {
  const sentVal = parseFloat(sentRaw);
  if (!sentVal || sentVal <= 0) return;
  const receivedVal = parseFloat(receivedRaw) || Math.floor(sentVal * 0.99);
  const frais = sentVal - receivedVal;

  document.getElementById('confirm-detail').innerHTML =
    `Vous avez envoyé <strong>${formatAmount(sentRaw)} F</strong> à <strong>${selectedRecipient.name}</strong>.<br/>
     ${selectedRecipient.name} recevra <strong>${formatAmount(receivedRaw)} F</strong>.<br/>
     Frais Wave : <strong>${frais.toLocaleString('fr-FR')} F</strong>`;

  goTo('screen-confirm');
}

// ===== INIT =====
goTo('screen-home');
