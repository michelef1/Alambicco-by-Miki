(function(){
"use strict";

/* ============ PALETTE ============ */
const PALETTE = [
  {hex:"#C9973A", pat:"pat-solid"},
  {hex:"#3D8BFF", pat:"pat-dots"},
  {hex:"#E5573F", pat:"pat-stripes"},
  {hex:"#57D6C4", pat:"pat-grid"},
  {hex:"#8B5CF6", pat:"pat-check"},
  {hex:"#4ADE80", pat:"pat-rings"},
  {hex:"#F472B6", pat:"pat-waves"},
  {hex:"#FACC15", pat:"pat-dots"},
  {hex:"#60A5FA", pat:"pat-stripes"},
  {hex:"#FB923C", pat:"pat-grid"},
  {hex:"#34D399", pat:"pat-check"},
  {hex:"#F87171", pat:"pat-rings"},
  {hex:"#A78BFA", pat:"pat-waves"},
  {hex:"#22D3EE", pat:"pat-solid"}
];

/* ============ STORAGE ============ */
const SAVE_KEY = "alambicco_save_v1";
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) throw 0;
    const d = JSON.parse(raw);
    return Object.assign(defaultSave(), d);
  }catch(e){ return defaultSave(); }
}
function defaultSave(){
  return {
    currentLevel:1,
    maxUnlocked:1,
    stars:{},
    bestMoves:{},
    totalScore:0,
    totalWins:0,
    totalMoves:0,
    playTimeSec:0,
    settings:{sound:true, vibration:true, patterns:true}
  };
}
let SAVE = loadSave();
function persist(){ localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }

/* ============ RNG ============ */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromLevel(level){ return (level * 2654435761) >>> 0; }

/* ============ LEVEL GENERATOR ============ */
const CAPACITY = 4;
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function numColorsForLevel(level){ return clamp(4 + Math.floor((level-1)/4), 4, 12); }
const EMPTY_TUBES = 2; // kept constant: guarantees fast, reliably-solvable generation

function pourSim(tubes, from, to, capacity){
  const f=tubes[from], t=tubes[to];
  if(f.length===0) return false;
  const color = f[f.length-1];
  if(t.length>=capacity) return false;
  if(t.length>0 && t[t.length-1]!==color) return false;
  let count=0;
  for(let i=f.length-1;i>=0;i--){ if(f[i]===color) count++; else break; }
  const space = capacity - t.length;
  const mv = Math.min(count, space);
  if(mv<=0) return false;
  for(let i=0;i<mv;i++) t.push(f.pop());
  return mv;
}

function isSolved(tubes, capacity){
  for(const tube of tubes){
    if(tube.length===0) continue;
    if(tube.length!==capacity) return false;
    const c = tube[0];
    for(const u of tube) if(u!==c) return false;
  }
  return true;
}

/* deal shuffled color units into tubes (classic "random deal" scramble) */
function dealTubes(numColors, emptyTubes, capacity, rng){
  const pool = [];
  for(let c=0;c<numColors;c++) for(let i=0;i<capacity;i++) pool.push(c);
  for(let i=pool.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    const tmp = pool[i]; pool[i]=pool[j]; pool[j]=tmp;
  }
  const tubes = [];
  for(let i=0;i<numColors;i++) tubes.push(pool.slice(i*capacity, (i+1)*capacity));
  for(let i=0;i<emptyTubes;i++) tubes.push([]);
  return tubes;
}

/* moves considered by the internal solver (pruned to skip pointless shuffles) */
function solverMoves(tubes, capacity){
  const moves = [];
  for(let a=0;a<tubes.length;a++){
    if(tubes[a].length===0) continue;
    const topA = tubes[a][tubes[a].length-1];
    for(let b=0;b<tubes.length;b++){
      if(a===b) continue;
      if(tubes[b].length>=capacity) continue;
      if(tubes[b].length===0){
        let uniform = true;
        for(let i=1;i<tubes[a].length;i++) if(tubes[a][i]!==tubes[a][0]){ uniform=false; break; }
        if(uniform && tubes[a].length===capacity) continue; // moving an already-solved tube into empty helps nothing
        moves.push({from:a,to:b});
      }else if(tubes[b][tubes[b].length-1]===topA){
        moves.push({from:a,to:b});
      }
    }
  }
  return moves;
}
function moveScore(tubes, mv, capacity){
  const f = tubes[mv.from], t = tubes[mv.to];
  const color = f[f.length-1];
  let count=0;
  for(let i=f.length-1;i>=0;i--){ if(f[i]===color) count++; else break; }
  const space = capacity - t.length;
  const mvCount = Math.min(count, space);
  let score = mvCount;
  if(t.length+mvCount===capacity) score += 50;
  if(t.length>0) score += 10;
  if(f.length-mvCount===0) score += 15;
  return score;
}
function stateKey(tubes){ return tubes.map(t=>t.join(",")).join("|"); }

/* bounded heuristic DFS solver: proves solvability and returns a valid move path */
function solvePuzzle(tubes, capacity, nodeBudget){
  const visited = new Set();
  let nodes = 0;
  function dfs(state, path){
    nodes++;
    if(nodes>nodeBudget) return null;
    if(isSolved(state, capacity)) return path;
    if(path.length>250) return null;
    const moves = solverMoves(state, capacity);
    if(moves.length===0) return null;
    moves.sort((m1,m2)=>moveScore(state,m2,capacity)-moveScore(state,m1,capacity));
    for(const mv of moves){
      const clone = state.map(t=>t.slice());
      pourSim(clone, mv.from, mv.to, capacity);
      const key = stateKey(clone);
      if(visited.has(key)) continue;
      visited.add(key);
      const res = dfs(clone, path.concat([mv]));
      if(res) return res;
      if(nodes>nodeBudget) return null;
    }
    return null;
  }
  const path = dfs(tubes, []);
  return { solvable: !!path, path: path||null, nodes };
}

function generateLevel(level){
  const numColors = numColorsForLevel(level);
  const emptyTubes = EMPTY_TUBES;
  const baseSeed = seedFromLevel(level);
  const MAX_ATTEMPTS = 12;

  let tubes = null, parMoves = null;
  for(let attempt=0; attempt<MAX_ATTEMPTS; attempt++){
    const rng = mulberry32((baseSeed + attempt*7919) >>> 0);
    const candidate = dealTubes(numColors, emptyTubes, CAPACITY, rng);
    if(isSolved(candidate, CAPACITY)) continue;
    const res = solvePuzzle(candidate.map(t=>t.slice()), CAPACITY, 15000);
    if(res.solvable){
      tubes = candidate;
      parMoves = res.path.length;
      break;
    }
    tubes = candidate; // keep as fallback in case every attempt fails
  }
  if(parMoves===null) parMoves = Math.round(numColors*2.2)+4; // fallback estimate

  return { tubes, capacity:CAPACITY, numColors, emptyTubes, level, parMoves };
}

/* ============ GAME STATE ============ */
let G = null; // active game
const levelCache = new Map();
function getLevelData(level){
  if(levelCache.has(level)) return levelCache.get(level);
  const data = generateLevel(level);
  levelCache.set(level, data);
  return data;
}
function newGame(level){
  const data = getLevelData(level);
  G = {
    level,
    tubes: data.tubes.map(t=>t.slice()),
    initialTubes: data.tubes.map(t=>t.slice()),
    capacity: data.capacity,
    numColors: data.numColors,
    parMoves: data.parMoves,
    selected: null,
    moves: 0,
    history: [],
    startTime: Date.now(),
    timerHandle: null,
    won: false
  };
  return G;
}

function attemptPour(from, to){
  if(from===to) return false;
  const tubes = G.tubes;
  const f = tubes[from], t = tubes[to];
  if(f.length===0) return false;
  const color = f[f.length-1];
  if(t.length>=G.capacity) return false;
  if(t.length>0 && t[t.length-1]!==color) return false;
  let count=0;
  for(let i=f.length-1;i>=0;i--){ if(f[i]===color) count++; else break; }
  const space = G.capacity - t.length;
  const mv = Math.min(count, space);
  if(mv<=0) return false;
  for(let i=0;i<mv;i++) t.push(f.pop());
  G.history.push({from,to,count:mv});
  G.moves++;
  return true;
}

function undoMove(){
  if(G.history.length===0) return false;
  const last = G.history.pop();
  const f = G.tubes[last.from], t = G.tubes[last.to];
  for(let i=0;i<last.count;i++) f.push(t.pop());
  G.moves = Math.max(0, G.moves-1);
  return true;
}

function checkWin(){
  return isSolved(G.tubes, G.capacity);
}

/* ============ SOUND / HAPTICS ============ */
let audioCtx = null;
function beep(freq, dur, type, vol){
  if(!SAVE.settings.sound) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type||"sine";
    o.frequency.value = freq;
    g.gain.value = vol||0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  }catch(e){}
}
function sfxPour(){ beep(520,0.12,"sine",0.045); }
function sfxInvalid(){ beep(160,0.1,"square",0.03); }
function sfxWin(){ beep(660,0.14,"sine",0.05); setTimeout(()=>beep(880,0.18,"sine",0.05),120); setTimeout(()=>beep(1100,0.22,"sine",0.05),260); }
function haptic(ms){ if(SAVE.settings.vibration && navigator.vibrate) navigator.vibrate(ms); }

/* ============ DOM / SCREENS ============ */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showScreen(name){
  $$(".screen").forEach(s=>s.classList.toggle("active", s.dataset.screen===name));
  if(name==="home") renderHome();
  if(name==="levels") renderLevelGrid(true);
  if(name==="stats") renderStats();
}

/* ---- HOME ---- */
function renderHome(){
  $("#continue-sub").textContent = "Livello " + SAVE.currentLevel;
}

/* ---- LEVEL GRID (virtualized-ish, batched infinite) ---- */
let gridLoaded = 0;
const GRID_BATCH = 30;
function renderLevelGrid(reset){
  const grid = $("#level-grid");
  if(reset){ grid.innerHTML=""; gridLoaded=0; }
  loadMoreLevels();
}
function starsIconRow(count){
  let html = "";
  for(let i=0;i<3;i++){
    html += `<svg viewBox="0 0 24 24" class="${i<count?'on':''}"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7-5.4-4.7 7.1-.6z"/></svg>`;
  }
  return html;
}
function loadMoreLevels(){
  const grid = $("#level-grid");
  const start = gridLoaded+1;
  const end = gridLoaded+GRID_BATCH;
  const frag = document.createDocumentFragment();
  for(let lvl=start; lvl<=end; lvl++){
    const done = SAVE.stars[lvl]!==undefined;
    const locked = lvl>SAVE.maxUnlocked;
    const isCurrent = lvl===SAVE.currentLevel && !done;
    const div = document.createElement("div");
    div.className = "level-tile " + (done?"done ":"") + (locked?"locked":"") + (isCurrent?"current":"");
    div.dataset.level = lvl;
    div.innerHTML = `<div class="lt-num">${lvl}</div><div class="lt-stars">${starsIconRow(done?SAVE.stars[lvl]:0)}</div>`;
    if(!locked){
      div.addEventListener("click", ()=>{ startLevel(lvl); });
    }
    frag.appendChild(div);
  }
  grid.appendChild(frag);
  gridLoaded = end;
}
// infinite scroll
$("#screen-levels").addEventListener("scroll", ()=>{}, {passive:true});
function attachInfiniteScroll(){
  const scrollHost = $("#screen-levels");
  scrollHost.querySelector(".level-grid").addEventListener("scroll", ()=>{});
}
document.addEventListener("DOMContentLoaded", ()=>{
  const gridEl = $("#level-grid");
  gridEl.addEventListener("scroll", ()=>{
    if(gridEl.scrollTop + gridEl.clientHeight > gridEl.scrollHeight - 300){
      loadMoreLevels();
    }
  }, {passive:true});
});

/* ---- STATS ---- */
function renderStats(){
  const wrap = $("#stats-wrap");
  const levelsWon = Object.keys(SAVE.stars).length;
  const totalStars = Object.values(SAVE.stars).reduce((a,b)=>a+b,0);
  const mins = Math.floor(SAVE.playTimeSec/60);
  wrap.innerHTML = `
    <div class="stat-card"><div class="sc-label">Punteggio totale</div><div class="sc-value">${SAVE.totalScore}</div></div>
    <div class="stat-card"><div class="sc-label">Livelli completati</div><div class="sc-value">${levelsWon}</div></div>
    <div class="stat-card"><div class="sc-label">Stelle raccolte</div><div class="sc-value">${totalStars} / ${levelsWon*3}</div></div>
    <div class="stat-card"><div class="sc-label">Mosse totali</div><div class="sc-value">${SAVE.totalMoves}</div></div>
    <div class="stat-card"><div class="sc-label">Tempo di gioco</div><div class="sc-value">${mins} min</div></div>
    <div class="stat-card"><div class="sc-label">Livello attuale</div><div class="sc-value">${SAVE.currentLevel}</div></div>
  `;
}

/* ---- GAME RENDER ---- */
function unitClass(colorIdx){
  const p = PALETTE[colorIdx % PALETTE.length];
  const patClass = SAVE.settings.patterns ? p.pat : "";
  return `tube-unit ${patClass}`;
}
function renderTubes(){
  const area = $("#tubes-area");
  area.innerHTML = "";
  G.tubes.forEach((tube, idx)=>{
    const t = document.createElement("div");
    t.className = "tube" + (G.selected===idx ? " selected":"");
    t.dataset.idx = idx;

    const rim = document.createElement("div");
    rim.className = "tube-rim";
    t.appendChild(rim);

    const glass = document.createElement("div");
    glass.className = "tube-glass";
    const layers = document.createElement("div");
    layers.className = "tube-layers";

    const emptyCount = G.capacity - tube.length;
    if(emptyCount>0){
      const spacer = document.createElement("div");
      spacer.className = "tube-empty-fill";
      spacer.style.flex = emptyCount;
      layers.appendChild(spacer);
    }
    for(let i=tube.length-1;i>=0;i--){
      const u = document.createElement("div");
      u.className = unitClass(tube[i]);
      u.style.background = PALETTE[tube[i] % PALETTE.length].hex;
      layers.appendChild(u);
    }
    glass.appendChild(layers);
    t.appendChild(glass);

    t.addEventListener("click", ()=>onTubeClick(idx));
    area.appendChild(t);
  });
  $("#hud-moves").textContent = G.moves;
  $("#hud-colors").textContent = G.numColors;
  $("#btn-undo").disabled = G.history.length===0;
}

function onTubeClick(idx){
  if(G.won) return;
  if(G.selected===null){
    if(G.tubes[idx].length===0) return;
    G.selected = idx;
    renderTubes();
    return;
  }
  if(G.selected===idx){
    G.selected = null;
    renderTubes();
    return;
  }
  const ok = attemptPour(G.selected, idx);
  G.selected = null;
  if(ok){
    sfxPour(); haptic(10);
    renderTubes();
    if(checkWin()){
      G.won = true;
      onLevelWin();
    }
  }else{
    sfxInvalid(); haptic([8,30,8]);
    renderTubes();
  }
}

function updateTimerDisplay(){
  if(!G) return;
  const secs = Math.floor((Date.now()-G.startTime)/1000);
  const m = String(Math.floor(secs/60)).padStart(2,"0");
  const s = String(secs%60).padStart(2,"0");
  $("#hud-time").textContent = `${m}:${s}`;
}

function startLevel(level){
  $$(".screen").forEach(s=>s.classList.toggle("active", s.dataset.screen==="game"));
  $("#game-level-title").textContent = "Livello " + level;
  $("#tubes-area").innerHTML = "";
  $("#hud-moves").textContent = "0";
  $("#hud-time").textContent = "00:00";
  $("#hud-colors").textContent = "…";
  setTimeout(()=>{
    newGame(level);
    $("#game-level-title").textContent = "Livello " + level;
    renderTubes();
    updateTimerDisplay();
    if(G.timerHandle) clearInterval(G.timerHandle);
    G.timerHandle = setInterval(()=>{ if(!G.won) updateTimerDisplay(); }, 1000);
    // pre-warm the next level in the background so it opens instantly
    setTimeout(()=>{ try{ getLevelData(level+1); }catch(e){} }, 250);
  }, 20);
}

function onLevelWin(){
  clearInterval(G.timerHandle);
  const elapsed = Math.floor((Date.now()-G.startTime)/1000);
  const par = G.parMoves;
  let stars = 1;
  if(G.moves <= par) stars = 3;
  else if(G.moves <= par*1.5) stars = 2;

  const prevStars = SAVE.stars[G.level] || 0;
  const scoreGain = 60 + stars*40 + Math.max(0, 30-Math.floor(elapsed/3));

  SAVE.stars[G.level] = Math.max(prevStars, stars);
  SAVE.bestMoves[G.level] = Math.min(SAVE.bestMoves[G.level]||Infinity, G.moves);
  SAVE.totalScore += scoreGain;
  SAVE.totalWins += 1;
  SAVE.totalMoves += G.moves;
  SAVE.playTimeSec += elapsed;
  SAVE.maxUnlocked = Math.max(SAVE.maxUnlocked, G.level+1);
  SAVE.currentLevel = Math.max(SAVE.currentLevel, G.level+1);
  persist();

  sfxWin(); haptic([10,40,10,40,10]);

  $("#win-moves").textContent = G.moves;
  $("#win-time").textContent = `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}`;
  $("#win-score").textContent = "+" + scoreGain;
  const starEls = $$("#win-stars .star");
  starEls.forEach((el,i)=> el.classList.toggle("on", i<stars));
  $("#overlay-win").classList.add("active");
}

/* ============ CONFIRM DIALOG ============ */
function showConfirm(title, desc, onConfirm){
  $("#confirm-title").textContent = title;
  $("#confirm-desc").textContent = desc;
  $("#overlay-confirm").classList.add("active");
  const ok = $("#confirm-ok");
  const cancel = $("#confirm-cancel");
  function cleanup(){
    $("#overlay-confirm").classList.remove("active");
    ok.removeEventListener("click", onOk);
    cancel.removeEventListener("click", onCancel);
  }
  function onOk(){ cleanup(); onConfirm(); }
  function onCancel(){ cleanup(); }
  ok.addEventListener("click", onOk);
  cancel.addEventListener("click", onCancel);
}

/* ============ EVENT WIRING ============ */
document.addEventListener("DOMContentLoaded", ()=>{
  // nav back buttons
  $$("[data-nav]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(G && G.timerHandle) clearInterval(G.timerHandle);
      showScreen(btn.dataset.nav);
    });
  });

  $("#btn-continue").addEventListener("click", ()=> startLevel(SAVE.currentLevel));
  $("#btn-levels").addEventListener("click", ()=> showScreen("levels"));
  $("#btn-stats").addEventListener("click", ()=> showScreen("stats"));
  $("#btn-settings").addEventListener("click", ()=> showScreen("settings"));
  $("#btn-game-settings").addEventListener("click", ()=> showScreen("settings"));

  // home three-dot menu
  $("#btn-home-menu").addEventListener("click", ()=> $("#overlay-home-menu").classList.add("active"));
  $("#menu-close").addEventListener("click", ()=> $("#overlay-home-menu").classList.remove("active"));
  $("#overlay-home-menu").addEventListener("click", (e)=>{ if(e.target.id==="overlay-home-menu") $("#overlay-home-menu").classList.remove("active"); });
  $("#menu-open-guide").addEventListener("click", ()=>{
    $("#overlay-home-menu").classList.remove("active");
    $("#overlay-guide").classList.add("active");
  });
  $("#menu-open-info").addEventListener("click", ()=>{
    $("#overlay-home-menu").classList.remove("active");
    $("#overlay-info").classList.add("active");
  });
  $("#guide-close").addEventListener("click", ()=> $("#overlay-guide").classList.remove("active"));
  $("#info-close").addEventListener("click", ()=> $("#overlay-info").classList.remove("active"));
  $("#overlay-guide").addEventListener("click", (e)=>{ if(e.target.id==="overlay-guide") $("#overlay-guide").classList.remove("active"); });
  $("#overlay-info").addEventListener("click", (e)=>{ if(e.target.id==="overlay-info") $("#overlay-info").classList.remove("active"); });

  $("#btn-undo").addEventListener("click", ()=>{
    if(!G || G.won) return;
    if(undoMove()){ G.selected=null; renderTubes(); haptic(8); }
  });
  $("#btn-reset-level").addEventListener("click", ()=>{
    if(!G) return;
    showConfirm("Ricominciare?", "Il livello tornerà allo stato iniziale. Le mosse verranno azzerate.", ()=>{
      G.tubes = G.initialTubes.map(t=>t.slice());
      G.moves = 0; G.history = []; G.selected = null; G.won=false;
      G.startTime = Date.now();
      renderTubes();
    });
  });

  $("#win-btn-next").addEventListener("click", ()=>{
    $("#overlay-win").classList.remove("active");
    startLevel(G.level+1);
  });
  $("#win-btn-levels").addEventListener("click", ()=>{
    $("#overlay-win").classList.remove("active");
    showScreen("levels");
  });

  // settings toggles
  function bindToggle(id, key){
    const el = $(id);
    el.setAttribute("aria-checked", String(SAVE.settings[key]));
    el.addEventListener("click", ()=>{
      SAVE.settings[key] = !SAVE.settings[key];
      el.setAttribute("aria-checked", String(SAVE.settings[key]));
      persist();
      if(key==="patterns" && G) renderTubes();
    });
  }
  bindToggle("#toggle-sound","sound");
  bindToggle("#toggle-vibration","vibration");
  bindToggle("#toggle-patterns","patterns");

  $("#btn-reset-progress").addEventListener("click", ()=>{
    showConfirm("Azzerare tutti i progressi?", "Livelli, stelle e punteggi verranno cancellati definitivamente. L'operazione non è reversibile.", ()=>{
      SAVE = defaultSave();
      persist();
      showScreen("home");
    });
  });

  showScreen("home");

  // register service worker
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
});

})();
