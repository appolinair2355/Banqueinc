/* ═══════════════════════════════════════════════════════════════
   PayZone Afrique — moteur bancaire partagé
   Utilisé à l'identique par Attijari Mobile, CIH Bank et Wafacash.
   Chaque page définit window.BANK avant de charger ce fichier.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG = window.BANK;

  /* ─────────── Constantes ─────────── */
  var LEDGER_KEY = 'pz_accounts';          // tous les comptes bancaires (Attijari/CIH/Wafacash)
  var WAVE_KEY   = 'wave_accounts';        // comptes Wave (mobile money, XOF)
  var RATE_MAD_XOF = 60;                   // 1 MAD ≈ 60 F CFA (taux de change interne)

  var BANK_LABELS = {
    attijari: 'Attijari Bank',
    cih:      'CIH Bank',
    wafacash: 'Wafacash',
    wave:     'Wave'
  };

  /* ─────────── Utilitaires ─────────── */
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var digits = function (s) { return String(s || '').replace(/\D/g, ''); };

  function nf(n) {
    var neg = n < 0, v = Math.abs(Number(n) || 0);
    var s = v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
             .replace(/[\u202f\u00a0\s]/g, ' ');
    return (neg ? '-' : '') + s;
  }
  function fmt(n) { return nf(n) + ' ' + CFG.symbol; }
  function fmtCur(n, cur) {
    if (cur === 'XOF') {
      return (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('fr-FR')
        .replace(/[\u202f\u00a0\s]/g, ' ') + ' F';
    }
    return nf(n) + ' ' + (cur === 'MAD' ? 'DH' : cur);
  }
  function balHTML(n) {
    if (n === null) return '<span class="bal-num">••••••</span><span class="bal-cur">' + CFG.symbol + '</span>';
    return '<span class="bal-num">' + nf(n) + '</span><span class="bal-cur">' + CFG.symbol + '</span>';
  }
  function convert(amount, from, to) {
    if (from === to) return amount;
    if (from === 'MAD' && to === 'XOF') return Math.round(amount * RATE_MAD_XOF);
    if (from === 'XOF' && to === 'MAD') return Math.round((amount / RATE_MAD_XOF) * 100) / 100;
    return amount;
  }
  function nowLabel() {
    var d = new Date();
    var M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear() + ' à ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function initials(a) {
    return ((a.prenom || ' ')[0] + (a.nom || ' ')[0]).toUpperCase().trim() || '?';
  }
  function fullName(a) { return ((a.prenom || '') + ' ' + (a.nom || '')).trim(); }
  function ref(p) { return p + Date.now().toString().slice(-9); }

  /* ─────────── Registre des comptes ─────────── */
  var DB = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]'); } catch (e) { return []; }
    },
    saveAll: function (list) {
      try { localStorage.setItem(LEDGER_KEY, JSON.stringify(list)); } catch (e) {}
    },
    find: function (bank, phone) {
      return DB.all().filter(function (a) { return a.bank === bank && a.phone === phone; })[0] || null;
    },
    put: function (acc) {
      var all = DB.all(), i = -1, k;
      for (k = 0; k < all.length; k++) {
        if (all[k].bank === acc.bank && all[k].phone === acc.phone) { i = k; break; }
      }
      if (i >= 0) all[i] = acc; else all.push(acc);
      DB.saveAll(all);
    },
    session: function () {
      try { return localStorage.getItem('pz_sess_' + CFG.key) || null; } catch (e) { return null; }
    },
    setSession: function (phone) { try { localStorage.setItem('pz_sess_' + CFG.key, phone); } catch (e) {} },
    clearSession: function () { try { localStorage.removeItem('pz_sess_' + CFG.key); } catch (e) {} }
  };

  /* Comptes Wave (partagés avec le panneau Wave) */
  var WaveDB = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(WAVE_KEY) || '[]'); } catch (e) { return []; }
    },
    save: function (list) { try { localStorage.setItem(WAVE_KEY, JSON.stringify(list)); } catch (e) {} },
    find: function (phone) {
      return WaveDB.all().filter(function (a) { return digits(a.phone) === digits(phone); })[0] || null;
    },
    credit: function (phone, amountXOF, fromLabel, note) {
      var list = WaveDB.all(), i;
      for (i = 0; i < list.length; i++) {
        if (digits(list[i].phone) === digits(phone)) {
          list[i].balance = (list[i].balance || 0) + amountXOF;
          list[i].txs = list[i].txs || [];
          list[i].txs.unshift({
            icon: '🏦', title: 'Reçu de ' + fromLabel, person: fromLabel,
            phone: '', code: '', amount: amountXOF, date: nowLabel(),
            balanceAfter: list[i].balance, ref: ref('B'), note: note || ''
          });
          WaveDB.save(list);
          return true;
        }
      }
      return false;
    }
  };

  /* Annuaire : tous les comptes de la plateforme, sauf moi */
  function directory() {
    var out = [];
    DB.all().forEach(function (a) {
      out.push({
        bank: a.bank, bankLabel: BANK_LABELS[a.bank] || a.bank,
        name: fullName(a), phone: a.phone, currency: a.currency,
        logo: (a.bank === 'attijari' ? 'attijari.png' : a.bank === 'cih' ? 'cih.png' : 'wafacash.png')
      });
    });
    WaveDB.all().forEach(function (a) {
      out.push({
        bank: 'wave', bankLabel: 'Wave', name: ((a.prenom || '') + ' ' + (a.nom || '')).trim(),
        phone: digits(a.phone), currency: 'XOF', logo: 'wave.png'
      });
    });
    return out.filter(function (d) {
      return !(me && d.bank === CFG.key && d.phone === me.phone);
    });
  }

  /* ─────────── État ─────────── */
  var me = null;
  var balVisible = false;
  var currentTab = 's-home';
  var flow = null;          // virement en cours
  var pinBuf = '';
  var pinTarget = null;     // fonction appelée après saisie du PIN
  var pendingCard = null;

  /* ─────────── Navigation ─────────── */
  var TABS = [
    { id: 's-home',     icon: '🏠', label: 'Accueil' },
    { id: 's-accounts', icon: '👛', label: 'Comptes' },
    { id: 's-cards',    icon: '💳', label: 'Cartes' },
    { id: 's-transfer', icon: '⇄',  label: 'Virement' },
    { id: 's-menu',     icon: '☰',  label: 'Menu' }
  ];

  function go(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);

    var isTab = TABS.some(function (t) { return t.id === id; });
    var authScreen = (id === 's-auth' || id === 's-register' || id === 's-login' || id === 's-pin');
    $('tabbar').classList.toggle('hide', authScreen);
    if (isTab) {
      currentTab = id;
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-tab') === id);
      });
    }
  }
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  function openModal(id) { $(id).classList.add('on'); }
  function closeModal(id) { $(id).classList.remove('on'); }

  /* ═══════════════════════════════════════════
     CONSTRUCTION DU DOM
     ═══════════════════════════════════════════ */
  function statusbar(light) {
    return '<div class="statusbar" style="color:' + (light ? '#fff' : 'var(--ink)') + '">' +
      '<span>9:41</span><div class="r"><span>▮▮▮</span><span>◈</span><span>▰</span></div></div>';
  }

  function build() {
    var appEl = document.createElement('div');
    appEl.id = 'app';
    appEl.innerHTML = [
      screenAuth(), screenRegister(), screenLogin(), screenPin(),
      screenHome(), screenAccounts(), screenCards(), screenNewCard(),
      screenTransfer(), screenAmount(), screenMenu(), screenBenef(), screenHistory(), screenTxDetail(),
      screenService(),
      tabbar(), modals()
    ].join('');
    document.body.appendChild(appEl);
    var t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }

  function tabbar() {
    return '<div class="tabbar hide" id="tabbar">' + TABS.map(function (t) {
      return '<button class="tab" data-tab="' + t.id + '"><span class="ti">' + t.icon + '</span>' + t.label + '</button>';
    }).join('') + '</div>';
  }

  /* ── Écran d'accueil non connecté ── */
  function screenAuth() {
    return '<div id="s-auth" class="screen auth">' + statusbar(true) +
      '<div class="auth-top">' +
        '<div class="auth-logo"><img src="' + CFG.logo + '" alt="' + esc(CFG.name) + '"/></div>' +
        '<div class="auth-name">' + esc(CFG.name) + '</div>' +
        '<div class="auth-slogan">' + esc(CFG.slogan) + '</div>' +
      '</div>' +
      '<div class="auth-foot">' +
        '<button class="btn" id="go-register">Créer un compte</button>' +
        '<button class="btn ghost" id="go-login">J\'ai déjà un compte</button>' +
        '<p class="hint">' + esc(CFG.legal) + ' — Service de démonstration PayZone Afrique.<br/>' +
        'Vos données restent sur cet appareil.</p>' +
      '</div></div>';
  }

  /* ── Création de compte ── */
  function screenRegister() {
    return '<div id="s-register" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-auth">‹</button><h2>Ouvrir un compte</h2></div>' +
      '<div class="pbody">' +
        '<div class="row2">' +
          '<div class="field-w"><label class="label">Prénom</label><input id="r-prenom" class="field" placeholder="Prénom" autocomplete="given-name"/></div>' +
          '<div class="field-w"><label class="label">Nom</label><input id="r-nom" class="field" placeholder="Nom" autocomplete="family-name"/></div>' +
        '</div>' +
        '<div class="field-w"><label class="label">Numéro de téléphone</label>' +
          '<div class="phone-w"><input class="cc" value="' + CFG.dial + '" readonly/>' +
          '<input id="r-phone" class="field" type="tel" inputmode="numeric" placeholder="' + esc(CFG.phoneHint) + '" autocomplete="tel"/></div></div>' +
        '<div class="field-w"><label class="label">Adresse e-mail</label><input id="r-email" class="field" type="email" placeholder="exemple@mail.com" autocomplete="email"/></div>' +
        '<div class="field-w"><label class="label">Type de compte</label><select id="r-type" class="field">' +
          CFG.accountTypes.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field-w"><label class="label">Code secret (4 chiffres)</label><input id="r-pin" class="field pin-field" type="tel" inputmode="numeric" maxlength="4" placeholder="••••"/></div>' +
        '<div class="field-w"><label class="label">Confirmez le code secret</label><input id="r-pin2" class="field pin-field" type="tel" inputmode="numeric" maxlength="4" placeholder="••••"/></div>' +
        '<div class="err" id="r-err"></div>' +
        '<button class="btn" id="r-submit">Ouvrir mon compte</button>' +
        '<p class="note">À l\'ouverture, votre solde est de 0 ' + CFG.symbol +
        '. Alimentez-le par un virement reçu depuis un autre compte de la plateforme.</p>' +
      '</div></div>';
  }

  /* ── Connexion ── */
  function screenLogin() {
    return '<div id="s-login" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-auth">‹</button><h2>Connexion</h2></div>' +
      '<div class="pbody">' +
        '<div class="field-w"><label class="label">Numéro de téléphone</label>' +
          '<div class="phone-w"><input class="cc" value="' + CFG.dial + '" readonly/>' +
          '<input id="l-phone" class="field" type="tel" inputmode="numeric" placeholder="' + esc(CFG.phoneHint) + '"/></div></div>' +
        '<div class="field-w"><label class="label">Code secret</label><input id="l-pin" class="field pin-field" type="tel" inputmode="numeric" maxlength="4" placeholder="••••"/></div>' +
        '<div class="err" id="l-err"></div>' +
        '<button class="btn" id="l-submit">Se connecter</button>' +
        '<div id="l-list" style="margin-top:22px"></div>' +
      '</div></div>';
  }

  /* ── Saisie PIN (validation d'opération) ── */
  function screenPin() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return '<div id="s-pin" class="screen" style="background:#fff">' +
      '<div class="phead"><button class="back" id="pin-cancel">‹</button><h2 id="pin-title">Confirmation</h2></div>' +
      '<div class="pbody" style="text-align:center">' +
        '<p class="note" id="pin-sub" style="margin-bottom:6px"></p>' +
        '<div class="pin-dots" id="pin-dots"><i></i><i></i><i></i><i></i></div>' +
        '<div class="err" id="pin-err">Code secret incorrect</div>' +
        '<div class="pinpad">' + keys.map(function (k) {
          return k === '' ? '<button class="key blank"></button>'
            : '<button class="key" data-k="' + k + '">' + k + '</button>';
        }).join('') + '</div>' +
      '</div></div>';
  }

  /* ── Accueil ── */
  function screenHome() {
    return '<div id="s-home" class="screen">' +
      '<div class="home-top">' + statusbar(true) +
        '<div class="home-bar">' +
          '<div class="hb-left"><div class="avatar" id="h-av">?</div>' +
            '<div><div class="hb-hello">Bonjour</div><div class="hb-name" id="h-name"></div></div></div>' +
          '<div class="hb-icons"><button class="icobtn" data-go="s-history">🕘</button>' +
          '<button class="icobtn" data-go="s-menu">🔔</button></div>' +
        '</div>' +
        '<div class="solde-label">Solde</div>' +
        '<div class="bal-row"><span class="bal-amount" id="h-bal"></span>' +
          '<button class="bal-eye" id="h-eye">👁</button></div>' +
        '<div class="bal-sub" id="h-rib"></div>' +
      '</div>' +
      '<div class="quick"><div class="qgrid" id="h-quick"></div></div>' +
      '<div class="sec-h"><h3>Dernières opérations</h3><button data-go="s-history">Voir tout</button></div>' +
      '<div class="panel" id="h-ops"></div>' +
      '<div class="sec-h"><h3>Mes cartes</h3><button data-go="s-cards">Gérer</button></div>' +
      '<div class="panel pad" id="h-cards"></div>' +
      '<div class="footer-legal">' + esc(CFG.legal) + ' · Application de démonstration<br/>PayZone Afrique © ' +
        new Date().getFullYear() + '</div>' +
      '</div>';
  }

  /* ── Comptes ── */
  function screenAccounts() {
    return '<div id="s-accounts" class="screen">' +
      '<div class="phead"><h2>Mes comptes</h2></div>' +
      '<div class="pbody" id="ac-body"></div></div>';
  }

  /* ── Cartes ── */
  function screenCards() {
    return '<div id="s-cards" class="screen">' +
      '<div class="phead"><h2>Mes cartes</h2></div>' +
      '<div class="pbody" id="cd-body"></div></div>';
  }

  function screenNewCard() {
    return '<div id="s-newcard" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-cards">‹</button><h2>Nouvelle carte virtuelle</h2></div>' +
      '<div class="pbody">' +
        '<div class="field-w"><label class="label">Produit</label><select id="nc-kind" class="field">' +
          CFG.cardProducts.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field-w"><label class="label">Réseau</label><select id="nc-net" class="field">' +
          '<option>VISA</option><option>Mastercard</option></select></div>' +
        '<div class="field-w"><label class="label">Plafond mensuel (' + CFG.symbol + ')</label>' +
          '<input id="nc-limit" class="field" type="tel" inputmode="numeric" placeholder="5000"/></div>' +
        '<div class="field-w"><label class="label">Validité</label><select id="nc-val" class="field">' +
          '<option>1 an</option><option>2 ans</option><option>3 ans</option></select></div>' +
        '<div class="err" id="nc-err"></div>' +
        '<button class="btn" id="nc-submit">Créer la carte</button>' +
        '<p class="note">La carte virtuelle est utilisable immédiatement pour vos paiements en ligne. ' +
        'Elle est adossée à votre compte ' + esc(CFG.name) + '.</p>' +
      '</div></div>';
  }

  /* ── Virement : choix du bénéficiaire ── */
  function screenTransfer() {
    return '<div id="s-transfer" class="screen">' +
      '<div class="phead"><h2>Virement</h2></div>' +
      '<div class="pbody">' +
        '<input id="t-search" class="field" placeholder="🔍  Nom ou numéro de téléphone"/>' +
        '<button class="btn ghost" style="margin-top:12px" data-go="s-benef">＋ Nouveau bénéficiaire</button>' +
        '<div class="sec-h" style="padding:20px 0 6px"><h3>Comptes de la plateforme</h3></div>' +
        '<div class="panel pad" style="margin:0" id="t-list"></div>' +
      '</div></div>';
  }

  /* ── Nouveau bénéficiaire ── */
  function screenBenef() {
    return '<div id="s-benef" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-transfer">‹</button><h2>Nouveau bénéficiaire</h2></div>' +
      '<div class="pbody">' +
        '<div class="field-w"><label class="label">Établissement</label><select id="b-bank" class="field">' +
          '<option value="attijari">Attijari Bank</option><option value="cih">CIH Bank</option>' +
          '<option value="wafacash">Wafacash</option><option value="wave">Wave (Mobile Money)</option>' +
        '</select></div>' +
        '<div class="field-w"><label class="label">Numéro de téléphone du bénéficiaire</label>' +
          '<input id="b-phone" class="field" type="tel" inputmode="numeric" placeholder="Numéro"/></div>' +
        '<div class="err" id="b-err"></div>' +
        '<button class="btn" id="b-submit">Rechercher le compte</button>' +
        '<p class="note">Le bénéficiaire doit posséder un compte actif sur PayZone Afrique ' +
        '(Attijari, CIH, Wafacash ou Wave).</p>' +
      '</div></div>';
  }

  /* ── Montant ── */
  function screenAmount() {
    return '<div id="s-amount" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-transfer">‹</button><h2 id="am-title">Montant</h2></div>' +
      '<div class="pbody">' +
        '<div class="panel pad" style="margin:0 0 16px" id="am-card"></div>' +
        '<div class="field-w"><label class="label">Montant à envoyer (' + CFG.symbol + ')</label>' +
          '<input id="am-input" class="field" type="tel" inputmode="decimal" placeholder="0,00"/></div>' +
        '<div class="field-w"><label class="label">Motif</label>' +
          '<input id="am-note" class="field" placeholder="Ex : loyer, remboursement…"/></div>' +
        '<div class="recap" id="am-recap"></div>' +
        '<div class="err" id="am-err"></div>' +
        '<button class="btn" id="am-submit">Continuer</button>' +
      '</div></div>';
  }

  /* ── Historique ── */
  function screenHistory() {
    return '<div id="s-history" class="screen">' +
      '<div class="phead"><button class="back" id="hi-back">‹</button><h2>Historique</h2></div>' +
      '<div class="pbody"><div class="panel" style="margin:0" id="hi-list"></div></div></div>';
  }

  function screenTxDetail() {
    return '<div id="s-tx" class="screen">' +
      '<div class="phead"><button class="back" data-go="s-history">‹</button><h2>Détail de l\'opération</h2></div>' +
      '<div class="pbody" id="tx-body"></div></div>';
  }

  /* ── Menu ── */
  function screenMenu() {
    return '<div id="s-menu" class="screen">' +
      '<div class="phead"><h2>Menu</h2></div>' +
      '<div class="pbody" id="mn-body"></div></div>';
  }

  /* ── Service générique (factures, recharge, etc.) ── */
  function screenService() {
    return '<div id="s-service" class="screen">' +
      '<div class="phead"><button class="back" id="sv-back">‹</button><h2 id="sv-title"></h2></div>' +
      '<div class="pbody">' +
        '<div class="field-w"><label class="label" id="sv-l1">Référence</label><input id="sv-f1" class="field"/></div>' +
        '<div class="field-w"><label class="label">Montant (' + CFG.symbol + ')</label>' +
          '<input id="sv-amt" class="field" type="tel" inputmode="decimal" placeholder="0,00"/></div>' +
        '<div class="recap" id="sv-recap"></div>' +
        '<div class="err" id="sv-err"></div>' +
        '<button class="btn" id="sv-submit">Valider</button>' +
      '</div></div>';
  }

  function modals() {
    return '<div class="modal" id="m-success"><div class="sheet"><div class="grabber"></div>' +
        '<div class="success"><div class="tick">✓</div><h3 id="sc-title"></h3>' +
        '<div class="amt" id="sc-amt"></div><div class="sub" id="sc-to"></div>' +
        '<div class="recap" id="sc-recap"></div>' +
        '<button class="btn" id="sc-ok">Terminé</button></div></div></div>' +
      '<div class="modal" id="m-card"><div class="sheet"><div class="grabber"></div>' +
        '<h3>Détails de la carte</h3><div class="sub">Ne communiquez jamais ces informations.</div>' +
        '<div id="mc-body"></div><button class="btn" id="mc-close" style="margin-top:14px">Fermer</button>' +
        '</div></div>';
  }

  /* ═══════════════════════════════════════════
     RENDUS
     ═══════════════════════════════════════════ */

  function refreshAll() {
    renderHome();
    renderAccounts();
    renderCards();
    renderDirectory('');
    renderHistory();
    renderMenu();
  }

  function renderHome() {
    if (!me) return;
    $('h-av').textContent = initials(me);
    $('h-name').textContent = fullName(me);
    $('h-bal').innerHTML = balHTML(balVisible ? me.balance : null);
    $('h-eye').textContent = balVisible ? '🙈' : '👁';
    $('h-rib').textContent = me.type + ' · ' + me.rib;

    $('h-quick').innerHTML = CFG.quick.map(function (q, i) {
      return '<button class="qtile" data-q="' + i + '"><span class="c">' + q.icon + '</span><span>' +
        esc(q.label) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($('h-quick').children, function (b) {
      b.onclick = function () { runQuick(CFG.quick[+b.getAttribute('data-q')]); };
    });

    var ops = me.txs.slice(0, 5);
    $('h-ops').innerHTML = ops.length ? ops.map(opRow).join('') : emptyBox('🧾', 'Aucune opération pour le moment.');
    bindOps($('h-ops'));

    var c = me.cards[0];
    $('h-cards').innerHTML = c ? cardHTML(c) :
      '<div class="empty" style="padding:18px 6px"><div class="big">💳</div>' +
      '<p>Vous n\'avez pas encore de carte.</p>' +
      '<button class="btn ghost" style="margin-top:14px" id="h-newcard">Créer une carte virtuelle</button></div>';
    if ($('h-newcard')) $('h-newcard').onclick = function () { go('s-newcard'); };
  }

  function emptyBox(icon, text) {
    return '<div class="empty"><div class="big">' + icon + '</div><p>' + esc(text) + '</p></div>';
  }

  function opRow(t, i) {
    var out = t.amount < 0;
    return '<div class="op" data-tx="' + esc(t.ref) + '">' +
      '<div class="ic ' + (out ? 'out' : 'in') + '">' + t.icon + '</div>' +
      '<div class="mid"><div class="lb">' + esc(t.title) + '</div>' +
      '<div class="dt">' + esc(t.date) + '</div></div>' +
      '<div class="amt ' + (out ? 'out' : 'in') + '">' + (out ? '' : '+') + fmt(t.amount) + '</div></div>';
  }
  function bindOps(root) {
    root.querySelectorAll('.op').forEach(function (el) {
      el.onclick = function () { showTx(el.getAttribute('data-tx')); };
    });
  }

  function renderAccounts() {
    if (!me) return;
    $('ac-body').innerHTML =
      '<div class="acct">' +
        '<svg class="rings" viewBox="0 0 200 140"><g fill="none" stroke="#fff" stroke-width="2" opacity=".55">' +
        '<circle cx="120" cy="70" r="42"/><circle cx="142" cy="70" r="42"/><circle cx="164" cy="70" r="42"/></g></svg>' +
        '<div class="t">' + esc(CFG.name) + '</div>' +
        '<div class="n">' + esc(me.type) + '</div>' +
        '<div class="rib">' + esc(me.rib) + '</div>' +
        '<div class="b">' + nf(me.balance) + '<span class="u">' + CFG.symbol + '</span></div>' +
      '</div>' +
      '<div class="panel pad" style="margin:0 0 16px">' +
        kv('Titulaire', fullName(me)) +
        kv('Téléphone', CFG.dial + ' ' + me.phone) +
        kv('E-mail', me.email) +
        kv('RIB / IBAN', me.iban) +
        kv('Devise', CFG.currency + ' (' + CFG.symbol + ')') +
        kv('Ouvert le', me.since) +
        kv('Statut', 'Actif') +
      '</div>' +
      '<button class="btn ghost" id="ac-copy">Copier mon RIB</button>' +
      '<button class="btn" id="ac-send">Faire un virement</button>';
    $('ac-copy').onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(me.iban);
      toast('RIB copié 📋');
    };
    $('ac-send').onclick = function () { go('s-transfer'); };
  }
  function kv(k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; }

  function cardHTML(c) {
    return '<div class="vcard' + (c.blocked ? ' blocked' : '') + '" data-card="' + esc(c.id) + '">' +
      '<div class="vc-top"><div class="brand">' + esc(CFG.name) + '</div>' +
        '<div class="kind">' + esc(c.kind) + (c.blocked ? ' · BLOQUÉE' : '') + '</div></div>' +
      '<div class="chip"></div>' +
      '<div class="num">' + esc(c.masked) + '</div>' +
      '<div class="vc-bot"><div><div class="lbl">Titulaire</div><b>' + esc(c.holder) + '</b></div>' +
      '<div><div class="lbl">Expire</div><b>' + esc(c.exp) + '</b></div>' +
      '<div class="net">' + esc(c.net) + '</div></div></div>';
  }

  function renderCards() {
    if (!me) return;
    var body = $('cd-body');
    if (!me.cards.length) {
      body.innerHTML = emptyBox('💳', 'Aucune carte virtuelle. Créez-en une en quelques secondes.') +
        '<button class="btn" id="cd-new">Créer une carte virtuelle</button>';
    } else {
      body.innerHTML = me.cards.map(function (c) {
        return cardHTML(c) +
          '<div class="card-actions">' +
            '<button class="btn ghost" data-show="' + esc(c.id) + '">Voir le numéro</button>' +
            '<button class="btn ' + (c.blocked ? '' : 'dark') + '" data-block="' + esc(c.id) + '">' +
              (c.blocked ? 'Débloquer' : 'Bloquer') + '</button>' +
          '</div>' +
          '<div class="panel pad" style="margin:0 0 22px">' +
            kv('Produit', c.kind) + kv('Plafond mensuel', fmt(c.limit)) +
            kv('Créée le', c.created) + kv('Statut', c.blocked ? 'Bloquée' : 'Active') +
          '</div>';
      }).join('') + '<button class="btn" id="cd-new">＋ Nouvelle carte virtuelle</button>';
    }
    if ($('cd-new')) $('cd-new').onclick = function () { go('s-newcard'); };
    body.querySelectorAll('[data-show]').forEach(function (b) {
      b.onclick = function () { showCard(b.getAttribute('data-show')); };
    });
    body.querySelectorAll('[data-block]').forEach(function (b) {
      b.onclick = function () {
        var c = me.cards.filter(function (x) { return x.id === b.getAttribute('data-block'); })[0];
        if (!c) return;
        c.blocked = !c.blocked;
        persist();
        renderCards(); renderHome();
        toast(c.blocked ? 'Carte bloquée' : 'Carte débloquée');
      };
    });
  }

  function showCard(id) {
    var c = me.cards.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    $('mc-body').innerHTML = '<div class="panel pad" style="margin:12px 0 0;box-shadow:none;border:1px solid var(--line)">' +
      kv('Numéro', c.number) + kv('Titulaire', c.holder) +
      kv('Expiration', c.exp) + kv('Cryptogramme (CVV)', c.cvv) +
      kv('Réseau', c.net) + '</div>';
    openModal('m-card');
  }

  function renderDirectory(q) {
    var list = directory();
    q = (q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(function (d) {
        return d.name.toLowerCase().indexOf(q) >= 0 || d.phone.indexOf(digits(q)) >= 0;
      });
    }
    var el = $('t-list');
    if (!list.length) {
      el.innerHTML = emptyBox('👥', 'Aucun autre compte trouvé. Créez un compte sur une autre banque ou sur Wave pour tester un virement.');
      return;
    }
    el.innerHTML = list.map(function (d, i) {
      return '<button class="pick" data-d="' + i + '">' +
        '<span class="av"><img src="' + d.logo + '" alt=""/></span>' +
        '<span class="mid"><span class="n">' + esc(d.name || 'Compte ' + d.phone) + '</span>' +
        '<span class="s">' + esc(d.bankLabel) + ' · ' + esc(d.phone) + '</span></span>' +
        '<span class="badge">' + (d.currency === 'XOF' ? 'F CFA' : 'DH') + '</span></button>';
    }).join('');
    el.querySelectorAll('.pick').forEach(function (b) {
      b.onclick = function () { startTransfer(list[+b.getAttribute('data-d')]); };
    });
  }

  function renderHistory() {
    if (!me) return;
    $('hi-list').innerHTML = me.txs.length
      ? me.txs.map(opRow).join('')
      : emptyBox('🧾', 'Aucune opération enregistrée.');
    bindOps($('hi-list'));
  }

  function showTx(r) {
    var t = me.txs.filter(function (x) { return x.ref === r; })[0];
    if (!t) return;
    $('tx-body').innerHTML =
      '<div class="success" style="padding-bottom:10px"><div class="tick" style="background:var(--soft);color:var(--primary)">' +
        t.icon + '</div><h3>' + esc(t.title) + '</h3>' +
        '<div class="amt" style="color:' + (t.amount < 0 ? 'var(--ink)' : 'var(--green)') + '">' +
        (t.amount < 0 ? '' : '+') + fmt(t.amount) + '</div></div>' +
      '<div class="panel pad" style="margin:8px 0 0">' +
        kv('Date', t.date) + kv('Bénéficiaire / Émetteur', t.person || '—') +
        kv('Établissement', t.bankLabel || CFG.name) +
        kv('Motif', t.note || '—') + kv('Référence', t.ref) +
        kv('Solde après opération', fmt(t.balanceAfter)) +
      '</div>';
    go('s-tx');
  }

  function renderMenu() {
    if (!me) return;
    $('mn-body').innerHTML =
      '<div class="panel pad" style="margin:0 0 16px;display:flex;align-items:center;gap:14px">' +
        '<div class="avatar" style="background:var(--soft);color:var(--primary);border:0;width:54px;height:54px;font-size:19px">' +
          initials(me) + '</div>' +
        '<div><div style="font-weight:800;font-size:16px">' + esc(fullName(me)) + '</div>' +
        '<div style="font-size:12.5px;color:var(--grey);margin-top:3px">' + CFG.dial + ' ' + esc(me.phone) + '</div></div>' +
      '</div>' +
      '<div class="panel pad" style="margin:0 0 16px">' +
        CFG.menu.map(function (m, i) {
          return '<button class="pick" data-m="' + i + '"><span class="av">' + m.icon + '</span>' +
            '<span class="mid"><span class="n">' + esc(m.label) + '</span>' +
            '<span class="s">' + esc(m.sub) + '</span></span><span class="chev">›</span></button>';
        }).join('') +
      '</div>' +
      '<button class="btn danger" id="mn-logout">Se déconnecter</button>';
    $('mn-body').querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = function () { runQuick(CFG.menu[+b.getAttribute('data-m')]); };
    });
    $('mn-logout').onclick = function () {
      DB.clearSession(); me = null; balVisible = false; go('s-auth');
    };
  }

  /* ═══════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════ */

  function runQuick(q) {
    if (!q) return;
    if (q.action === 'transfer') return go('s-transfer');
    if (q.action === 'cards')    return go('s-cards');
    if (q.action === 'newcard')  return go('s-newcard');
    if (q.action === 'accounts') return go('s-accounts');
    if (q.action === 'history')  return go('s-history');
    if (q.action === 'rib') {
      if (navigator.clipboard) navigator.clipboard.writeText(me.iban);
      return toast('RIB copié : ' + me.iban, 3200);
    }
    if (q.action === 'service') return openService(q);
    toast(q.label + ' — bientôt disponible');
  }

  var svc = null;
  function openService(q) {
    svc = q;
    $('sv-title').textContent = q.label;
    $('sv-l1').textContent = q.field || 'Référence';
    $('sv-f1').value = '';
    $('sv-f1').placeholder = q.placeholder || '';
    $('sv-amt').value = '';
    $('sv-recap').innerHTML = '';
    $('sv-err').classList.remove('show');
    go('s-service');
  }

  /* ── Création de compte ── */
  function doRegister() {
    var prenom = $('r-prenom').value.trim();
    var nom    = $('r-nom').value.trim();
    var phone  = digits($('r-phone').value);
    var email  = $('r-email').value.trim();
    var pin    = digits($('r-pin').value);
    var pin2   = digits($('r-pin2').value);
    var err    = $('r-err');

    function fail(m) { err.textContent = m; err.classList.add('show'); }
    err.classList.remove('show');

    if (prenom.length < 2 || nom.length < 2) return fail('Renseignez votre prénom et votre nom.');
    if (phone.length < CFG.phoneLen) return fail('Numéro de téléphone invalide (' + CFG.phoneLen + ' chiffres).');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return fail('Adresse e-mail invalide.');
    if (pin.length !== 4) return fail('Le code secret doit contenir 4 chiffres.');
    if (pin !== pin2) return fail('Les deux codes secrets ne correspondent pas.');
    if (DB.find(CFG.key, phone)) return fail('Un compte existe déjà avec ce numéro.');

    var d = new Date();
    var suffix = String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
    var acc = {
      bank: CFG.key, prenom: prenom, nom: nom, phone: phone, email: email,
      pin: pin, type: $('r-type').value, currency: CFG.currency,
      balance: 0,
      rib: CFG.ribPrefix + ' •••• ' + suffix.slice(-4),
      iban: CFG.ibanPrefix + suffix.slice(0, 3) + ' ' + suffix.slice(3, 7) + ' ' + suffix.slice(7) + phone.slice(-4),
      since: d.toLocaleDateString('fr-FR'),
      cards: [], txs: []
    };
    DB.put(acc);
    DB.setSession(phone);
    me = acc;
    balVisible = true;
    refreshAll();
    go('s-home');
    toast('Compte ouvert — solde 0 ' + CFG.symbol, 3200);
  }

  /* ── Connexion ── */
  function doLogin() {
    var phone = digits($('l-phone').value);
    var pin = digits($('l-pin').value);
    var err = $('l-err');
    err.classList.remove('show');
    var acc = DB.find(CFG.key, phone);
    if (!acc) { err.textContent = 'Aucun compte ' + CFG.name + ' avec ce numéro.'; err.classList.add('show'); return; }
    if (acc.pin !== pin) { err.textContent = 'Code secret incorrect.'; err.classList.add('show'); return; }
    DB.setSession(phone);
    me = acc;
    refreshAll();
    go('s-home');
    toast('Bienvenue ' + acc.prenom);
  }

  function renderLoginList() {
    var mine = DB.all().filter(function (a) { return a.bank === CFG.key; });
    $('l-list').innerHTML = mine.length
      ? '<div class="label">Comptes enregistrés sur cet appareil</div>' +
        '<div class="panel pad" style="margin:0">' + mine.map(function (a, i) {
          return '<button class="pick" data-a="' + i + '"><span class="av">' + initials(a) + '</span>' +
            '<span class="mid"><span class="n">' + esc(fullName(a)) + '</span>' +
            '<span class="s">' + CFG.dial + ' ' + esc(a.phone) + '</span></span><span class="chev">›</span></button>';
        }).join('') + '</div>'
      : '';
    $('l-list').querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        $('l-phone').value = mine[+b.getAttribute('data-a')].phone;
        $('l-pin').focus();
      };
    });
  }

  /* ── Carte virtuelle ── */
  function doNewCard() {
    var err = $('nc-err');
    err.classList.remove('show');
    var limit = parseFloat(String($('nc-limit').value).replace(',', '.')) || 0;
    if (limit <= 0) { err.textContent = 'Indiquez un plafond mensuel.'; err.classList.add('show'); return; }
    var net = $('nc-net').value;
    var prefix = net === 'VISA' ? '4' : '5';
    var num = prefix;
    while (num.length < 16) num += Math.floor(Math.random() * 10);
    var groups = num.match(/.{1,4}/g);
    var d = new Date();
    var years = parseInt($('nc-val').value, 10) || 1;
    pendingCard = {
      id: 'c' + Date.now(),
      kind: $('nc-kind').value,
      net: net,
      number: groups.join(' '),
      masked: '•••• •••• •••• ' + groups[3],
      cvv: String(Math.floor(100 + Math.random() * 900)),
      exp: String(d.getMonth() + 1).padStart(2, '0') + '/' + String((d.getFullYear() + years) % 100).padStart(2, '0'),
      holder: fullName(me).toUpperCase(),
      limit: limit,
      blocked: false,
      created: d.toLocaleDateString('fr-FR')
    };
    askPin('Création de carte', 'Saisissez votre code secret pour émettre la carte.', function () {
      me.cards.unshift(pendingCard);
      me.txs.unshift({
        icon: '💳', title: 'Émission carte ' + pendingCard.kind, person: fullName(me),
        bankLabel: CFG.name, amount: 0, date: nowLabel(), balanceAfter: me.balance,
        ref: ref('C'), note: 'Carte ' + pendingCard.masked
      });
      persist();
      refreshAll();
      go('s-cards');
      success('Carte créée', '', pendingCard.kind + ' · ' + pendingCard.masked, [
        ['Réseau', pendingCard.net],
        ['Expiration', pendingCard.exp],
        ['Plafond', fmt(pendingCard.limit)]
      ]);
      pendingCard = null;
    });
  }

  /* ── Virement ── */
  function startTransfer(dest) {
    flow = { dest: dest };
    $('am-title').textContent = 'Virement';
    $('am-card').innerHTML =
      '<div style="display:flex;align-items:center;gap:13px">' +
        '<span class="av" style="width:46px;height:46px;border-radius:50%;overflow:hidden;display:flex">' +
        '<img src="' + dest.logo + '" alt="" style="width:100%;height:100%;object-fit:cover"/></span>' +
        '<div><div style="font-weight:800;font-size:15px">' + esc(dest.name || dest.phone) + '</div>' +
        '<div style="font-size:12.5px;color:var(--grey);margin-top:3px">' + esc(dest.bankLabel) + ' · ' +
        esc(dest.phone) + '</div></div></div>';
    $('am-input').value = '';
    $('am-note').value = '';
    $('am-err').classList.remove('show');
    updateRecap();
    go('s-amount');
  }

  function transferFee(v) {
    return Math.round(v * CFG.feeRate * 100) / 100;
  }

  function updateRecap() {
    if (!flow) return;
    var v = parseFloat(String($('am-input').value).replace(/\s/g, '').replace(',', '.')) || 0;
    var fee = transferFee(v);
    var rows = [['Montant', fmt(v)], ['Frais', fmt(fee)], ['Total débité', fmt(v + fee)]];
    if (flow.dest.currency !== CFG.currency) {
      rows.push(['Montant reçu', fmtCur(convert(v, CFG.currency, flow.dest.currency), flow.dest.currency)]);
    }
    rows.push(['Nouveau solde', fmt(me.balance - v - fee)]);
    $('am-recap').innerHTML = rows.map(function (r) {
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('');
  }

  function doTransfer() {
    var err = $('am-err');
    err.classList.remove('show');
    var v = parseFloat(String($('am-input').value).replace(/\s/g, '').replace(',', '.')) || 0;
    if (v <= 0) { err.textContent = 'Saisissez un montant.'; err.classList.add('show'); return; }
    var fee = transferFee(v);
    if (v + fee > me.balance) {
      err.textContent = 'Solde insuffisant. Disponible : ' + fmt(me.balance);
      err.classList.add('show');
      return;
    }
    var note = $('am-note').value.trim();
    askPin('Confirmation du virement', 'Virement de ' + fmt(v) + ' vers ' + (flow.dest.name || flow.dest.phone), function () {
      var r = ref('V');
      me.balance = Math.round((me.balance - v - fee) * 100) / 100;
      me.txs.unshift({
        icon: '⇄', title: 'Virement à ' + (flow.dest.name || flow.dest.phone),
        person: flow.dest.name, bankLabel: flow.dest.bankLabel,
        amount: -(v + fee), date: nowLabel(), balanceAfter: me.balance, ref: r, note: note
      });
      persist();

      // crédit du bénéficiaire
      var received = convert(v, CFG.currency, flow.dest.currency);
      if (flow.dest.bank === 'wave') {
        WaveDB.credit(flow.dest.phone, received, fullName(me) + ' (' + CFG.name + ')', note);
      } else {
        var d = DB.find(flow.dest.bank, flow.dest.phone);
        if (d) {
          d.balance = Math.round((d.balance + received) * 100) / 100;
          d.txs.unshift({
            icon: '⬇', title: 'Virement reçu de ' + fullName(me), person: fullName(me),
            bankLabel: CFG.name, amount: received, date: nowLabel(),
            balanceAfter: d.balance, ref: r, note: note
          });
          DB.put(d);
        }
      }

      refreshAll();
      go('s-home');
      success('Virement effectué', fmt(v), 'vers ' + (flow.dest.name || flow.dest.phone), [
        ['Établissement', flow.dest.bankLabel],
        ['Frais', fmt(fee)],
        ['Montant reçu', fmtCur(received, flow.dest.currency)],
        ['Référence', r],
        ['Nouveau solde', fmt(me.balance)]
      ]);
      flow = null;
    });
  }

  /* ── Service (facture, recharge…) ── */
  function doService() {
    var err = $('sv-err');
    err.classList.remove('show');
    var v = parseFloat(String($('sv-amt').value).replace(/\s/g, '').replace(',', '.')) || 0;
    var f1 = $('sv-f1').value.trim();
    if (!f1) { err.textContent = 'Champ « ' + (svc.field || 'Référence') + ' » requis.'; err.classList.add('show'); return; }
    if (v <= 0) { err.textContent = 'Saisissez un montant.'; err.classList.add('show'); return; }
    if (v > me.balance) { err.textContent = 'Solde insuffisant. Disponible : ' + fmt(me.balance); err.classList.add('show'); return; }
    askPin(svc.label, 'Montant : ' + fmt(v), function () {
      var r = ref('P');
      me.balance = Math.round((me.balance - v) * 100) / 100;
      me.txs.unshift({
        icon: svc.icon, title: svc.label + ' · ' + f1, person: f1, bankLabel: CFG.name,
        amount: -v, date: nowLabel(), balanceAfter: me.balance, ref: r, note: svc.field + ' : ' + f1
      });
      persist();
      refreshAll();
      go('s-home');
      success(svc.label, fmt(v), f1, [['Référence', r], ['Nouveau solde', fmt(me.balance)]]);
    });
  }

  /* ── Bénéficiaire manuel ── */
  function findBenef() {
    var err = $('b-err');
    err.classList.remove('show');
    var bank = $('b-bank').value;
    var phone = digits($('b-phone').value);
    if (!phone) { err.textContent = 'Saisissez un numéro.'; err.classList.add('show'); return; }
    if (bank === CFG.key && phone === me.phone) {
      err.textContent = 'Vous ne pouvez pas vous virer de l\'argent à vous-même.';
      err.classList.add('show'); return;
    }
    var d = null;
    if (bank === 'wave') {
      var w = WaveDB.find(phone);
      if (w) d = { bank: 'wave', bankLabel: 'Wave', name: ((w.prenom || '') + ' ' + (w.nom || '')).trim(), phone: digits(w.phone), currency: 'XOF', logo: 'wave.png' };
    } else {
      var a = DB.find(bank, phone);
      if (a) d = { bank: bank, bankLabel: BANK_LABELS[bank], name: fullName(a), phone: a.phone, currency: a.currency, logo: bank + '.png' };
    }
    if (!d) {
      err.textContent = 'Aucun compte ' + BANK_LABELS[bank] + ' trouvé avec ce numéro.';
      err.classList.add('show'); return;
    }
    startTransfer(d);
  }

  /* ── PIN ── */
  function askPin(title, sub, cb) {
    pinBuf = '';
    pinTarget = cb;
    $('pin-title').textContent = title;
    $('pin-sub').textContent = sub || '';
    $('pin-err').classList.remove('show');
    drawPin();
    go('s-pin');
  }
  function drawPin() {
    var dots = $('pin-dots').children;
    for (var i = 0; i < 4; i++) dots[i].classList.toggle('on', i < pinBuf.length);
  }
  function pinKey(k) {
    if (k === '⌫') { pinBuf = pinBuf.slice(0, -1); drawPin(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k;
    drawPin();
    if (pinBuf.length === 4) {
      setTimeout(function () {
        if (pinBuf === me.pin) {
          var cb = pinTarget;
          pinTarget = null;
          pinBuf = '';
          drawPin();
          if (cb) cb();
        } else {
          $('pin-err').classList.add('show');
          pinBuf = '';
          drawPin();
        }
      }, 130);
    }
  }

  function success(title, amt, to, rows) {
    $('sc-title').textContent = title;
    $('sc-amt').textContent = amt || '';
    $('sc-to').textContent = to || '';
    $('sc-recap').innerHTML = (rows || []).map(function (r) {
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('');
    openModal('m-success');
  }

  function persist() { DB.put(me); }

  /* ═══════════════════════════════════════════
     INITIALISATION
     ═══════════════════════════════════════════ */
  function applyTheme() {
    var r = document.documentElement.style;
    r.setProperty('--primary', CFG.primary);
    r.setProperty('--primary-d', CFG.primaryDark);
    r.setProperty('--soft', CFG.soft);
    r.setProperty('--ink', CFG.ink);
    r.setProperty('--card-a', CFG.cardA);
    r.setProperty('--card-b', CFG.cardB);
    document.title = CFG.name;
  }

  function bind() {
    // tabs
    document.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-tab');
        if (!me) { go('s-auth'); return; }
        if (id === 's-transfer') renderDirectory($('t-search').value);
        if (id === 's-cards') renderCards();
        if (id === 's-accounts') renderAccounts();
        if (id === 's-menu') renderMenu();
        if (id === 's-home') renderHome();
        go(id);
      };
    });
    // boutons [data-go]
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-go');
        if (id === 's-history') renderHistory();
        go(id);
      };
    });

    $('go-register').onclick = function () { go('s-register'); };
    $('go-login').onclick = function () { renderLoginList(); go('s-login'); };
    $('r-submit').onclick = doRegister;
    $('l-submit').onclick = doLogin;
    $('nc-submit').onclick = doNewCard;
    $('am-submit').onclick = doTransfer;
    $('b-submit').onclick = findBenef;
    $('sv-submit').onclick = doService;
    $('am-input').oninput = updateRecap;
    $('t-search').oninput = function () { renderDirectory(this.value); };
    $('h-eye').onclick = function () { balVisible = !balVisible; renderHome(); };
    $('hi-back').onclick = function () { go(currentTab === 's-history' ? 's-home' : currentTab); };
    $('sv-back').onclick = function () { go('s-home'); };
    $('pin-cancel').onclick = function () { pinTarget = null; go(flow ? 's-amount' : currentTab); };
    $('sc-ok').onclick = function () { closeModal('m-success'); };
    $('mc-close').onclick = function () { closeModal('m-card'); };

    document.querySelectorAll('#s-pin .key[data-k]').forEach(function (b) {
      b.onclick = function () { pinKey(b.getAttribute('data-k')); };
    });
    document.querySelectorAll('.modal').forEach(function (m) {
      m.onclick = function (e) { if (e.target === m) m.classList.remove('on'); };
    });

    // saisie PIN : chiffres uniquement
    ['r-pin', 'r-pin2', 'l-pin'].forEach(function (id) {
      $(id).oninput = function () { this.value = digits(this.value).slice(0, 4); };
    });
    $('r-phone').oninput = function () { this.value = digits(this.value).slice(0, CFG.phoneLen); };
    $('l-phone').oninput = function () { this.value = digits(this.value).slice(0, CFG.phoneLen); };
  }

  function start() {
    applyTheme();
    build();
    bind();
    var s = DB.session();
    me = s ? DB.find(CFG.key, s) : null;
    if (me) {
      me.cards = me.cards || [];
      me.txs = me.txs || [];
      refreshAll();
      go('s-home');
    } else {
      renderLoginList();
      go('s-auth');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
