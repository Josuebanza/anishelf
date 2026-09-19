/*
 * AniShelf v7 — application principale.
 *
 * Objectifs de cette version :
 * - une seule navigation cohérente (Accueil / Ma liste / Tri rapide / Tops / Profil) ;
 * - les étoiles restent des notes personnelles ;
 * - le Tri rapide devient l'unique source de la tier list ;
 * - suivi de lecture (En attente / En cours / Fini / Pas suivi) ;
 * - tops personnels par catégorie avec non-classés et réorganisation tactile ;
 * - synopsis stockés directement dans le catalogue local ;
 * - posters : local > AniList vérifié > SVG de secours.
 */
(() => {
  'use strict';

  const CATALOG = window.ANISHELF_CATALOG || [];
  const CATEGORIES = window.ANISHELF_CATEGORIES || [];
  const byId = new Map(CATALOG.map(a => [a.id, a]));

  const STORAGE = {
    quick: 'anishelf.quick.v7',
    shelf: 'anishelf.shelf.v7',
    posterCache: 'anishelf.posterCache.v5'
  };

  // Anciennes clés conservées uniquement pour migrer les données existantes.
  const LEGACY = {
    quick: ['anishelf.quick.v6', 'anishelf.quick.v3'],
    shelf: ['anishelf.shelf.v6', 'anishelf.shelf.v3']
  };

  // Le Tri rapide porte désormais la note elle-même :
  // S=5★, A=4.5★, B=4★, C=3.5★, D=3★, E=2.5★, F=2★.
  // "Pas fini" et "Pas vu" sont des états de classement sans note.
  const QUICK_TIERS = [
    {id:'S', label:'S', rating:5, short:'Immense', color:'#8b6cff'},
    {id:'A', label:'A', rating:4.5, short:'Chef-d’œuvre', color:'#ff9b42'},
    {id:'B', label:'B', rating:4, short:'Excellent', color:'#61d8a5'},
    {id:'C', label:'C', rating:3.5, short:'Mérite d’être vu', color:'#55aaf2'},
    {id:'D', label:'D', rating:3, short:'Bon / solide', color:'#4ec7c2'},
    {id:'E', label:'E', rating:2.5, short:'Correct / oubliable', color:'#9b88e7'},
    {id:'F', label:'F', rating:2, short:'Moyen / échec', color:'#e54855'},
    {id:'PF', label:'Pas fini', rating:null, short:'Pas assez vu pour trancher', color:'#7f788b'},
    {id:'PV', label:'Pas vu', rating:null, short:'Pas encore regardé', color:'#4d4858'}
  ];

  const WATCH_STATUSES = [
    {id:'untracked', label:'Pas suivi', icon:'○'},
    {id:'planned', label:'En attente', icon:'◷'},
    {id:'watching', label:'En cours', icon:'▶'},
    {id:'completed', label:'Fini', icon:'✓'}
  ];

  let quickMigratedFromLegacy = false;
  let route = 'home';
  let quickView = 'deck';
  let quick = migrateQuick();
  let shelf = migrateShelf();
  let posterCache = readJson(STORAGE.posterCache, {});
  let quickHistory = [];
  let friendProfile = null;
  let search = '';
  let watchFilter = 'all';
  let activeCategoryId = CATEGORIES[0]?.id || 'nouveaux';
  let detailReturnRoute = 'library';

  const main = document.getElementById('main');
  const nav = document.getElementById('bottomNav');
  const toast = document.getElementById('toast');
  const settingsDialog = document.getElementById('settingsDialog');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarHint = document.getElementById('topbarHint');

  // ---------- Generic helpers ----------
  function readJson(key, fallback){ try { const v=JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function writeJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function showToast(message){ toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),2200); }
  function download(name, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
  function fallbackPoster(anime){ return `assets/posters/${anime.id}.svg`; }
  function localPosterCandidates(anime){ const base=`assets/posters/${anime.id}`; return [`${base}.webp`,`${base}.jpg`,`${base}.jpeg`,`${base}.png`]; }
  function save(){ writeJson(STORAGE.quick, quick); writeJson(STORAGE.shelf, shelf); writeJson(STORAGE.posterCache, posterCache); }
  function statusOf(id){ return shelf.watchStatus[id] || 'untracked'; }
  function statusMeta(id){ return WATCH_STATUSES.find(s=>s.id===statusOf(id)) || WATCH_STATUSES[0]; }
  function ratingLabel(v){ return Number(v)>0 ? `${v}★` : '—'; }
  function tierMeta(id){ return QUICK_TIERS.find(t=>t.id===id); }
  function tierButtonHtml(t){
    if(t.rating) return `<span>${esc(t.label)}</span><small>${t.rating}★ · ${esc(t.short)}</small>`;
    return `<span>${esc(t.label)}</span><small>Sans note · ${esc(t.short)}</small>`;
  }
  function tierLabelHtml(t){
    return `<strong>${esc(t.label)}</strong><small>${t.rating ? `${t.rating}★` : 'Sans note'}</small>`;
  }

  function firstLegacy(keys, fallback){
    for(const key of keys){ const value=readJson(key,null); if(value) return value; }
    return fallback;
  }

  function migrateQuick(){
    const current=readJson(STORAGE.quick,null);
    if(current) return {assignments:current.assignments||{},queue:Array.isArray(current.queue)?current.queue:[]};

    const legacy=firstLegacy(LEGACY.quick,{assignments:{},queue:[]}) || {assignments:{},queue:[]};
    quickMigratedFromLegacy = true;

    // En v6, D signifiait "Correct / oubliable". En v7 cette valeur devient E=2.5★.
    const remapped={};
    for(const [id,tier] of Object.entries(legacy.assignments||{})){
      remapped[id] = tier === 'D' ? 'E' : tier;
    }
    return {assignments:remapped,queue:Array.isArray(legacy.queue)?legacy.queue:[]};
  }

  function migrateShelf(){
    const current=readJson(STORAGE.shelf,null);
    const legacy=current || firstLegacy(LEGACY.shelf,{ratings:{},notes:{},favorites:[],profileName:'Moi'}) || {};
    return {
      ratings:legacy.ratings||{},
      notes:legacy.notes||{},
      favorites:Array.isArray(legacy.favorites)?legacy.favorites:[],
      profileName:legacy.profileName||'Moi',
      watchStatus:legacy.watchStatus||{},
      categoryRanks:legacy.categoryRanks||{}
    };
  }

  // Lors de la première migration v6 -> v7, la tier list devient la source de note.
  function syncMigratedQuickRatings(){
    if(!quickMigratedFromLegacy) return;
    for(const [id,tierId] of Object.entries(quick.assignments||{})){
      const meta=tierMeta(tierId);
      if(meta?.rating) shelf.ratings[id]=meta.rating;
      else delete shelf.ratings[id];
    }
  }

  // ---------- AniList poster service ----------
  // Le matching flou d'AniList peut renvoyer une saison ou un homonyme. Lorsqu'un
  // anilistId est présent dans le catalogue il est prioritaire ; sinon on note
  // plusieurs candidats selon titre, synonymes, année et format.
  const posterWaiters = new Map();
  let posterQueue = [];
  let posterFlushTimer = null;

  function normalizeTitle(value=''){
    return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function mediaNames(media){ return [media?.title?.english,media?.title?.romaji,media?.title?.native,...(media?.synonyms||[])].filter(Boolean); }
  function titleScore(anime,media){
    const wanted=[anime.title,anime.searchTitle,...(anime.aliases||[])].filter(Boolean).map(normalizeTitle);
    const names=mediaNames(media).map(normalizeTitle);
    let best=0;
    for(const w of wanted){
      for(const n of names){
        if(!w||!n) continue;
        if(w===n) best=Math.max(best,1000);
        else if(w.includes(n)||n.includes(w)) best=Math.max(best,720-Math.abs(w.length-n.length));
        else {
          const wa=new Set(w.split(' ')), na=new Set(n.split(' '));
          const common=[...wa].filter(x=>na.has(x)).length;
          const union=new Set([...wa,...na]).size||1;
          best=Math.max(best,Math.round((common/union)*500));
        }
      }
    }
    if(anime.year&&media?.seasonYear){ const gap=Math.abs(Number(anime.year)-Number(media.seasonYear)); if(gap===0)best+=90;else if(gap===1)best+=25;else if(gap>=4)best-=80; }
    if(['MOVIE','SPECIAL','OVA','ONA'].includes(media?.format)&&anime.preferredFormat==='TV') best-=120;
    return best;
  }
  function pickBestMedia(anime,payload){
    if(anime.anilistId) return payload||null;
    const list=payload?.media||[];
    const scored=list.map(m=>({m,score:titleScore(anime,m)})).sort((a,b)=>b.score-a.score);
    const unused=scored.find(({m,score})=> score>=220 && !Object.entries(posterCache).some(([id,c])=>id!==anime.id&&c?.anilistId===m.id&&c?.url));
    return unused?.m||null;
  }
  function enqueueAniList(anime,force=false){
    const cached=posterCache[anime.id];
    if(!force&&cached?.url) return Promise.resolve(cached.url);
    if(posterWaiters.has(anime.id)) return posterWaiters.get(anime.id).promise;
    let resolve; const promise=new Promise(r=>resolve=r);
    posterWaiters.set(anime.id,{promise,resolve}); posterQueue.push(anime);
    clearTimeout(posterFlushTimer); posterFlushTimer=setTimeout(flushPosterQueue,60);
    return promise;
  }
  async function flushPosterQueue(){
    const batch=posterQueue.splice(0,8); if(!batch.length)return;
    const vars={},defs=[],fields=[];
    batch.forEach((a,i)=>{
      if(Number.isInteger(a.anilistId)){
        vars['id'+i]=a.anilistId; defs.push(`$id${i}: Int`);
        fields.push(`m${i}: Media(id:$id${i}, type:ANIME){ id seasonYear format synonyms title{romaji english native} coverImage{extraLarge large} }`);
      } else {
        vars['s'+i]=a.searchTitle||a.title; defs.push(`$s${i}: String`);
        fields.push(`m${i}: Page(page:1, perPage:6){ media(search:$s${i}, type:ANIME){ id seasonYear format synonyms title{romaji english native} coverImage{extraLarge large} } }`);
      }
    });
    try{
      const query=`query(${defs.join(',')}){${fields.join('\n')}}`;
      const res=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:vars})});
      if(!res.ok) throw new Error(`AniList ${res.status}`);
      const json=await res.json();
      batch.forEach((a,i)=>{
        const media=pickBestMedia(a,json?.data?.['m'+i]);
        const url=media?.coverImage?.extraLarge||media?.coverImage?.large||null;
        posterCache[a.id]={url,status:url?'anilist':'missing',anilistId:media?.id||a.anilistId||null,matchedTitle:media?.title?.english||media?.title?.romaji||null,updatedAt:Date.now()};
        posterWaiters.get(a.id)?.resolve(url); posterWaiters.delete(a.id);
      });
      writeJson(STORAGE.posterCache,posterCache);
    }catch(err){
      console.warn('AniList poster batch failed',err);
      batch.forEach(a=>{posterCache[a.id]={url:null,status:'missing',updatedAt:Date.now()};posterWaiters.get(a.id)?.resolve(null);posterWaiters.delete(a.id);});
      writeJson(STORAGE.posterCache,posterCache);
    }
    if(posterQueue.length)setTimeout(flushPosterQueue,750);
  }
  function tryImage(url,crossOrigin=false){ return new Promise(resolve=>{const img=new Image();if(crossOrigin)img.crossOrigin='anonymous';img.onload=()=>resolve(url);img.onerror=()=>resolve(null);img.src=url;}); }
  async function findLocalPoster(anime){ for(const url of localPosterCandidates(anime)){if(await tryImage(url))return url;}return null; }
  async function resolvePoster(anime,{forceAniList=false}={}){
    const local=await findLocalPoster(anime); if(local)return{url:local,source:'local'};
    let remote=!forceAniList&&posterCache[anime.id]?.url?posterCache[anime.id].url:null;
    if(!remote)remote=await enqueueAniList(anime,forceAniList);
    return remote?{url:remote,source:'anilist'}:{url:fallbackPoster(anime),source:'fallback'};
  }
  function hydratePoster(img,anime,sourceBadge){
    img.src=fallbackPoster(anime); img.alt=anime.title;
    resolvePoster(anime).then(({url,source})=>{
      if(!img.isConnected)return;
      if(source==='anilist')img.crossOrigin='anonymous';else img.removeAttribute('crossorigin');
      img.src=url;
      if(sourceBadge)sourceBadge.textContent=source==='local'?'LOCAL':source==='anilist'?'ANILIST':'FALLBACK';
      img.onerror=()=>{img.onerror=null;img.removeAttribute('crossorigin');img.src=fallbackPoster(anime);if(sourceBadge)sourceBadge.textContent='FALLBACK';};
    });
  }
  let observer=null;
  function observePosters(){
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;const img=e.target,anime=byId.get(img.dataset.posterId);if(anime)hydratePoster(img,anime);observer.unobserve(img);}),{rootMargin:'300px'});
    document.querySelectorAll('img[data-poster-id]').forEach(img=>observer.observe(img));
  }

  // ---------- Navigation ----------
  const NAV = [
    ['home','⌂','Accueil'],
    ['library','▤','Ma liste'],
    ['quick','◈','Tri rapide'],
    ['tops','✦','Mes tops'],
    ['profile','◎','Profil']
  ];
  const ROUTE_TITLES={home:['Accueil','Ton anime shelf personnel'],library:['Ma liste','À voir, en cours et terminés'],quick:['Tri rapide','L’unique source de ta tier list'],tops:['Mes tops','Classe chaque genre à ta manière'],profile:['Profil & amis','Notes, favoris et comparaisons']};
  function go(next){route=next;render();}
  function renderNav(){
    nav.innerHTML=NAV.map(([r,ico,label])=>`<button class="nav-btn ${route===r?'active':''}" data-route="${r}"><i>${ico}</i>${label}</button>`).join('');
    nav.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>go(b.dataset.route));
  }
  function updateTopbar(){ const [title,hint]=ROUTE_TITLES[route]||ROUTE_TITLES.home;topbarTitle.textContent=title;topbarHint.textContent=hint; }
  document.getElementById('homeBrand').onclick=()=>go('home');
  document.getElementById('settingsBtn').onclick=()=>settingsDialog.showModal();

  // ---------- Shared UI helpers ----------
  function coverHtml(a,badge=''){return `<div class="cover"><img data-poster-id="${a.id}" src="${fallbackPoster(a)}" alt="${esc(a.title)}">${badge?`<span class="cover-badge">${esc(badge)}</span>`:''}</div>`;}
  function progressBlock(done,total,label){return `<div class="progress"><i style="width:${total?done/total*100:0}%"></i></div><div class="progress-copy"><span>${label}</span><span>${done} / ${total}</span></div>`;}
  function synopsis(a){return a.synopsis||'Synopsis à compléter dans data/catalog.json.';}

  // ---------- Home ----------
  function renderHome(){
    const planned=Object.values(shelf.watchStatus).filter(v=>v==='planned').length;
    const watching=Object.values(shelf.watchStatus).filter(v=>v==='watching').length;
    const completed=Object.values(shelf.watchStatus).filter(v=>v==='completed').length;
    const ranked=Object.keys(quick.assignments).length;
    const next=byId.get(quickQueue()[0]);
    const recent=CATALOG.filter(a=>String(a.badge||'').toLowerCase()==='nouveau').slice(0,8);
    main.innerHTML=`<section class="page home-page">
      <div class="home-hero"><span class="eyebrow">AniShelf</span><h1>Regarde. Note.<br>Classe sans te répéter.</h1><p>Une seule app pour suivre ce que tu regardes, voter, construire tes tops et sortir ta tier list finale.</p></div>
      <div class="home-stats"><div><b>${watching}</b><span>En cours</span></div><div><b>${planned}</b><span>En attente</span></div><div><b>${completed}</b><span>Finis</span></div><div><b>${ranked}</b><span>Classés</span></div></div>
      <div class="home-menu">
        <button data-home-route="library" class="home-action"><span>▤</span><div><strong>Gérer ma liste</strong><small>En attente, en cours, fini ou pas suivi.</small></div><b>→</b></button>
        <button data-home-route="quick" class="home-action featured"><span>◈</span><div><strong>Continuer le tri rapide</strong><small>S=5★ à F=2★, plus “Pas fini” et “Pas vu”. Un choix = un tier + une note.</small></div><b>→</b></button>
        <button data-home-route="tops" class="home-action"><span>✦</span><div><strong>Construire mes tops</strong><small>Classe Action, classiques, sport, romance… par glisser-déposer.</small></div><b>→</b></button>
        <button data-home-route="profile" class="home-action"><span>◎</span><div><strong>Mon profil & mes amis</strong><small>Favoris, notes, export et comparaisons.</small></div><b>→</b></button>
      </div>
      ${next?`<div class="section-title"><h2>À classer ensuite</h2><button class="pill-btn" id="homeQuick">Ouvrir</button></div><article class="continue-card" id="homeQuickCard">${coverHtml(next,tierMeta(quick.assignments[next.id])?.label||'NON CLASSÉ')}<div><span class="eyebrow">#${next.rank}</span><h3>${esc(next.title)}</h3><p>${esc(synopsis(next))}</p></div></article>`:''}
      ${recent.length?`<div class="section-title"><h2>Nouveaux au catalogue</h2></div><div class="mini-shelf">${recent.map(a=>`<button class="mini-poster" data-home-open="${a.id}">${coverHtml(a,'NOUVEAU')}<span>${esc(a.title)}</span></button>`).join('')}</div>`:''}
    </section>`;
    main.querySelectorAll('[data-home-route]').forEach(b=>b.onclick=()=>go(b.dataset.homeRoute));
    document.getElementById('homeQuick')?.addEventListener('click',()=>go('quick'));
    document.getElementById('homeQuickCard')?.addEventListener('click',()=>go('quick'));
    main.querySelectorAll('[data-home-open]').forEach(b=>b.onclick=()=>{detailReturnRoute='home';renderAnimeDetail(b.dataset.homeOpen);});
    observePosters();
  }

  // ---------- Watchlist / library ----------
  function renderLibrary(){
    const counts=Object.fromEntries(WATCH_STATUSES.map(s=>[s.id,CATALOG.filter(a=>statusOf(a.id)===s.id).length]));
    const filtered=CATALOG.filter(a=>{
      const matches=a.title.toLowerCase().includes(search.toLowerCase());
      const state=watchFilter==='all'||statusOf(a.id)===watchFilter;
      return matches&&state;
    });
    main.innerHTML=`<section class="page">
      <div class="hero"><span class="eyebrow">Ma liste</span><h1>Où tu en es.</h1><p class="muted">Tu peux noter ici manuellement ; le Tri rapide remplit aussi automatiquement la note correspondant au tier choisi.</p></div>
      <div class="watch-stats">${WATCH_STATUSES.slice(1).map(s=>`<button data-watch-filter="${s.id}"><b>${counts[s.id]||0}</b><span>${s.label}</span></button>`).join('')}</div>
      <div class="status-tabs"><button class="status-tab ${watchFilter==='all'?'active':''}" data-watch-filter="all">Tout</button>${WATCH_STATUSES.map(s=>`<button class="status-tab ${watchFilter===s.id?'active':''}" data-watch-filter="${s.id}">${s.icon} ${s.label}</button>`).join('')}</div>
      <div class="searchbar"><input id="searchInput" placeholder="Rechercher un anime…" value="${esc(search)}"><button class="round-btn" id="refreshInline" title="Rafraîchir les posters">↻</button></div>
      <div class="grid">${filtered.map(a=>{const st=statusMeta(a.id);return `<article class="library-card" data-open="${a.id}">${coverHtml(a,ratingLabel(shelf.ratings[a.id]))}<h3>${esc(a.title)}</h3><small>${st.icon} ${st.label}${a.year?` · ${a.year}`:''}</small></article>`}).join('')}</div>
      ${!filtered.length?'<div class="empty-panel"><strong>Rien ici pour l’instant.</strong><p>Change de filtre ou ajoute un anime à ta liste depuis sa fiche.</p></div>':''}
    </section>`;
    document.getElementById('searchInput').oninput=e=>{search=e.target.value;renderLibrary();};
    document.getElementById('refreshInline').onclick=refreshMissingPosters;
    main.querySelectorAll('[data-watch-filter]').forEach(b=>b.onclick=()=>{watchFilter=b.dataset.watchFilter;renderLibrary();});
    main.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>{detailReturnRoute='library';renderAnimeDetail(el.dataset.open);});
    observePosters();
  }

  // ---------- Anime detail ----------
  function renderAnimeDetail(id){
    const a=byId.get(id); if(!a)return;
    const r=shelf.ratings[id]; const fav=shelf.favorites.includes(id); const currentStatus=statusOf(id); const qTier=quick.assignments[id];
    const catTags=CATEGORIES.filter(c=>c.ids.includes(id)).slice(0,4);
    main.innerHTML=`<section class="page detail-page">
      <button class="pill-btn" id="detailBack">← Retour</button>
      <div class="detail-layout"><div class="poster-card detail-poster"><img id="detailPoster" src="${fallbackPoster(a)}" alt="${esc(a.title)}"><span id="detailSource" class="poster-source">…</span><div class="poster-gradient"></div><div class="poster-meta"><h2>${esc(a.title)}</h2></div></div>
      <div class="detail-copy"><div class="detail-tags">${catTags.map(c=>`<span>${esc(c.title)}</span>`).join('')}${a.year?`<span>${a.year}</span>`:''}${qTier?`<span>Tier ${esc(qTier)}${tierMeta(qTier)?.rating?` · ${tierMeta(qTier).rating}★`:''}</span>`:''}</div><h2>Synopsis</h2><p class="synopsis">${esc(synopsis(a))}</p></div></div>
      <h2>Suivi</h2><div class="watch-choice">${WATCH_STATUSES.map(s=>`<button class="${currentStatus===s.id?'active':''}" data-status="${s.id}"><span>${s.icon}</span>${s.label}</button>`).join('')}</div>
      <h2>Ta note</h2><p class="muted">Le Tri rapide renseigne automatiquement cette note. Tu peux toujours voter ici manuellement ; le prochain classement rapide resynchronisera la note.</p><div class="star-actions">${[5,4.5,4,3.5,3,2.5,2,0].map(v=>`<button class="${r===v?'accent':''}" data-detail-rating="${v}">${v===0?'Effacer':v+'★'}</button>`).join('')}</div>
      <button id="favBtn" class="wide-btn">${fav?'★ Retirer des favoris':'☆ Ajouter aux favoris'}</button>${qTier?`<button id="reclassifyBtn" class="wide-btn">↻ Reclasser via le Tri rapide</button>`:''}
      <h3>Note personnelle</h3><textarea id="noteBox" class="note-box" placeholder="Pourquoi cette œuvre te marque… ou pas ?">${esc(shelf.notes[id]||'')}</textarea>
    </section>`;
    hydratePoster(document.getElementById('detailPoster'),a,document.getElementById('detailSource'));
    document.getElementById('detailBack').onclick=()=>go(detailReturnRoute||'library');
    main.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{shelf.watchStatus[id]=b.dataset.status;save();renderAnimeDetail(id);});
    main.querySelectorAll('[data-detail-rating]').forEach(b=>b.onclick=()=>{const v=Number(b.dataset.detailRating);if(v===0)delete shelf.ratings[id];else shelf.ratings[id]=v;save();renderAnimeDetail(id);});
    document.getElementById('favBtn').onclick=()=>{shelf.favorites=fav?shelf.favorites.filter(x=>x!==id):[...new Set([...shelf.favorites,id])];save();renderAnimeDetail(id);};
    document.getElementById('reclassifyBtn')?.addEventListener('click',()=>{delete quick.assignments[id];quick.queue=quick.queue.filter(x=>x!==id);quick.queue.unshift(id);quickView='deck';save();go('quick');});
    document.getElementById('noteBox').onchange=e=>{shelf.notes[id]=e.target.value;save();showToast('Note enregistrée');};
  }

  // ---------- Quick sort: only tier-list source ----------
  function quickQueue(){
    const unranked=CATALOG.filter(a=>!quick.assignments[a.id]);
    if(!quick.queue.length)quick.queue=unranked.map(a=>a.id);
    else quick.queue=quick.queue.filter(id=>!quick.assignments[id]&&byId.has(id));
    const set=new Set(quick.queue); unranked.forEach(a=>{if(!set.has(a.id))quick.queue.push(a.id)});
    return quick.queue;
  }
  function deckCard(anime){
    const signal=Number.isFinite(anime.consensus)?`CONSENSUS ${anime.consensus}★`:(anime.badge||anime.year||'À CLASSER');
    return `<div class="poster-card"><img id="activePoster" src="${fallbackPoster(anime)}" alt="${esc(anime.title)}"><span id="posterSource" class="poster-source">…</span><div class="poster-gradient"></div><div class="poster-meta"><div class="chips"><span class="chip">#${anime.rank}</span><span class="chip">${esc(String(signal))}</span></div><h2>${esc(anime.title)}</h2></div></div>`;
  }
  function renderQuick(){ if(quickView==='tiers')renderQuickTiers();else renderQuickDeck(); }
  function renderQuickDeck(){
    const q=quickQueue(),anime=byId.get(q[0]),done=Object.keys(quick.assignments).length;
    if(!anime){main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Tri rapide</span><h1>Tout est classé.</h1>${progressBlock(done,CATALOG.length,'Classés')}</div><button class="wide-btn accent" id="seeQuickTiers">Voir ma tier list</button></section>`;document.getElementById('seeQuickTiers').onclick=()=>{quickView='tiers';renderQuick();};return;}
    main.innerHTML=`<section class="page"><div class="hero"><div class="hero-actions"><div><span class="eyebrow">Tri rapide</span><h1>Tu le mets où ?</h1></div><button class="pill-btn" id="showQuickTiers">Voir les tiers</button></div>${progressBlock(done,CATALOG.length,'Classés')}</div><div class="deck">${deckCard(anime)}</div><p class="deck-synopsis">${esc(synopsis(anime))}</p><p class="quick-map-note">Chaque choix de S à F enregistre aussi ta note étoile. “Pas fini” et “Pas vu” restent sans note.</p><div class="quick-actions expanded">${QUICK_TIERS.map(t=>`<button class="quick-${t.id}" data-tier="${t.id}" title="${esc(t.short)}">${tierButtonHtml(t)}</button>`).join('')}</div><div class="deck-tools"><button class="pill-btn" id="quickUndo">↶ Annuler</button><button class="pill-btn" id="quickSkip">Passer →</button></div></section>`;
    hydratePoster(document.getElementById('activePoster'),anime,document.getElementById('posterSource'));
    main.querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>{
      const tierId=b.dataset.tier;
      const meta=tierMeta(tierId);
      const hadRating=Object.prototype.hasOwnProperty.call(shelf.ratings,anime.id);
      quickHistory.push({id:anime.id,previousTier:quick.assignments[anime.id]||null,hadRating,previousRating:shelf.ratings[anime.id]});
      quick.assignments[anime.id]=tierId;
      if(meta?.rating) shelf.ratings[anime.id]=meta.rating;
      else delete shelf.ratings[anime.id];
      quick.queue.shift();
      save();
      showToast(meta?.rating ? `${meta.label} · ${meta.rating}★ enregistré` : `${meta?.label || tierId} · sans note`);
      renderQuickDeck();
    });
    document.getElementById('quickSkip').onclick=()=>{if(q.length>1){quick.queue.push(quick.queue.shift());save();renderQuickDeck();}};
    document.getElementById('quickUndo').onclick=()=>{
      const last=quickHistory.pop();
      if(!last)return showToast('Rien à annuler');
      if(last.previousTier) quick.assignments[last.id]=last.previousTier;
      else delete quick.assignments[last.id];
      if(last.hadRating) shelf.ratings[last.id]=last.previousRating;
      else delete shelf.ratings[last.id];
      if(!quick.queue.includes(last.id)) quick.queue.unshift(last.id);
      save();
      renderQuickDeck();
    };
    document.getElementById('showQuickTiers').onclick=()=>{quickView='tiers';renderQuick();};
  }
  function tierThumb(a){return `<button class="tier-thumb" data-tier-open="${a.id}" title="${esc(a.title)}"><img data-poster-id="${a.id}" src="${fallbackPoster(a)}" alt="${esc(a.title)}"></button>`;}
  function renderQuickTiers(){
    const unranked=CATALOG.filter(a=>!quick.assignments[a.id]);
    main.innerHTML=`<section class="page"><div class="hero"><div class="hero-actions"><div><span class="eyebrow">Ta tier list</span><h1>Un seul classement.</h1></div><button class="pill-btn" id="backToQuick">Reprendre le tri</button></div><p class="muted">S=5★, A=4.5★, B=4★, C=3.5★, D=3★, E=2.5★, F=2★. “Pas fini” et “Pas vu” restent sans note. ${unranked.length} non classés.</p></div><div class="export-actions"><button class="wide-btn accent" id="pngQuick">Partager en image</button></div><div class="tier-board">${QUICK_TIERS.map(t=>`<div class="tier-row"><div class="tier-label tier-${t.id}">${tierLabelHtml(t)}</div><div class="tier-items">${CATALOG.filter(a=>quick.assignments[a.id]===t.id).map(tierThumb).join('')}</div></div>`).join('')}</div>${unranked.length?`<div class="outside-consensus"><h3>Non classés</h3><div class="mini-grid">${unranked.slice(0,50).map(tierThumb).join('')}</div></div>`:''}</section>`;
    document.getElementById('backToQuick').onclick=()=>{quickView='deck';renderQuick();};
    document.getElementById('pngQuick').onclick=exportQuickTierPng;
    main.querySelectorAll('[data-tier-open]').forEach(b=>b.onclick=()=>{detailReturnRoute='quick';renderAnimeDetail(b.dataset.tierOpen);});
    observePosters();
  }

  // ---------- Category ranking ----------
  function categoryState(category){
    const raw=shelf.categoryRanks[category.id]||{};
    const allowed=new Set(category.ids.filter(id=>byId.has(id)));
    const ranked=(raw.ranked||[]).filter(id=>allowed.has(id));
    const skipped=(raw.skipped||[]).filter(id=>allowed.has(id)&&!ranked.includes(id));
    const state={ranked,skipped}; shelf.categoryRanks[category.id]=state; return state;
  }
  function saveCategoryState(){save();}
  function nextCategoryCandidate(category,state){
    const unranked=category.ids.filter(id=>byId.has(id)&&!state.ranked.includes(id));
    if(!unranked.length)return null;
    let available=unranked.filter(id=>!state.skipped.includes(id));
    if(!available.length){state.skipped=[];available=unranked;}
    return byId.get(available[0]);
  }
  function addToCategory(category,id){
    const state=categoryState(category); if(!category.ids.includes(id)||state.ranked.includes(id))return;
    state.ranked.push(id); state.skipped=state.skipped.filter(x=>x!==id); saveCategoryState(); renderTops();
  }
  function renderTops(){
    const category=CATEGORIES.find(c=>c.id===activeCategoryId)||CATEGORIES[0]; if(!category)return;
    const state=categoryState(category),candidate=nextCategoryCandidate(category,state);
    const unranked=category.ids.filter(id=>byId.has(id)&&!state.ranked.includes(id));
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Mes tops par catégorie</span><h1>${esc(category.title)}</h1><p class="muted">${esc(category.subtitle||'Classe-les dans ton ordre.')}</p></div><div class="category-tabs">${CATEGORIES.map(c=>`<button class="category-tab ${c.id===category.id?'active':''}" data-category="${c.id}">${c.icon||'•'} ${esc(c.title)}</button>`).join('')}</div>
      ${candidate?`<div class="category-candidate"><div class="candidate-poster">${coverHtml(candidate,'À CLASSER')}</div><div class="candidate-copy"><span class="eyebrow">Prochain candidat</span><h2>${esc(candidate.title)}</h2><p>${esc(synopsis(candidate))}</p><div class="candidate-actions"><button class="wide-btn accent" id="catAddCandidate">Ajouter à mon top</button><button class="wide-btn" id="catSkipCandidate">Passer</button><button class="wide-btn ghost" id="catOpenCandidate">Voir la fiche</button></div></div></div>`:`<div class="empty-panel"><strong>Tout est dans ton top.</strong><p>Tu peux encore réordonner ou retirer des titres vers “Non classés”.</p></div>`}
      <div class="top-builder-head"><div><span class="eyebrow">Mon classement</span><h2>${state.ranked.length?`${state.ranked.length} classés`:'Vide pour l’instant'}</h2></div><button class="pill-btn" id="seedCategory">${state.ranked.length?'Réinitialiser':'Préremplir'}</button></div>
      <div id="rankedList" class="rank-editor">${state.ranked.map((id,i)=>{const a=byId.get(id);return `<article class="rank-edit-row" data-rank-id="${id}"><button class="drag-handle" aria-label="Glisser pour réordonner">≡</button><div class="rank-number">${i+1}</div><div class="rank-cover"><img data-poster-id="${id}" src="${fallbackPoster(a)}" alt="${esc(a.title)}"></div><button class="rank-title" data-rank-open="${id}"><strong>${esc(a.title)}</strong><small>${ratingLabel(shelf.ratings[id])}</small></button><div class="rank-actions"><button data-up="${id}" aria-label="Monter">↑</button><button data-down="${id}" aria-label="Descendre">↓</button><button data-remove-rank="${id}" aria-label="Retirer">×</button></div></article>`}).join('')}${!state.ranked.length?'<div class="rank-empty">Ajoute un titre ci-dessus ou depuis les non classés.</div>':''}</div>
      <div class="unranked-head"><div><span class="eyebrow">Non classés</span><h2>${unranked.length} restants</h2></div></div><div class="unranked-grid">${unranked.map(id=>{const a=byId.get(id);return `<article class="unranked-card">${coverHtml(a,ratingLabel(shelf.ratings[id]))}<h3>${esc(a.title)}</h3><button class="pill-btn" data-cat-add="${id}">+ Ajouter</button></article>`}).join('')}</div>
    </section>`;
    main.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{activeCategoryId=b.dataset.category;renderTops();window.scrollTo({top:0,behavior:'smooth'});});
    document.getElementById('catAddCandidate')?.addEventListener('click',()=>addToCategory(category,candidate.id));
    document.getElementById('catSkipCandidate')?.addEventListener('click',()=>{state.skipped=[...state.skipped.filter(x=>x!==candidate.id),candidate.id];saveCategoryState();renderTops();});
    document.getElementById('catOpenCandidate')?.addEventListener('click',()=>{detailReturnRoute='tops';renderAnimeDetail(candidate.id);});
    document.getElementById('seedCategory').onclick=()=>{ if(state.ranked.length){shelf.categoryRanks[category.id]={ranked:[],skipped:[]};showToast('Top remis à zéro');} else {shelf.categoryRanks[category.id]={ranked:[...category.ids.filter(id=>byId.has(id))],skipped:[]};showToast('Ordre AniShelf chargé');} save();renderTops(); };
    main.querySelectorAll('[data-cat-add]').forEach(b=>b.onclick=()=>addToCategory(category,b.dataset.catAdd));
    main.querySelectorAll('[data-rank-open]').forEach(b=>b.onclick=()=>{detailReturnRoute='tops';renderAnimeDetail(b.dataset.rankOpen);});
    main.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>moveRank(category,b.dataset.up,-1));
    main.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>moveRank(category,b.dataset.down,1));
    main.querySelectorAll('[data-remove-rank]').forEach(b=>b.onclick=()=>{const st=categoryState(category);st.ranked=st.ranked.filter(x=>x!==b.dataset.removeRank);save();renderTops();});
    bindRankDrag(category);
    observePosters();
  }
  function moveRank(category,id,delta){ const st=categoryState(category),i=st.ranked.indexOf(id),j=i+delta;if(i<0||j<0||j>=st.ranked.length)return;[st.ranked[i],st.ranked[j]]=[st.ranked[j],st.ranked[i]];save();renderTops(); }
  function bindRankDrag(category){
    const list=document.getElementById('rankedList'); if(!list)return;
    list.querySelectorAll('.drag-handle').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        const row=handle.closest('.rank-edit-row'); if(!row)return;
        e.preventDefault(); handle.setPointerCapture(e.pointerId); row.classList.add('dragging');
        const move=ev=>{
          const siblings=[...list.querySelectorAll('.rank-edit-row:not(.dragging)')];
          const after=siblings.find(el=>ev.clientY<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
          if(after)list.insertBefore(row,after);else list.appendChild(row);
          [...list.querySelectorAll('.rank-edit-row')].forEach((el,i)=>{const n=el.querySelector('.rank-number');if(n)n.textContent=i+1;});
        };
        const end=()=>{
          row.classList.remove('dragging'); handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',end); handle.removeEventListener('pointercancel',end);
          shelf.categoryRanks[category.id].ranked=[...list.querySelectorAll('.rank-edit-row')].map(el=>el.dataset.rankId); save(); showToast('Ordre enregistré');
        };
        handle.addEventListener('pointermove',move); handle.addEventListener('pointerup',end); handle.addEventListener('pointercancel',end);
      });
    });
  }

  // ---------- Profile / friends ----------
  function exportAll(){
    const payload={app:'AniShelf',version:7,exportedAt:new Date().toISOString(),quick,shelf};
    download(`anishelf-${(shelf.profileName||'profil').toLowerCase().replace(/\s+/g,'-')}.json`,new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  }
  function renderProfile(){
    const favorites=CATALOG.filter(a=>shelf.favorites.includes(a.id));
    const values=Object.values(shelf.ratings).filter(v=>v>0); const avg=values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'—';
    const common=friendProfile?CATALOG.filter(a=>shelf.ratings[a.id]>0&&friendProfile.ratings?.[a.id]>0):[];
    const rows=common.map(a=>({a,me:shelf.ratings[a.id],them:friendProfile.ratings[a.id],gap:Math.abs(shelf.ratings[a.id]-friendProfile.ratings[a.id])})).sort((x,y)=>y.gap-x.gap);
    main.innerHTML=`<section class="page"><div class="hero"><span class="eyebrow">Profil</span><h1>${esc(shelf.profileName||'Moi')}</h1></div><div class="stats"><div class="stat"><b>${values.length}</b><span>notes</span></div><div class="stat"><b>${avg}</b><span>moyenne</span></div><div class="stat"><b>${favorites.length}</b><span>favoris</span></div></div><label>Ton pseudo</label><input id="profileName" class="text-input" value="${esc(shelf.profileName||'Moi')}"><div class="export-actions"><button class="wide-btn accent" id="profileExport">Exporter mes données</button><label class="wide-btn file-label">Importer<input id="profileImport" type="file" accept="application/json" hidden></label></div><div class="section-title"><h2>Favoris</h2></div>${favorites.length?`<div class="mini-shelf">${favorites.map(a=>`<button class="mini-poster" data-profile-open="${a.id}">${coverHtml(a,ratingLabel(shelf.ratings[a.id]))}<span>${esc(a.title)}</span></button>`).join('')}</div>`:'<div class="empty-panel"><p>Ajoute des favoris depuis les fiches anime.</p></div>'}<div class="section-title"><h2>Comparer avec un ami</h2></div><label class="compare-drop">Importer son fichier AniShelf JSON<input id="friendInput" type="file" accept="application/json" hidden></label>${friendProfile?`<h3 style="margin-top:18px">${esc(shelf.profileName||'Moi')} vs ${esc(friendProfile.profileName||'Ami')}</h3><p class="muted">${common.length} anime notés en commun.</p><div class="compare-table">${rows.slice(0,40).map(x=>`<div class="compare-row"><b>${esc(x.a.title)}</b><span>${x.me}★</span><span>${x.them}★</span></div>`).join('')}</div>`:''}</section>`;
    document.getElementById('profileName').onchange=e=>{shelf.profileName=e.target.value.trim()||'Moi';save();renderProfile();};
    document.getElementById('profileExport').onclick=exportAll;
    document.getElementById('profileImport').onchange=e=>readDataFile(e.target.files[0],importData);
    document.getElementById('friendInput').onchange=e=>readDataFile(e.target.files[0],p=>{friendProfile=p.shelf||p;renderProfile();});
    main.querySelectorAll('[data-profile-open]').forEach(b=>b.onclick=()=>{detailReturnRoute='profile';renderAnimeDetail(b.dataset.profileOpen);});
    observePosters();
  }
  function readDataFile(file,done){if(!file)return;const r=new FileReader();r.onload=()=>{try{done(JSON.parse(r.result));}catch{showToast('Fichier JSON invalide')}};r.readAsText(file);}
  function importData(p){
    if(p.quick||p.shelf){
      const importedQuick={...(p.quick||{})};
      importedQuick.assignments={...(importedQuick.assignments||{})};

      // Compatibilité des sauvegardes antérieures à v7 : l'ancien D correspondait
      // à "Correct / oubliable", donc à notre nouveau E=2.5★.
      if(Number(p.version||0)<7){
        for(const [id,tier] of Object.entries(importedQuick.assignments)){
          if(tier==='D') importedQuick.assignments[id]='E';
        }
      }

      quick={...quick,...importedQuick};
      shelf={...shelf,...(p.shelf||{})};

      // Une ancienne sauvegarde est alignée une fois sur la nouvelle échelle.
      if(Number(p.version||0)<7){
        shelf.ratings=shelf.ratings||{};
        for(const [id,tierId] of Object.entries(quick.assignments||{})){
          const meta=tierMeta(tierId);
          if(meta?.rating) shelf.ratings[id]=meta.rating;
          else delete shelf.ratings[id];
        }
      }
    }
    else if(p.ratings){shelf={...shelf,...p};}
    else return showToast('Données AniShelf non reconnues');
    shelf.watchStatus=shelf.watchStatus||{};shelf.categoryRanks=shelf.categoryRanks||{};quick.assignments=quick.assignments||{};quick.queue=[];save();showToast('Import terminé ✓');render();
  }

  // ---------- PNG export for the unique tier list ----------
  async function canvasImageFor(a){ const local=await findLocalPoster(a);if(local){const img=await loadCanvasImage(local,false);if(img)return img;}const remote=posterCache[a.id]?.url;if(remote){const img=await loadCanvasImage(remote,true);if(img)return img;}return await loadCanvasImage(fallbackPoster(a),false); }
  function loadCanvasImage(url,cors){return new Promise(resolve=>{const i=new Image();if(cors)i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url;});}
  async function exportQuickTierPng(){
    showToast('Création du PNG…');
    const defs=QUICK_TIERS.map(t=>({label:t.label,rating:t.rating,color:t.color,items:CATALOG.filter(a=>quick.assignments[a.id]===t.id)}));
    const W=1500,pad=54,labelW=150,thumbW=86,thumbH=129,gap=10,rowPad=14,head=160;
    const rowHeights=defs.map(d=>Math.max(160,Math.ceil(Math.max(1,d.items.length)/12)*(thumbH+gap)+rowPad*2));
    const H=head+rowHeights.reduce((a,b)=>a+b+12,0)+70;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#15111e');g.addColorStop(1,'#261736');x.fillStyle=g;x.fillRect(0,0,W,H);
    x.fillStyle='#ff8a3d';x.font='900 26px Arial';x.fillText('ANISHELF',pad,56);x.fillStyle='#f8f4ff';x.font='900 54px Arial';x.fillText('MA TIER LIST',pad,116);
    let y=head;
    for(let r=0;r<defs.length;r++){
      const d=defs[r],rh=rowHeights[r];x.fillStyle='#1d1728';roundRect(x,pad,y,W-pad*2,rh,20);x.fill();x.fillStyle=d.color;roundRect(x,pad,y,labelW,rh,20);x.fill();x.fillStyle='#160f1d';x.font='900 24px Arial';x.textAlign='center';x.fillText(d.label,pad+labelW/2,y+46);x.font='700 17px Arial';x.fillText(d.rating?`${d.rating}★`:'Sans note',pad+labelW/2,y+72);x.textAlign='left';
      for(let i=0;i<d.items.length;i++){const a=d.items[i],col=i%12,row=Math.floor(i/12),px=pad+labelW+14+col*(thumbW+gap),py=y+rowPad+row*(thumbH+gap);const img=await canvasImageFor(a);x.save();roundRect(x,px,py,thumbW,thumbH,9);x.clip();if(img)x.drawImage(img,px,py,thumbW,thumbH);else{x.fillStyle='#2b2038';x.fillRect(px,py,thumbW,thumbH)}x.restore();}
      y+=rh+12;
    }
    x.fillStyle='#9f92b3';x.font='18px Arial';x.fillText(`${shelf.profileName||'Moi'} · ${new Date().toLocaleDateString('fr-CA')} · ${Object.keys(quick.assignments).length}/${CATALOG.length} classés`,pad,H-30);
    c.toBlob(async blob=>{if(!blob)return showToast('Export impossible');const file=new File([blob],'anishelf-tier-list.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Ma tier list AniShelf'});return}catch{}}download(file.name,blob);showToast('PNG téléchargé ✓');},'image/png',.94);
  }
  function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}

  // ---------- Poster maintenance + settings ----------
  async function refreshMissingPosters(){
    const missing=CATALOG.filter(a=>!posterCache[a.id]?.url);
    if(!missing.length)return showToast('Aucune affiche AniList manquante');
    showToast(`Recherche de ${missing.length} affiches…`);
    for(let i=0;i<missing.length;i+=8){await Promise.all(missing.slice(i,i+8).map(a=>enqueueAniList(a,true)));await new Promise(r=>setTimeout(r,750));}
    save();showToast('Affiches actualisées ✓');render();
  }
  document.getElementById('refreshMissingPosters').onclick=()=>{settingsDialog.close();refreshMissingPosters();};
  document.getElementById('clearPosterCache').onclick=()=>{posterCache={};writeJson(STORAGE.posterCache,posterCache);showToast('Cache AniList vidé');settingsDialog.close();render();};
  document.getElementById('exportProfileBtn').onclick=()=>{exportAll();settingsDialog.close();};
  document.getElementById('importProfileInput').onchange=e=>readDataFile(e.target.files[0],p=>{importData(p);settingsDialog.close();});
  document.getElementById('resetAllData').onclick=()=>{quick={assignments:{},queue:[]};shelf={ratings:{},notes:{},favorites:[],profileName:shelf.profileName||'Moi',watchStatus:{},categoryRanks:{}};quickHistory=[];save();settingsDialog.close();showToast('Données personnelles réinitialisées');go('home');};

  // ---------- Main render ----------
  function render(){
    renderNav();updateTopbar();
    if(route==='library')renderLibrary();
    else if(route==='quick')renderQuick();
    else if(route==='tops')renderTops();
    else if(route==='profile')renderProfile();
    else renderHome();
    window.scrollTo({top:0,behavior:'auto'});
  }

  // Aligne une seule fois les anciennes données avec la nouvelle échelle v7.
  syncMigratedQuickRatings();
  save();
  render();
})();
