/*
 * AniShelf application controller
 * --------------------------------
 * This file intentionally uses plain JavaScript: no framework, no build step,
 * and no server are required for GitHub Pages.  Persistent user data lives in
 * localStorage; export/import JSON remains the portability mechanism.
 */
const CATALOG = window.ANISHELF_CATALOG;
/* ---------- Configuration & rating scales --------------------------------------- */
const APP_VERSION='4.0.0', STORAGE_KEY='anishelf_state_v1', QUICK_KEY='anishelf_quick_v1', MODE_KEY='anishelf_mode_v1';
const TIERS=[
 {rating:5,label:'IMMENSE / ABSOLUTE CINEMA',sub:'God tier. Le sommet.'},
 {rating:4.5,label:'CHEF-D’ŒUVRE / MASTERCLASS',sub:'Une œuvre parmi les grandes.'},
 {rating:4,label:'EXCELLENT / BANGER',sub:'Valeur sûre.'},
 {rating:3.5,label:'MÉRITE D’ÊTRE VU',sub:'Bon divertissement.'},
 {rating:3,label:'BON / SOLIDE',sub:'Tu ne regrettes pas.'},
 {rating:2.5,label:'CORRECT MAIS OUBLIABLE',sub:'Basique / passable.'},
 {rating:2,label:'MOYEN',sub:'Oui, bon…'},
 {rating:0,label:'PAS VU',sub:'Aucun jugement.'}
];
const DEFAULT_STATE={profileName:'Moi',entries:{}};

let state=loadState(), friendProfile=null, tierMode='consensus', deckMode='unrated', libraryFilter='all';
let appMode=localStorage.getItem(MODE_KEY)||'quick', quickView='sort';
const QUICK_TIERS=[
 {key:'S',label:'IMMENSE',sub:'Absolute cinema',color:'var(--qs)'},
 {key:'A',label:'CHEF-D’ŒUVRE',sub:'Masterclass',color:'var(--qa)'},
 {key:'B',label:'EXCELLENT',sub:'Banger / valeur sûre',color:'var(--qb)'},
 {key:'C',label:'MÉRITE D’ÊTRE VU',sub:'Bon divertissement',color:'var(--qc)'},
 {key:'D',label:'CORRECT / MOYEN',sub:'Passable / oubliable',color:'var(--qd)'}
];
/* ---------- Quick mode state (S/A/B/C/D) ---------------------------------------- */
function loadQuick(){try{const x=JSON.parse(localStorage.getItem(QUICK_KEY));if(x&&x.assignments)return {assignments:x.assignments||{},queue:x.queue||[],history:x.history||[]}}catch(e){}return {assignments:{},queue:[],history:[]}}
let quickState=loadQuick();
function saveQuick(){normalizeQuickQueue();try{localStorage.setItem(QUICK_KEY,JSON.stringify(quickState))}catch(e){}if(appMode==='quick')renderQuickCounter()}
function normalizeQuickQueue(){const open=CATALOG.filter(a=>!quickState.assignments[a.id]).map(a=>a.id),set=new Set(open);quickState.queue=(quickState.queue||[]).filter(id=>set.has(Number(id))).map(Number);const qset=new Set(quickState.queue);open.forEach(id=>{if(!qset.has(id))quickState.queue.push(id)});quickState.history=(quickState.history||[]).map(Number).filter(id=>CATALOG.some(a=>a.id===id))}
function quickAssignedCount(){return Object.keys(quickState.assignments).filter(id=>quickState.assignments[id]).length}
function renderQuickCounter(){const n=quickAssignedCount();document.getElementById('topCounter').innerHTML=`<strong>${n}</strong>/${CATALOG.length} triés`;document.getElementById('quickProgress').innerHTML=`<b>${n}/${CATALOG.length}</b>${CATALOG.length-n} à placer`}
function quickCoverHTML(a){return `<div class="cover-art poster-cover">${posterImgHTML(a)}<div class="poster-shade"></div><div class="cover-rank">${String(a.rank).padStart(3,'0')}</div><div class="cover-kicker">TIER SPRINT · ${a.sourceCount}/3</div><div class="cover-title"><small>${sourceHTML(a)}</small>${esc(a.title)}</div></div>`}
function renderQuickSort(){normalizeQuickQueue();renderQuickCounter();const stage=document.getElementById('quickCardStage'),picker=document.getElementById('quickPicker'),actions=document.querySelector('#quick-sort .quick-actions');if(!quickState.queue.length){stage.innerHTML=`<div class="quick-empty"><div class="fin">FIN.</div><h2>Tout est placé.</h2><p>Maintenant vient la partie dangereuse : expliquer tes choix.</p><button class="btn primary" onclick="switchQuickView('tier')">Voir le tableau</button></div>`;picker.style.display='none';actions.style.display='none';return}picker.style.display='grid';actions.style.display='flex';const a=CATALOG.find(x=>x.id===Number(quickState.queue[0]));stage.innerHTML=`<article class="quick-card">${quickCoverHTML(a)}<div class="quick-card-meta"><div class="quick-rank">CONSENSUS #${a.rank} · ${a.sourceCount}/3 SOURCES</div><div class="quick-source-row">${sourceHTML(a)}</div></div></article>`}
function quickAssign(tier){normalizeQuickQueue();const id=Number(quickState.queue.shift());if(!id)return;quickState.assignments[id]=tier;quickState.history.push(id);saveQuick();renderQuickSort();toast(`${tier} — ${QUICK_TIERS.find(t=>t.key===tier).label}`)}
function quickSkip(){normalizeQuickQueue();if(quickState.queue.length<2){toast('Rien d’autre à passer');return}quickState.queue.push(quickState.queue.shift());saveQuick();renderQuickSort()}
function quickUndo(){const id=Number((quickState.history||[]).pop());if(!id||!quickState.assignments[id]){toast('Rien à annuler');return}delete quickState.assignments[id];quickState.queue=quickState.queue.filter(x=>Number(x)!==id);quickState.queue.unshift(id);saveQuick();renderQuickSort()}
function renderQuickTier(){renderQuickCounter();document.getElementById('quickTierBoard').innerHTML=QUICK_TIERS.map(t=>{const items=CATALOG.filter(a=>quickState.assignments[a.id]===t.key);return `<section class="quick-tier-row" data-tier="${t.key}"><div class="quick-tier-label"><b>${t.key}</b><span>${esc(t.label)}<br>${esc(t.sub)}</span></div><div class="quick-tier-items">${items.map(a=>`<div class="quick-tier-item" data-quick-remove="${a.id}">${thumbHTML(a)}<div class="quick-tier-name">${esc(a.title)}</div></div>`).join('')}</div></section>`}).join('');document.querySelectorAll('[data-quick-remove]').forEach(x=>x.onclick=()=>{const id=Number(x.dataset.quickRemove);delete quickState.assignments[id];quickState.queue=quickState.queue.filter(q=>Number(q)!==id);quickState.queue.unshift(id);saveQuick();renderQuickTier();toast('Retiré du tier')});const open=CATALOG.filter(a=>!quickState.assignments[a.id]);document.getElementById('quickUnranked').innerHTML=`<div class="quick-unranked-head"><span>Pas encore classés</span><b>${open.length}</b></div><div class="quick-unranked-grid">${open.slice(0,36).map(a=>thumbHTML(a)).join('')}${open.length>36?`<div style="align-self:center;color:var(--muted);font-size:10px">+${open.length-36}</div>`:''}</div>`}
function starsToQuick(r){r=Number(r||0);if(r===5)return'S';if(r===4.5)return'A';if(r===4)return'B';if(r===3.5)return'C';if(r>=2)return'D';return null}
function quickFromStars(){const rated=CATALOG.filter(a=>entry(a.id).rating>0);if(!rated.length){toast('Aucune note AniShelf à convertir');return}const occupied=quickAssignedCount();if(occupied&&!confirm(`Le mode rapide contient déjà ${occupied} classements. Remplacer par la conversion de tes étoiles AniShelf ?`))return;quickState.assignments={};rated.forEach(a=>{const t=starsToQuick(entry(a.id).rating);if(t)quickState.assignments[a.id]=t});quickState.queue=[];quickState.history=[];normalizeQuickQueue();saveQuick();renderQuickTier();toast(`${rated.length} notes converties`) }
function resetQuick(){if(!confirm('Effacer tout le classement S/A/B/C/D ? Tes notes AniShelf ne seront pas touchées.'))return;quickState={assignments:{},queue:[],history:[]};saveQuick();renderQuickSort();renderQuickTier();toast('Mode rapide réinitialisé')}
function switchQuickView(name){quickView=name;document.querySelectorAll('.quick-view').forEach(v=>v.classList.toggle('active',v.id==='quick-'+name));document.querySelectorAll('.quick-nav [data-quick-view]').forEach(b=>b.classList.toggle('active',b.dataset.quickView===name));if(name==='sort')renderQuickSort();if(name==='tier')renderQuickTier();window.scrollTo(0,0)}
function setAppMode(mode){appMode=mode==='shelf'?'shelf':'quick';localStorage.setItem(MODE_KEY,appMode);document.body.dataset.appMode=appMode;document.querySelectorAll('[data-appmode]').forEach(b=>b.classList.toggle('active',b.dataset.appmode===appMode));document.getElementById('brandSub').textContent=appMode==='quick'?'tier sprint / S A B C D':'偏愛 / personal canon';if(appMode==='quick'){switchQuickView(quickView);renderQuickCounter()}else{renderAll();switchView(document.querySelector('.shelf-nav .nav-btn.active')?.dataset.view||'deck')}}

/* ---------- AniShelf state & shared helpers -------------------------------------- */
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(x&&x.entries)return Object.assign(clone(DEFAULT_STATE),x)}catch(e){}return clone(DEFAULT_STATE)}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){} renderGlobalStats()}
function entry(id){if(!state.entries[id])state.entries[id]={rating:0,favorite:false,note:''};return state.entries[id]}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
/* ---------- Poster assets ---------------------------------------------------------
 * GitHub Pages is static, so posters are resolved by deterministic file names.
 * - preferred: assets/posters/<slug>.webp (downloaded with scripts/fetch-posters.mjs)
 * - fallback : assets/posters/<slug>.svg  (always committed to the repository)
 */
function posterPaths(a){
  const base=`assets/posters/${a.posterSlug}`;
  return {primary:`${base}.webp`,fallback:`${base}.svg`};
}
function posterImgHTML(a,className='poster-img'){
  const p=posterPaths(a);
  return `<img class="${className}" src="${p.primary}" data-fallback="${p.fallback}" alt="Affiche — ${esc(a.title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}
function tierFor(r){return TIERS.find(t=>t.rating===Number(r))||TIERS[7]}
function initials(title){const ignore=['the','of','and','in','a','an','to','my','no'];const parts=title.replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(Boolean).filter(x=>!ignore.includes(x.toLowerCase()));return (parts.slice(0,2).map(x=>x[0]).join('')||title.slice(0,2)).toUpperCase()}
function variant(a){return 'v'+((a.id+a.title.length)%6)}
function sourceHTML(a){return `<span class="source-dot ${a.sources.japan?'':'off'}">🇯🇵</span><span class="source-dot ${a.sources.france?'':'off'}">🇫🇷</span><span class="source-dot ${a.sources.world?'':'off'}">🌍</span>`}
function thumbHTML(a){return `<div class="thumb poster-thumb">${posterImgHTML(a)}<span class="n">${String(a.rank).padStart(3,'0')}</span><span class="t">${esc(a.title)}</span></div>`}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1700)}
function renderGlobalStats(){const seen=CATALOG.filter(a=>entry(a.id).rating>0), fav=CATALOG.filter(a=>entry(a.id).favorite), five=seen.filter(a=>entry(a.id).rating===5);const avg=seen.length?seen.reduce((s,a)=>s+entry(a.id).rating,0)/seen.length:0;if(appMode==='shelf')document.getElementById('topCounter').innerHTML=`<strong>${seen.length}</strong>/${CATALOG.length} classés`;document.getElementById('stats').innerHTML=`<div class="stat"><b>${seen.length}</b><span>classés</span></div><div class="stat"><b>${CATALOG.length-seen.length}</b><span>pas vus</span></div><div class="stat"><b>${avg?avg.toFixed(2):'—'}</b><span>moyenne</span></div><div class="stat"><b>${five.length}</b><span>5 étoiles</span></div>`}
function ratingButtons(id,current,compact=false){return TIERS.filter(t=>t.rating>0).map(t=>`<button class="rate-btn ${Number(current)===t.rating?'selected':''}" data-rate-id="${id}" data-rating="${t.rating}"><b>${t.rating}★</b><small>${compact?'':esc(t.label.split('/')[0])}</small></button>`).join('')+`<button class="rate-btn skip ${Number(current)===0?'selected':''}" data-rate-id="${id}" data-rating="0"><b>0</b><small>pas vu</small></button>`}
function setRating(id,r,opts={}){entry(id).rating=Number(r);save();if(opts.fromDeck){renderDeck(true);renderLibrary();if(tierMode==='personal')renderTier();setTimeout(()=>scrollDeckTo(0),20);if(Number(r)>0)toast(`${r}★ — ${tierFor(r).label.split('/')[0].trim()}`)}else{renderLibrary();if(tierMode==='personal')renderTier();updateVisibleDeckCard(id)}}
function toggleFav(id){entry(id).favorite=!entry(id).favorite;save();renderLibrary();updateVisibleDeckCard(id);toast(entry(id).favorite?'Ajouté aux favoris':'Retiré des favoris')}

/* ---------- AniShelf: swipe/scroll deck ----------------------------------------- */
function renderDeck(preserve=false){const scroller=document.getElementById('deckScroller');const list=deckMode==='unrated'?CATALOG.filter(a=>entry(a.id).rating===0):CATALOG;const done=CATALOG.length-CATALOG.filter(a=>entry(a.id).rating===0).length;document.getElementById('deckProgress').innerHTML=deckMode==='unrated'?`<b>${done}</b> classés · ${list.length} restant${list.length>1?'s':''}`:`${CATALOG.length} œuvres · swipe / scroll libre`;
 if(!list.length){scroller.innerHTML=`<div class="deck-empty"><div style="font:900 70px Impact;color:var(--orange)">FIN.</div><h2>Tu as tout classé.</h2><p>Bienvenue dans le problème suivant : défendre tes notes auprès de tes amis.</p><button class="btn primary" onclick="switchView('tier')">Voir ma tier list</button></div>`;return}
 scroller.innerHTML=list.map(a=>deckSlideHTML(a)).join('');bindDeckEvents();if(!preserve)scroller.scrollTop=0}
function deckSlideHTML(a){const e=entry(a.id),t=tierFor(e.rating);return `<article class="deck-slide" data-deck-id="${a.id}"><div class="rate-card ${e.rating>0?'rated':''}"><div class="cover-art poster-cover" data-swipe-id="${a.id}">${posterImgHTML(a)}<div class="poster-shade"></div><div class="cover-rank">${String(a.rank).padStart(3,'0')}</div><div class="cover-kicker">${a.sourceCount}/3 sources</div><div class="cover-title"><small>${sourceHTML(a)} <span style="margin-left:3px">CONSENSUS #${a.rank}</span></small>${esc(a.title)}</div></div><div class="rate-panel"><div class="rate-panel-top"><div class="current-rating">${e.rating?`Ta note : <span>${e.rating}★</span> · ${esc(t.label.split('/')[0])}`:'Pas encore classé'}</div><div class="card-actions"><button class="square-btn ${e.favorite?'on':''}" data-fav="${a.id}" title="Favori">♥</button><button class="square-btn" data-detail="${a.id}" title="Notes">•••</button></div></div><div class="rating-grid">${ratingButtons(a.id,e.rating)}</div><div class="deck-hint">swipe vertical pour parcourir · glisse gauche/droite pour précédent/suivant</div></div></div></article>`}
function bindDeckEvents(){document.querySelectorAll('#deckScroller [data-rating]').forEach(b=>b.onclick=()=>setRating(+b.dataset.rateId,+b.dataset.rating,{fromDeck:true}));document.querySelectorAll('#deckScroller [data-fav]').forEach(b=>b.onclick=()=>toggleFav(+b.dataset.fav));document.querySelectorAll('#deckScroller [data-detail]').forEach(b=>b.onclick=()=>openModal(+b.dataset.detail));document.querySelectorAll('#deckScroller [data-swipe-id]').forEach(enableHorizontalSwipe)}
function updateVisibleDeckCard(id){const old=document.querySelector(`.deck-slide[data-deck-id="${id}"]`);if(!old)return;const a=CATALOG.find(x=>x.id===id);old.outerHTML=deckSlideHTML(a);const fresh=document.querySelector(`.deck-slide[data-deck-id="${id}"]`);fresh.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>setRating(+b.dataset.rateId,+b.dataset.rating,{fromDeck:true}));fresh.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>toggleFav(+b.dataset.fav));fresh.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openModal(+b.dataset.detail));const sw=fresh.querySelector('[data-swipe-id]');if(sw)enableHorizontalSwipe(sw)}
function scrollDeckTo(delta){const sc=document.getElementById('deckScroller');const slides=[...sc.querySelectorAll('.deck-slide')];if(!slides.length)return;let idx=slides.findIndex(s=>Math.abs(s.offsetTop-sc.scrollTop)<s.offsetHeight*.55);if(idx<0)idx=0;idx=Math.max(0,Math.min(slides.length-1,idx+delta));slides[idx].scrollIntoView({behavior:'smooth',block:'start'})}
function enableHorizontalSwipe(el){let sx=0,sy=0,active=false;el.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;active=true});el.addEventListener('pointerup',e=>{if(!active)return;active=false;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.4)scrollDeckTo(dx<0?1:-1)})}

/* ---------- AniShelf: searchable library ---------------------------------------- */
function renderLibrary(){const q=(document.getElementById('searchInput').value||'').trim().toLowerCase();let list=CATALOG.filter(a=>a.title.toLowerCase().includes(q));list=list.filter(a=>{const e=entry(a.id);if(libraryFilter==='all')return true;if(libraryFilter==='seen')return e.rating>0;if(libraryFilter==='unrated')return e.rating===0;if(libraryFilter==='fav')return e.favorite;if(libraryFilter==='3')return a.sourceCount===3;if(['japan','france','world'].includes(libraryFilter))return a.sources[libraryFilter];return true});document.getElementById('libraryGrid').innerHTML=list.map(a=>libCardHTML(a)).join('')||`<div class="empty">Aucun anime pour ce filtre.</div>`;document.querySelectorAll('#libraryGrid [data-open]').forEach(x=>x.onclick=()=>openModal(+x.dataset.open));document.querySelectorAll('#libraryGrid [data-fav]').forEach(x=>x.onclick=e=>{e.stopPropagation();toggleFav(+x.dataset.fav)})}
function libCardHTML(a){const e=entry(a.id);return `<article class="lib-card" data-open="${a.id}">${thumbHTML(a)}<div class="lib-info"><div class="lib-rank">#${a.rank} · ${a.sourceCount}/3 SOURCES</div><div class="lib-title">${esc(a.title)}</div><div class="lib-meta">${a.sources.japan?'<span class="pill">🇯🇵 JAPON</span>':''}${a.sources.france?'<span class="pill">🇫🇷 FR</span>':''}${a.sources.world?'<span class="pill">🌍 RANKER</span>':''}</div><div class="lib-rating"><div class="rating-text">${e.rating?`<strong>${e.rating}★</strong> · ${esc(tierFor(e.rating).label.split('/')[0])}`:'0 · PAS VU'}</div><div class="mini-actions"><button class="${e.favorite?'on':''}" data-fav="${a.id}">♥</button><button>NOTER</button></div></div></div></article>`}

/* ---------- AniShelf: personal / consensus tier boards -------------------------- */
function renderTier(){const personal=tierMode==='personal';document.getElementById('tierBoard').innerHTML=TIERS.map(t=>{const items=CATALOG.filter(a=>(personal?entry(a.id).rating:a.consensusRating)===t.rating);return `<section class="tier-row" data-tier="${t.rating}"><div class="tier-label"><div class="tier-score">${t.rating===0?'0':t.rating+'★'}</div><div class="tier-copy"><strong>${esc(t.label)}</strong><span>${esc(t.sub)}</span></div><div class="tier-count">${items.length}</div></div><div class="tier-items">${items.map(a=>`<div class="tier-item" data-tier-open="${a.id}">${thumbHTML(a)}<div class="tier-item-title">${esc(a.title)}</div></div>`).join('')}</div></section>`}).join('');document.querySelectorAll('[data-tier-open]').forEach(x=>x.onclick=()=>openModal(+x.dataset.tierOpen))}

/* ---------- Detail sheet --------------------------------------------------------- */
function openModal(id){const a=CATALOG.find(x=>x.id===id),e=entry(id);document.getElementById('modalContent').innerHTML=`<div class="sheet-head">${thumbHTML(a)}<div style="flex:1"><div class="eyebrow">Consensus #${a.rank} · ${a.sourceCount}/3 sources</div><h3>${esc(a.title)}</h3><div style="display:flex;gap:5px">${sourceHTML(a)}</div><div style="margin-top:10px;font-size:11px;color:var(--muted)">Preset : <b style="color:white">${a.consensusRating}★ · ${esc(tierFor(a.consensusRating).label)}</b></div></div></div><div class="sheet-ratings">${ratingButtons(a.id,e.rating,true)}</div><label class="eyebrow" style="display:block;margin-top:15px">Note perso</label><textarea id="modalNote" class="field note" placeholder="Pourquoi ça marche — ou pas — pour toi ?">${esc(e.note||'')}</textarea><div class="actions-row"><button class="btn ${e.favorite?'orange':''}" id="modalFav">♥ Favori</button><button class="btn primary" id="modalSave">Enregistrer</button></div>`;document.getElementById('modalBackdrop').classList.add('open');document.querySelectorAll('#modalContent [data-rating]').forEach(b=>b.onclick=()=>{e.rating=+b.dataset.rating;document.querySelectorAll('#modalContent [data-rating]').forEach(x=>x.classList.toggle('selected',x===b))});document.getElementById('modalFav').onclick=()=>{e.favorite=!e.favorite;document.getElementById('modalFav').classList.toggle('orange',e.favorite)};document.getElementById('modalSave').onclick=()=>{e.note=document.getElementById('modalNote').value;save();closeModal();renderLibrary();renderDeck(true);if(tierMode==='personal')renderTier();toast('Fiche enregistrée')}}
function closeModal(){document.getElementById('modalBackdrop').classList.remove('open')}


/* ---------- PNG tier-list export -------------------------------------------------
 * The project deliberately avoids a screenshot library here.  We compose the image
 * ourselves on a <canvas>, which keeps GitHub Pages fully static/offline and gives
 * us a predictable share format on phones.  Real WEBP posters are used when they
 * exist; the committed SVG posters are the automatic fallback.
 */
function canvasPosterSource(a){
  return new Promise(resolve=>{
    const p=posterPaths(a), img=new Image();
    img.decoding='async';
    img.onload=()=>resolve(img);
    img.onerror=()=>{
      const fallback=new Image();
      fallback.onload=()=>resolve(fallback);
      fallback.onerror=()=>resolve(null);
      fallback.src=p.fallback;
    };
    img.src=p.primary;
  });
}
function roundRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function drawImageCover(ctx,img,x,y,w,h){
  if(!img){ctx.fillStyle='#2b2033';ctx.fillRect(x,y,w,h);return}
  const ir=img.width/img.height, r=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;
  if(ir>r){sw=img.height*r;sx=(img.width-sw)/2}else{sh=img.width/r;sy=(img.height-sh)/2}
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}
function wrapCanvasText(ctx,text,maxWidth,maxLines=2){
  const words=String(text).split(/\s+/),lines=[];let line='';
  for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth||!line){line=test}else{lines.push(line);line=word;if(lines.length===maxLines-1)break}}
  if(line&&lines.length<maxLines)lines.push(line);
  const consumed=lines.join(' ').length;if(consumed<text.length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';
  return lines;
}
async function exportTierImage(kind){
  const quick=kind==='quick';
  const rows=quick
    ? QUICK_TIERS.map(t=>({key:t.key,title:`${t.key} · ${t.label}`,sub:t.sub,color:getComputedStyle(document.documentElement).getPropertyValue(`--q${t.key.toLowerCase()}`).trim()||'#8f68ff',items:CATALOG.filter(a=>quickState.assignments[a.id]===t.key)}))
    : TIERS.filter(t=>t.rating>0).map(t=>({key:String(t.rating),title:`${t.rating}★ · ${t.label}`,sub:t.sub,color:t.rating===5?'#ff8b3d':t.rating===4.5?'#d78bff':t.rating===4?'#8f68ff':t.rating===3.5?'#5e8cff':t.rating===3?'#70e0ae':t.rating===2.5?'#dcc071':'#a77878',items:CATALOG.filter(a=>(tierMode==='personal'?entry(a.id).rating:a.consensusRating)===t.rating)}));
  const visibleRows=rows.filter(r=>r.items.length||quick);if(!visibleRows.length){toast('Rien à exporter pour le moment');return}
  toast('Création de l’image…');
  const W=1600,margin=64,labelW=310,cardW=126,cardH=176,gap=14,titleH=54,rowPad=20,rowGap=24,cols=Math.max(1,Math.floor((W-margin*2-labelW-32+gap)/(cardW+gap)));
  const rowHeights=visibleRows.map(r=>{const lines=Math.max(1,Math.ceil(r.items.length/cols));return Math.max(210,rowPad*2+lines*(cardH+titleH)+(lines-1)*gap)});
  const headerH=210,footerH=88,H=headerH+rowHeights.reduce((a,b)=>a+b,0)+rowGap*(visibleRows.length-1)+footerH+margin;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#120e17';ctx.fillRect(0,0,W,H);
  // subtle editorial grid
  ctx.strokeStyle='rgba(143,104,255,.08)';ctx.lineWidth=1;for(let x=0;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.fillStyle='#ff8b3d';ctx.fillRect(margin,56,92,12);ctx.fillStyle='#f7f0fb';ctx.font='900 66px system-ui, sans-serif';ctx.fillText('ANISHELF',margin,132);
  ctx.fillStyle='#a997b5';ctx.font='800 22px system-ui, sans-serif';const modeLabel=quick?'TIER SPRINT · S/A/B/C/D':(tierMode==='personal'?`CANON DE ${String(state.profileName||'MOI').toUpperCase()}`:'CONSENSUS ACTUEL');ctx.fillText(modeLabel,margin,170);
  ctx.textAlign='right';ctx.fillStyle='#8f68ff';ctx.font='900 24px system-ui, sans-serif';ctx.fillText(`${CATALOG.length} ANIME`,W-margin,92);ctx.fillStyle='#82738d';ctx.font='700 18px system-ui, sans-serif';ctx.fillText(new Date().toLocaleDateString('fr-CA'),W-margin,126);ctx.textAlign='left';
  let y=headerH;const posterCache=new Map();
  for(let ri=0;ri<visibleRows.length;ri++){
    const r=visibleRows[ri],rh=rowHeights[ri];ctx.fillStyle='#1b1422';roundRect(ctx,margin,y,W-margin*2,rh,14);ctx.fill();
    ctx.fillStyle=r.color||'#8f68ff';roundRect(ctx,margin,y,labelW,rh,14);ctx.fill();
    ctx.fillStyle='#171019';ctx.font='1000 44px system-ui, sans-serif';ctx.fillText(r.title,margin+28,y+66);
    ctx.font='800 18px system-ui, sans-serif';const subLines=wrapCanvasText(ctx,r.sub,labelW-56,3);subLines.forEach((line,i)=>ctx.fillText(line,margin+28,y+104+i*25));
    ctx.fillStyle='rgba(23,16,25,.65)';ctx.font='900 17px system-ui, sans-serif';ctx.fillText(`${r.items.length} œuvre${r.items.length>1?'s':''}`,margin+28,y+rh-28);
    let cx=margin+labelW+28,cy=y+rowPad;
    for(let i=0;i<r.items.length;i++){
      const a=r.items[i];if(i>0&&i%cols===0){cx=margin+labelW+28;cy+=cardH+titleH+gap}
      let img=posterCache.get(a.id);if(img===undefined){img=await canvasPosterSource(a);posterCache.set(a.id,img)}
      ctx.save();roundRect(ctx,cx,cy,cardW,cardH,8);ctx.clip();drawImageCover(ctx,img,cx,cy,cardW,cardH);ctx.restore();
      ctx.strokeStyle='#4a3658';ctx.lineWidth=2;roundRect(ctx,cx,cy,cardW,cardH,8);ctx.stroke();
      ctx.fillStyle='#c9bbd2';ctx.font='800 16px system-ui, sans-serif';const lines=wrapCanvasText(ctx,a.title,cardW,2);lines.forEach((line,li)=>ctx.fillText(line,cx,cy+cardH+22+li*19));
      cx+=cardW+gap;
    }
    y+=rh+(ri<visibleRows.length-1?rowGap:0);
  }
  const rated=quick?quickAssignedCount():CATALOG.filter(a=>entry(a.id).rating>0).length;ctx.fillStyle='#8f7e99';ctx.font='700 17px system-ui, sans-serif';ctx.fillText(quick?`${rated}/${CATALOG.length} classés`:(tierMode==='personal'?`${rated}/${CATALOG.length} vus et notés`:'Preset transculturel Japon · France · Ranker'),margin,H-52);ctx.textAlign='right';ctx.fillStyle='#ff8b3d';ctx.font='900 19px system-ui, sans-serif';ctx.fillText('anishelf · personal canon',W-margin,H-52);ctx.textAlign='left';
  canvas.toBlob(async blob=>{
    if(!blob){toast('Impossible de créer l’image');return}
    const filename=quick?'anishelf-tier-sprint.png':`anishelf-${tierMode==='personal'?slug(state.profileName||'profil'):'consensus'}.png`;
    const file=new File([blob],filename,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Ma tier list AniShelf'});toast('Image prête à partager');return}catch(e){/* cancelled: fall back to download */}}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Image PNG téléchargée ✓');
  },'image/png',.94);
}

/* ---------- Portable JSON profiles & friend comparison -------------------------- */
function exportProfile(){const payload={app:'AniShelf',version:APP_VERSION,exportedAt:new Date().toISOString(),profileName:state.profileName,catalogSize:CATALOG.length,entries:state.entries};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`anishelf-${slug(state.profileName||'profil')}.json`;a.click();URL.revokeObjectURL(url);toast('Profil exporté')}
function slug(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'profil'}
function importOwn(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.entries)throw 0;state={profileName:x.profileName||'Moi',entries:x.entries};save();document.getElementById('profileName').value=state.profileName;renderAll();toast('Sauvegarde importée')}catch(e){alert('Fichier AniShelf invalide.')}};r.readAsText(file)}
function importFriend(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.entries)throw 0;friendProfile=x;renderCompare();toast(`Profil de ${x.profileName||'ton ami'} chargé`)}catch(e){alert('Fichier AniShelf invalide.')}};r.readAsText(file)}
function friendEntry(id){return friendProfile?.entries?.[id]||friendProfile?.entries?.[String(id)]||{rating:0}}
function renderCompare(){const meta=document.getElementById('friendMeta'),stats=document.getElementById('compareStats'),content=document.getElementById('compareContent');if(!friendProfile){meta.textContent='';stats.innerHTML='';content.className='empty';content.textContent='Aucun profil ami chargé.';return}meta.innerHTML=`Duel contre <b>${esc(friendProfile.profileName||'Ami')}</b>`;const rows=CATALOG.map(a=>({a,mine:Number(entry(a.id).rating||0),theirs:Number(friendEntry(a.id).rating||0)})).filter(x=>x.mine>0&&x.theirs>0).map(x=>({...x,delta:Math.abs(x.mine-x.theirs)})).sort((a,b)=>b.delta-a.delta||a.a.rank-b.a.rank);const shared=rows.length,exact=rows.filter(x=>x.delta===0).length,close=rows.filter(x=>x.delta<=.5).length,avg=shared?rows.reduce((s,x)=>s+x.delta,0)/shared:0;stats.innerHTML=`<div class="stat"><b>${shared}</b><span>en commun</span></div><div class="stat"><b>${exact}</b><span>identiques</span></div><div class="stat"><b>${close}</b><span>à ±0.5</span></div><div class="stat"><b>${shared?avg.toFixed(2):'—'}</b><span>écart moyen</span></div>`;if(!shared){content.className='empty';content.textContent='Vous n’avez encore aucun anime noté en commun.';return}content.className='compare-list';content.innerHTML=rows.map(x=>`<div class="cmp"><div><h4>${esc(x.a.title)}</h4><small>Consensus #${x.a.rank}</small></div><div class="cmp-score"><div>${esc(state.profileName||'Moi')} <b>${x.mine}★</b></div><div>${esc(friendProfile.profileName||'Ami')} <b>${x.theirs}★</b></div><small>écart ${x.delta.toFixed(1)}★</small></div></div>`).join('')}
function switchView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.shelf-nav .nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='deck')renderDeck();if(name==='library')renderLibrary();if(name==='tier')renderTier();if(name==='friends')renderCompare();window.scrollTo(0,0)}
function renderAll(){renderGlobalStats();renderDeck();renderLibrary();renderTier();renderCompare()}

/* ---------- Navigation & DOM event wiring ---------------------------------------- */
// Events are bound once after the static HTML has loaded.
document.querySelectorAll('.shelf-nav .nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll('[data-deckmode]').forEach(b=>b.onclick=()=>{deckMode=b.dataset.deckmode;document.querySelectorAll('[data-deckmode]').forEach(x=>x.classList.toggle('active',x===b));renderDeck()});
document.getElementById('searchInput').oninput=renderLibrary;document.querySelectorAll('#filters [data-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.filter;document.querySelectorAll('#filters .chip').forEach(x=>x.classList.toggle('active',x===b));renderLibrary()});
document.querySelectorAll('[data-tiermode]').forEach(b=>b.onclick=()=>{tierMode=b.dataset.tiermode;document.querySelectorAll('[data-tiermode]').forEach(x=>x.classList.toggle('active',x===b));renderTier()});
document.getElementById('tierImageBtn').onclick=()=>exportTierImage('shelf');document.getElementById('printBtn').onclick=()=>{document.body.classList.add('print-shelf');window.print();setTimeout(()=>document.body.classList.remove('print-shelf'),300)};document.getElementById('resetRatingsBtn').onclick=()=>{if(confirm('Remettre toutes tes notes à 0 = pas vu ? Les favoris et commentaires restent.')){CATALOG.forEach(a=>entry(a.id).rating=0);save();renderAll();toast('Notes réinitialisées')}};
document.getElementById('profileName').value=state.profileName||'Moi';document.getElementById('saveNameBtn').onclick=()=>{state.profileName=document.getElementById('profileName').value.trim()||'Moi';save();renderCompare();toast('Pseudo enregistré')};
document.getElementById('exportBtn').onclick=exportProfile;document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();document.getElementById('importFile').onchange=e=>e.target.files[0]&&importOwn(e.target.files[0]);document.getElementById('friendImportBtn').onclick=()=>document.getElementById('friendFile').click();document.getElementById('friendFile').onchange=e=>e.target.files[0]&&importFriend(e.target.files[0]);

document.querySelectorAll('[data-appmode]').forEach(b=>b.onclick=()=>setAppMode(b.dataset.appmode));
document.querySelectorAll('.quick-nav [data-quick-view]').forEach(b=>b.onclick=()=>switchQuickView(b.dataset.quickView));
document.querySelectorAll('[data-quick-tier]').forEach(b=>b.onclick=()=>quickAssign(b.dataset.quickTier));
document.getElementById('quickUndo').onclick=quickUndo;document.getElementById('quickSkip').onclick=quickSkip;document.getElementById('quickFromStars').onclick=quickFromStars;document.getElementById('quickImage').onclick=()=>exportTierImage('quick');document.getElementById('quickReset').onclick=resetQuick;document.getElementById('quickPrint').onclick=()=>{document.body.classList.add('print-quick');window.print();setTimeout(()=>document.body.classList.remove('print-quick'),300)};

document.getElementById('modalClose').onclick=closeModal;document.getElementById('modalBackdrop').onclick=e=>{if(e.target.id==='modalBackdrop')closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(document.getElementById('view-deck').classList.contains('active')){if(e.key==='ArrowDown')scrollDeckTo(1);if(e.key==='ArrowUp')scrollDeckTo(-1)}});
normalizeQuickQueue();renderQuickTier();renderAll();setAppMode(appMode);
