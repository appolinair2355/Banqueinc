(function(){
  var cfg = window.BANK_CONFIG;
  var DEFAULT = { balance: 125000, txs: [
    { id:'1', label:'Salaire',      amount:350000, date:'12 Juil.', type:'in' },
    { id:'2', label:'Facture SBEE', amount:18500,  date:'10 Juil.', type:'out' },
    { id:'3', label:'Retrait GAB',  amount:50000,  date:'08 Juil.', type:'out' }
  ]};
  var fmt = function(n){ return n.toLocaleString('fr-FR') + ' F'; };
  var state;
  try { state = JSON.parse(localStorage.getItem('pz_'+cfg.key)) || DEFAULT; } catch(e){ state = DEFAULT; }
  var visible = false, currentModal = null;

  function save(){ try{ localStorage.setItem('pz_'+cfg.key, JSON.stringify(state)); }catch(e){} }

  function render(){
    document.getElementById('bal').textContent = visible ? fmt(state.balance) : '•••••• F';
    document.getElementById('bal2').textContent = fmt(state.balance);
    document.getElementById('eye').textContent = visible ? '🙈' : '👁';
    var list = document.getElementById('txs');
    list.innerHTML = '';
    state.txs.forEach(function(t){
      var el = document.createElement('div');
      el.className = 'tx';
      el.innerHTML = '<div class="ic '+t.type+'">'+(t.type==='in'?'↙':'↗')+'</div>'
        +'<div class="mid"><div class="lb"></div><div class="dt"></div></div>'
        +'<div class="amt '+t.type+'"></div>';
      el.querySelector('.lb').textContent = t.label;
      el.querySelector('.dt').textContent = t.date;
      el.querySelector('.amt').textContent = (t.type==='in'?'+':'-') + fmt(t.amount);
      list.appendChild(el);
    });
  }

  function openModal(k){
    currentModal = k;
    var titles = { send:"Envoyer de l'argent", recv:'Recevoir un dépôt', bill:'Payer une facture', withdraw:'Retrait GAB' };
    var labelFields = { send:'Bénéficiaire', recv:'Émetteur', bill:'Facturier' };
    document.getElementById('mtitle').textContent = titles[k];
    var lb = document.getElementById('lb-field');
    if (k === 'withdraw'){ lb.style.display='none'; }
    else { lb.style.display='block'; document.getElementById('lb-label').textContent = labelFields[k]; }
    document.getElementById('lb').value = '';
    document.getElementById('amt').value = '';
    document.getElementById('modal').classList.remove('hidden');
  }
  function closeModal(){ document.getElementById('modal').classList.add('hidden'); currentModal=null; }
  function submitModal(){
    var amt = parseInt(document.getElementById('amt').value||'0',10);
    if (!amt || amt<=0) return;
    var isOut = currentModal!=='recv';
    var defaults = { send:'Transfert', recv:'Dépôt', bill:'Paiement facture', withdraw:'Retrait GAB' };
    var lbl = document.getElementById('lb').value || defaults[currentModal];
    var d = new Date();
    var date = d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
    var tx = { id:String(Date.now()), label:lbl, amount:amt, date:date, type: isOut?'out':'in' };
    state.balance += isOut ? -amt : amt;
    state.txs = [tx].concat(state.txs).slice(0,20);
    save(); render(); closeModal();
  }

  window.addEventListener('DOMContentLoaded', function(){
    document.documentElement.style.setProperty('--primary', cfg.primary);
    document.querySelectorAll('.tint-primary').forEach(function(el){ el.style.background=cfg.primary; el.style.color=cfg.onPrimary; });
    document.querySelectorAll('.tint-accent').forEach(function(el){ el.style.background=cfg.accent; el.style.color=cfg.primaryDark; });
    document.getElementById('bname').textContent = cfg.name;
    document.getElementById('bslogan').textContent = cfg.slogan;
    document.getElementById('blogo').src = cfg.logo;
    document.getElementById('eye').addEventListener('click', function(){ visible=!visible; render(); });
    document.querySelectorAll('[data-action]').forEach(function(b){
      b.addEventListener('click', function(){ openModal(b.getAttribute('data-action')); });
    });
    document.getElementById('mclose').addEventListener('click', closeModal);
    document.getElementById('msubmit').addEventListener('click', submitModal);
    render();
  });
})();
