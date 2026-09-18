
/*
 * AniShelf main application.
 * No framework is required: the site is intentionally plain HTML/CSS/JS so it can
 * be deployed directly to GitHub Pages.
 *
 * Poster priority:
 *   1) assets/posters/<id>.webp|jpg|jpeg|png  (manual/local override)
 *   2) AniList GraphQL coverImage.extraLarge/large (cached in localStorage)
 *   3) assets/posters/<id>.svg                (always available fallback)
 */
(() => {
  'use strict';

  const CATALOG = window.ANISHELF_CATALOG || [];
  const byId = new Map(CATALOG.map(a => [a.id, a]));
  const STORAGE = {
    mode: 'anishelf.mode.v3',
    quick: 'anishelf.quick.v3',
    shelf: 'anishelf.shelf.v3',
    posterCache: 'anishelf.posterCache.v3'
  };
  const STAR_TIERS = [5,4.5,4,3.5,3,2.5,2];
  const QUICK_TIERS = ['S','A','B','C','D'];

  let mode = localStorage.getItem(STORAGE.mode) || 'quick';
  let route = mode === 'quick' ? 'deck' : 'deck';
  let quick = readJson(STORAGE.quick, {assignments:{}, queue:[]});
  let shelf = readJson(STORAGE.shelf, {ratings:{}, notes:{}, favorites:[], profileName:'Moi', queue:[]});
  let posterCache = readJson(STORAGE.posterCache, {});
  let quickHistory = [];
  let shelfHistory = [];
  let friendProfile = null;
  let search = '';

  const main = document.getElementById('main');
  const nav = document.getElementById('bottomNav');
  const toast = document.getElementById('toast');
  const settingsDialog = document.getElementById('settingsDialog');

  // ---------- Generic helpers ----------
  function readJson(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
  function writeJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function save(){ writeJson(STORAGE.quick, quick); writeJson(STORAGE.shelf, shelf); writeJson(STORAGE.posterCache, posterCache); }
  function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function showToast(message){ toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),2200); }
  function download(name, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
  function localPosterCandidates(anime){ const base=`assets/posters/${anime.id}`; return [`${base}.webp`,`${base}.jpg`,`${base}.jpeg`,`${base}.png`]; }
  function fallbackPoster(anime){ return `assets/posters/${anime.id}.svg`; }

  // ---------- AniList poster service ----------
  // Requests are grouped into small GraphQL batches. This prevents a library grid
  // from firing dozens of API requests at once when it becomes visible.
  const posterWaiters = new Map();
  let posterQueue = [];
  let posterFlushTimer = null;
  function enqueueAniList(anime, force=false){
    const cached = posterCache[anime.id];
    if(!force && cached?.url) return Promise.resolve(cached.url);
    if(posterWaiters.has(anime.id)) return posterWaiters.get(anime.id).promise;
    let resolve; const promise = new Promise(r=>resolve=r);
    posterWaiters.set(anime.id,{promise,resolve}); posterQueue.push(anime);
    clearTimeout(posterFlushTimer); posterFlushTimer=setTimeout(flushPosterQueue,60);
    return promise;
  }
  async function flushPosterQueue(){
    const batch=posterQueue.splice(0,10);
    if(!batch.length) return;
    const vars={}, defs=[], fields=[];
    batch.forEach((a,i)=>{ vars['s'+i]=a.searchTitle||a.title; defs.push(`$s${i}: String`); fields.push(`m${i}: Media(search:$s${i}, type:ANIME, sort:POPULARITY_DESC){ id title{romaji english} coverImage{extraLarge large} }`); });
    const query=`query(${defs.join(',')}){${fields.join('\n')}}`;
    try{
      const res=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:vars})});
      if(!res.ok) throw new Error(`AniList ${res.status}`);
      const json=await res.json();
      batch.forEach((a,i)=>{
        const media=json?.data?.['m'+i]; const url=media?.coverImage?.extraLarge||media?.coverImage?.large||null;
        posterCache[a.id]={url,status:url?'anilist':'missing',anilistId:media?.id||null,updatedAt:Date.now()};
        posterWaiters.get(a.id)?.resolve(url); posterWaiters.delete(a.id);
      });
      writeJson(STORAGE.posterCache,posterCache);
    }catch(err){
      console.warn('AniList poster batch failed',err);
      batch.forEach(a=>{ posterCache[a.id]={url:null,status:'missing',updatedAt:Date.now()}; posterWaiters.get(a.id)?.resolve(null); posterWaiters.delete(a.id); });
      writeJson(STORAGE.posterCache,posterCache);
    }
    if(posterQueue.length) setTimeout(flushPosterQueue,700);
  }

  function tryImage(url, crossOrigin=false){
    return new Promise(resolve=>{ const img=new Image(); if(crossOrigin) img.crossOrigin='anonymous'; img.onload=()=>resolve(url); img.onerror=()=>resolve(null); img.src=url; });
  }
  async function findLocalPoster(anime){ for(const url of localPosterCandidates(anime)){ if(await tryImage(url)) return url; } return null; }
  async function resolvePoster(anime,{forceAniList=false}={}){
    const local=await findLocalPoster(anime); if(local) return {url:local,source:'local'};
    let remote=null;
    if(!forceAniList && posterCache[anime.id]?.url) remote=posterCache[anime.id].url;
    if(!remote) remote=await enqueueAniList(anime,forceAniList);
    if(remote) return {url:remote,source:'anilist'};
    return {url:fallbackPoster(anime),source:'fallback'};
  }

  // Mount a poster without ever showing a broken-image icon: fallback is rendered
  // immediately, then replaced by local/AniList art when available.
  function hydratePoster(img, anime, sourceBadge){
    img.src=fallbackPoster(anime);
    img.alt=anime.title;
    resolvePoster(anime).then(({url,source})=>{
      if(!img.isConnected) return;
      img.crossOrigin = source==='anilist' ? 'anonymous' : null;
      img.src=url;
      if(sourceBadge){ sourceBadge.textContent=source==='local'?'LOCAL':source==='anilist'?'ANILIST':'FALLBACK'; }
      img.onerror=()=>{ img.onerror=null; img.removeAttribute('crossorigin'); img.src=fallbackPoster(anime); if(sourceBadge) sourceBadge.textContent='FALLBACK'; };
    });
  }

  // Lazy hydrate posters in large grids; this keeps the app light on mobile.
  let observer=null;
  function observePosters(){
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>entries.forEach(e=>{ if(!e.isIntersecting)return; const img=e.target; const anime=byId.get(img.dataset.posterId); if(anime) hydratePoster(img,anime); observer.unobserve(img); }),{rootMargin:'300px'});
    document.querySelectorAll('img[data-poster-id]').forEach(img=>observer.observe(img));
  }

  // ---------- Mode + navigation ----------
  function setMode(next){ mode=next; route='deck'; localStorage.setItem(STORAGE.mode,mode); document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode)); render(); }
  document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  document.getElementById('settingsBtn').addEventListener('click',()=>settingsDialog.showModal());

  function navItems(){
    return mode==='quick'
      ? [['deck','◈','Classer'],['tiers','▦','Tier list']]
      : [['deck','◈','Classer'],['library','⌕','Biblio'],['tiers','▦','Tiers'],['friends','◎','Amis']];
  }
  function renderNav(){ nav.innerHTML=navItems().map(([r,ico,label])=>`<button class="nav-btn ${route===r?'active':''}" data-route="${r}"><i>${ico}</i>${label}</button>`).join(''); nav.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{route=b.dataset.route;render();}); }

  // ---------- Queues + deck cards ----------
  function quickQueue(){ const unranked=CATALOG.filter(a=>!quick.assignments[a.id]); if(!quick.queue.length) quick.queue=unranked.map(a=>a.id); else quick.queue=quick.queue.filter(id=>!quick.assignments[id]&&byId.has(id)); const set=new Set(quick.queue); unranked.forEach(a=>{if(!set.has(a.id))quick.queue.push(a.id)}); return quick.queue; }
  function shelfQueue(){ const unseen=CATALOG.filter(a=>!(a.id in shelf.ratings)); if(!shelf.queue.length) shelf.queue=unseen.map(a=>a.id); else shelf.queue=shelf.queue.filter(id=>!(id in shelf.ratings)&&byId.has(id)); const set=new Set(shelf.queue); unseen.forEach(a=>{if(!set.has(a.id))shelf.queue.push(a.id)}); return shelf.queue; }
  function deckCard(anime){ return `<div class="poster-card"><img id="activePoster" src="${fallbackPoster(anime)}" alt="${esc(anime.title)}"><span id="posterSource" class="poster-source">…</span><div class="poster-gradient"></div><div class="poster-meta"><div class="chips"><span class="chip">#${anime.rank}</span><span class="chip">CONSENSUS ${anime.consensus}★</span></div><h2>${esc(anime.title)}</h2></div></div>`; }
  function progressBlock(done,total,label){ return `<div class="progress"><i style="width:${total?done/total*100:0}%"></i></div><div class="progress-copy"><span>${label}</span><span>${done} / ${total}</span></div>`; }

  function renderQuickDeck(){
    const q=quickQueue(), anime=byId.get(q[0]); const done=Object.keys(quick.assignments).length;
    if(!anime){ main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Mode rapide</span><h1>Tout est classé.</h1>${progressBlock(CATALOG.length,CATALOG.length,'Progression')}</div><button class="wide-btn accent" id="goTiers">Voir la tier list</button></section>`; document.getElementById('goTiers').onclick=()=>{route='tiers';render()}; return; }
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Instinct d'abord</span><h1>Tu le mets où ?</h1>${progressBlock(done,CATALOG.length,'Classés')}</div><div class="deck">${deckCard(anime)}</div><div class="quick-actions">${QUICK_TIERS.map(t=>`<button data-tier="${t}">${t}</button>`).join('')}</div><div class="deck-tools"><button class="pill-btn" id="quickUndo">↶ Annuler</button><button class="pill-btn" id="quickSkip">Passer →</button></div></section>`;
    hydratePoster(document.getElementById('activePoster'),anime,document.getElementById('posterSource'));
    main.querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>{quick.assignments[anime.id]=b.dataset.tier;quickHistory.push(anime.id);quick.queue.shift();save();render();});
    document.getElementById('quickSkip').onclick=()=>{ if(q.length>1){quick.queue.push(quick.queue.shift());save();render();} };
    document.getElementById('quickUndo').onclick=()=>{const id=quickHistory.pop(); if(!id)return showToast('Rien à annuler'); delete quick.assignments[id]; quick.queue.unshift(id);save();render();};
  }

  function renderShelfDeck(){
    const q=shelfQueue(), anime=byId.get(q[0]); const done=Object.keys(shelf.ratings).length;
    if(!anime){ main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">AniShelf</span><h1>Catalogue noté.</h1>${progressBlock(done,CATALOG.length,'Vus')}</div><button id="openLibrary" class="wide-btn accent">Ouvrir la bibliothèque</button></section>`; document.getElementById('openLibrary').onclick=()=>{route='library';render()}; return; }
    const buttons=[5,4.5,4,3.5,3,2.5,2,0];
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Ton canon personnel</span><h1>Combien d'étoiles ?</h1>${progressBlock(done,CATALOG.length,'Notés')}</div><div class="deck">${deckCard(anime)}</div><div class="star-actions">${buttons.map(v=>`<button class="${v===5?'accent':''}" data-rating="${v}">${v===0?'Pas vu':v+'★'}</button>`).join('')}</div><div class="deck-tools"><button class="pill-btn" id="shelfUndo">↶ Annuler</button><button class="pill-btn" id="shelfSkip">Passer →</button></div></section>`;
    hydratePoster(document.getElementById('activePoster'),anime,document.getElementById('posterSource'));
    main.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{const v=Number(b.dataset.rating); shelf.ratings[anime.id]=v;shelfHistory.push(anime.id);shelf.queue.shift();save();render();});
    document.getElementById('shelfSkip').onclick=()=>{if(q.length>1){shelf.queue.push(shelf.queue.shift());save();render();}};
    document.getElementById('shelfUndo').onclick=()=>{const id=shelfHistory.pop(); if(!id)return showToast('Rien à annuler'); delete shelf.ratings[id];shelf.queue.unshift(id);save();render();};
  }

  // ---------- Library ----------
  function ratingLabel(v){ return v===0?'Pas vu':`${v}★`; }
  function renderLibrary(){
    const filtered=CATALOG.filter(a=>a.title.toLowerCase().includes(search.toLowerCase()));
    const seen=Object.values(shelf.ratings).filter(v=>v>0).length; const fives=Object.values(shelf.ratings).filter(v=>v===5).length; const values=Object.values(shelf.ratings).filter(v=>v>0); const avg=values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'—';
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Bibliothèque</span><h1>${esc(shelf.profileName||'Moi')}</h1></div><div class="stats"><div class="stat"><b>${seen}</b><span>vus</span></div><div class="stat"><b>${avg}</b><span>moyenne</span></div><div class="stat"><b>${fives}</b><span>5 étoiles</span></div></div><div class="searchbar"><input id="searchInput" placeholder="Rechercher un anime…" value="${esc(search)}"><button class="round-btn" id="refreshInline" title="Rafraîchir les posters">↻</button></div><div class="grid">${filtered.map(a=>`<article class="library-card" data-open="${a.id}"><div class="cover"><img data-poster-id="${a.id}" src="${fallbackPoster(a)}" alt="${esc(a.title)}"><span class="cover-badge">${a.id in shelf.ratings?ratingLabel(shelf.ratings[a.id]):'—'}</span></div><h3>${esc(a.title)}</h3><small>#${a.rank}</small></article>`).join('')}</div></section>`;
    document.getElementById('searchInput').oninput=e=>{search=e.target.value;renderLibrary();};
    document.getElementById('refreshInline').onclick=refreshMissingPosters;
    main.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>renderAnimeDetail(el.dataset.open));
    observePosters();
  }
  function renderAnimeDetail(id){
    const a=byId.get(id); if(!a)return; const r=shelf.ratings[id]; const fav=shelf.favorites.includes(id);
    main.innerHTML=`<section class="page"><button class="pill-btn" id="backLib">← Bibliothèque</button><div style="height:12px"></div><div class="poster-card" style="width:min(70vw,300px);margin:auto"><img id="detailPoster" src="${fallbackPoster(a)}" alt="${esc(a.title)}"><span id="detailSource" class="poster-source">…</span><div class="poster-gradient"></div><div class="poster-meta"><h2>${esc(a.title)}</h2></div></div><h2 style="margin-top:18px">Ta note</h2><div class="star-actions">${[5,4.5,4,3.5,3,2.5,2,0].map(v=>`<button class="${r===v?'accent':''}" data-detail-rating="${v}">${v===0?'Pas vu':v+'★'}</button>`).join('')}</div><button id="favBtn" class="wide-btn">${fav?'★ Retirer des favoris':'☆ Ajouter aux favoris'}</button><h3>Note personnelle</h3><textarea id="noteBox" class="note-box" placeholder="Pourquoi cette œuvre mérite cette note ?">${esc(shelf.notes[id]||'')}</textarea></section>`;
    hydratePoster(document.getElementById('detailPoster'),a,document.getElementById('detailSource'));
    document.getElementById('backLib').onclick=()=>{route='library';render();};
    main.querySelectorAll('[data-detail-rating]').forEach(b=>b.onclick=()=>{shelf.ratings[id]=Number(b.dataset.detailRating);save();renderAnimeDetail(id);});
    document.getElementById('favBtn').onclick=()=>{shelf.favorites=fav?shelf.favorites.filter(x=>x!==id):[...shelf.favorites,id];save();renderAnimeDetail(id);};
    document.getElementById('noteBox').onchange=e=>{shelf.notes[id]=e.target.value;save();showToast('Note enregistrée');};
  }

  // ---------- Tier boards ----------
  function tierThumb(a){return `<div class="tier-thumb" title="${esc(a.title)}"><img data-poster-id="${a.id}" src="${fallbackPoster(a)}" alt="${esc(a.title)}"></div>`;}
  function renderQuickTiers(){
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Tier list rapide</span><h1>Instinct pur.</h1></div><div class="export-actions"><button class="wide-btn accent" id="pngQuick">Partager en image</button><button class="wide-btn" id="prefillQuick">Depuis AniShelf</button></div><div id="tierCapture" class="tier-board">${QUICK_TIERS.map(t=>`<div class="tier-row"><div class="tier-label tier-${t}">${t}</div><div class="tier-items">${CATALOG.filter(a=>quick.assignments[a.id]===t).map(tierThumb).join('')}</div></div>`).join('')}</div></section>`;
    document.getElementById('pngQuick').onclick=()=>exportTierPng('quick');
    document.getElementById('prefillQuick').onclick=()=>{ const map=v=>v===5?'S':v===4.5?'A':v===4?'B':v===3.5?'C':(v>=2?'D':null); CATALOG.forEach(a=>{const t=map(shelf.ratings[a.id]);if(t)quick.assignments[a.id]=t});quick.queue=[];save();showToast('Tier rapide préremplie');render();};
    observePosters();
  }
  function renderShelfTiers(){
    const useConsensus = !Object.values(shelf.ratings).some(v=>v>0);
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">${useConsensus?'Preset par défaut':'Ton classement'}</span><h1>${useConsensus?'Consensus actuel.':'Ta tier list.'}</h1><p class="muted">${useConsensus?'Elle disparaît automatiquement dès que tu commences à noter.':'0 = pas vu et n’apparaît pas ici.'}</p></div><div class="export-actions"><button class="wide-btn accent" id="pngShelf">Partager en image</button><button class="wide-btn" onclick="window.print()">Imprimer / PDF</button></div><div id="tierCapture" class="tier-board">${STAR_TIERS.map(v=>{const items=CATALOG.filter(a=>(useConsensus?a.consensus:shelf.ratings[a.id])===v);return `<div class="tier-row"><div class="tier-label tier-${String(v).replace('.','')}">${v}★</div><div class="tier-items">${items.map(tierThumb).join('')}</div></div>`}).join('')}</div></section>`;
    document.getElementById('pngShelf').onclick=()=>exportTierPng(useConsensus?'consensus':'shelf'); observePosters();
  }

  // ---------- Friends / JSON profiles ----------
  function exportProfile(){ const payload={app:'AniShelf',version:3,exportedAt:new Date().toISOString(),profileName:shelf.profileName||'Moi',ratings:shelf.ratings,notes:shelf.notes,favorites:shelf.favorites}; download(`anishelf-${(shelf.profileName||'profil').toLowerCase().replace(/\s+/g,'-')}.json`,new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); }
  function renderFriends(){
    const common=friendProfile?CATALOG.filter(a=>shelf.ratings[a.id]>0&&friendProfile.ratings?.[a.id]>0):[];
    const rows=common.map(a=>({a,me:shelf.ratings[a.id],them:friendProfile.ratings[a.id],gap:Math.abs(shelf.ratings[a.id]-friendProfile.ratings[a.id])})).sort((x,y)=>y.gap-x.gap);
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Comparer</span><h1>Qui a les pires takes ?</h1></div><label>Ton pseudo</label><input id="profileName" class="note-box" style="min-height:0;margin:8px 0 16px" value="${esc(shelf.profileName||'Moi')}"><label class="compare-drop">Importer le JSON d’un ami<input id="friendInput" type="file" accept="application/json" hidden></label>${friendProfile?`<h2 style="margin-top:20px">${esc(shelf.profileName||'Moi')} vs ${esc(friendProfile.profileName||'Ami')}</h2><p class="muted">${common.length} anime notés en commun.</p><div class="compare-table">${rows.slice(0,40).map(x=>`<div class="compare-row"><b>${esc(x.a.title)}</b><span>${x.me}★</span><span>${x.them}★</span></div>`).join('')}</div>`:''}</section>`;
    document.getElementById('profileName').onchange=e=>{shelf.profileName=e.target.value.trim()||'Moi';save();};
    document.getElementById('friendInput').onchange=e=>readProfileFile(e.target.files[0],p=>{friendProfile=p;renderFriends();});
  }
  function readProfileFile(file,done){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!p.ratings)throw new Error();done(p);}catch{showToast('Profil JSON invalide')}};r.readAsText(file);}

  // ---------- PNG export ----------
  // The canvas exporter never depends on remote CORS succeeding. It tries the
  // current local/AniList art with crossorigin="anonymous" and falls back to the
  // same-origin SVG poster if the CDN refuses canvas access.
  async function canvasImageFor(a){
    const local=await findLocalPoster(a); if(local){const img=await loadCanvasImage(local,false);if(img)return img;}
    const remote=posterCache[a.id]?.url; if(remote){const img=await loadCanvasImage(remote,true);if(img)return img;}
    return await loadCanvasImage(fallbackPoster(a),false);
  }
  function loadCanvasImage(url,cors){return new Promise(resolve=>{const i=new Image();if(cors)i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url;});}
  async function exportTierPng(kind){
    showToast('Création du PNG…');
    let defs=[];
    if(kind==='quick') defs=QUICK_TIERS.map(t=>({label:t,color:{S:'#ff687c',A:'#ffad4d',B:'#61d8a5',C:'#55aaf2',D:'#9b88e7'}[t],items:CATALOG.filter(a=>quick.assignments[a.id]===t)}));
    else { const consensus=kind==='consensus'; defs=STAR_TIERS.map(v=>({label:`${v}★`,color:{5:'#ff744c',4.5:'#ff9e45',4:'#f4c751',3.5:'#75d7a5',3:'#62b3ef',2.5:'#9a8ee8',2:'#82768f'}[v],items:CATALOG.filter(a=>(consensus?a.consensus:shelf.ratings[a.id])===v)})); }
    const W=1500,pad=54,labelW=130,thumbW=86,thumbH=129,gap=10,rowPad=14,head=160;
    const rowHeights=defs.map(d=>Math.max(160,Math.ceil(Math.max(1,d.items.length)/13)*(thumbH+gap)+rowPad*2));
    const H=head+rowHeights.reduce((a,b)=>a+b+12,0)+70;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#15111e');g.addColorStop(1,'#261736');x.fillStyle=g;x.fillRect(0,0,W,H);
    x.fillStyle='#ff8a3d';x.font='900 26px Arial';x.fillText('ANISHELF',pad,56);x.fillStyle='#f8f4ff';x.font='900 54px Arial';x.fillText(kind==='quick'?'TIER LIST RAPIDE':kind==='consensus'?'CONSENSUS ACTUEL':`${shelf.profileName||'MON'} CANON`,pad,116);
    let y=head;
    for(let r=0;r<defs.length;r++){
      const d=defs[r],rh=rowHeights[r];x.fillStyle='#1d1728';roundRect(x,pad,y,W-pad*2,rh,20);x.fill();x.fillStyle=d.color;roundRect(x,pad,y,labelW,rh,20);x.fill();x.fillStyle='#160f1d';x.font='900 28px Arial';x.textAlign='center';x.fillText(d.label,pad+labelW/2,y+48);x.textAlign='left';
      for(let i=0;i<d.items.length;i++){
        const a=d.items[i],col=i%13,row=Math.floor(i/13),px=pad+labelW+14+col*(thumbW+gap),py=y+rowPad+row*(thumbH+gap);const img=await canvasImageFor(a);x.save();roundRect(x,px,py,thumbW,thumbH,9);x.clip();if(img)x.drawImage(img,px,py,thumbW,thumbH);else{x.fillStyle='#2b2038';x.fillRect(px,py,thumbW,thumbH)}x.restore();
      }
      y+=rh+12;
    }
    x.fillStyle='#9f92b3';x.font='18px Arial';x.fillText(`${new Date().toLocaleDateString('fr-CA')} · ${CATALOG.length} œuvres dans le catalogue`,pad,H-30);
    c.toBlob(async blob=>{if(!blob)return showToast('Export impossible');const file=new File([blob],'anishelf-tier-list.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Ma tier list AniShelf'});return}catch{}}download(file.name,blob);showToast('PNG téléchargé ✓');},'image/png',.94);
  }
  function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}

  // ---------- Poster maintenance ----------
  async function refreshMissingPosters(){
    const missing=CATALOG.filter(a=>!posterCache[a.id]?.url);
    if(!missing.length)return showToast('Aucune affiche AniList manquante');
    showToast(`Recherche de ${missing.length} affiches…`);
    for(let i=0;i<missing.length;i+=10){await Promise.all(missing.slice(i,i+10).map(a=>enqueueAniList(a,true))); await new Promise(r=>setTimeout(r,650));}
    save();showToast('Affiches actualisées ✓');render();
  }
  document.getElementById('refreshMissingPosters').onclick=()=>{settingsDialog.close();refreshMissingPosters();};
  document.getElementById('clearPosterCache').onclick=()=>{posterCache={};writeJson(STORAGE.posterCache,posterCache);showToast('Cache AniList vidé');settingsDialog.close();render();};
  document.getElementById('exportProfileBtn').onclick=()=>{exportProfile();settingsDialog.close();};
  document.getElementById('importProfileInput').onchange=e=>readProfileFile(e.target.files[0],p=>{shelf={...shelf,...p,queue:[]};save();showToast('Profil importé ✓');settingsDialog.close();render();});
  document.getElementById('resetCurrentMode').onclick=()=>{if(mode==='quick'){quick={assignments:{},queue:[]};quickHistory=[];}else{shelf={ratings:{},notes:{},favorites:[],profileName:shelf.profileName||'Moi',queue:[]};shelfHistory=[];}save();settingsDialog.close();showToast('Mode réinitialisé');render();};

  // ---------- Main render ----------
  function render(){
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    renderNav();
    if(mode==='quick'){ if(route==='tiers')renderQuickTiers(); else renderQuickDeck(); }
    else { if(route==='library')renderLibrary(); else if(route==='tiers')renderShelfTiers(); else if(route==='friends')renderFriends(); else renderShelfDeck(); }
    window.scrollTo({top:0,behavior:'instant'});
  }
  render();
})();
