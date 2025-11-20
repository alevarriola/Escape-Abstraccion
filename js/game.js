// -------------------------------
// CONFIGURACIÓN DEL NIVEL
// -------------------------------
// Estado de nivel cargado por JSON
let LEVEL = null;
let SCENES = 3;                   // se sobreescribe desde levels.json
let SCENE_BACKGROUNDS = [];       // se sobreescribe desde levels.json

// Datos de juego dinámicos
const doorCode = [];              // lo completa randomizeContent()
let clues = [];                   // se llena desde levels.json (layout) y se enriquece cada ronda
let BANK = [];                    // se llena desde levels.json (pares)
let TRUE_IDS = [];                // (si lo usás después)

// === Helpers aleatorios simples ===
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function sample(arr, n) { const c = arr.slice(); shuffle(c); return c.slice(0, n); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function loadLevelsAndInit() {
  try {
    const res = await fetch('./assets/levels.json', { cache: 'no-store' });
    const data = await res.json();

    // elegir nivel por query ?level=1 (opcional)
    const url = new URL(location.href);
    const idx = Number(url.searchParams.get('level') || 0);
    const lvl = (data.levels && data.levels[idx]) || data.levels[0];

    // setear estado de nivel
    LEVEL = lvl;
    SCENES = lvl.scenes;
    SCENE_BACKGROUNDS = lvl.backgrounds.slice();
    BANK = lvl.bank.slice();

    // layout fijo de pistas (posiciones y escenas)
    clues = lvl.clueLayout.map(c => ({ ...c }));

    // armar contenido aleatorio y dibujar
    randomizeContent();
    renderScene();
    resetHud();
    updateSeenCounter();
    incrementClicks();
  } catch (err) {
    console.error('Error cargando levels.json', err);
  }
}

function getRandomFreeClue(avoidIds = new Set()) {
  const pool = clues.filter(c => !c.trueMap && !avoidIds.has(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomizeContent(){
  // --- utilidades
  const allValues = BANK.map(p => p.value);
  const sampleDistinct = (arr, n) => {
    const copy = arr.slice(); shuffle(copy); return copy.slice(0, n);
  };

  // --- 1) Inicial: pares únicos para TODAS las pistas (sin repetir)
  const basePairs = sampleDistinct(BANK, Math.min(clues.length, BANK.length));
  // Si hay más pistas que BANK, intentamos extender sin repetir valores
  while (basePairs.length < clues.length) {
    const usedVals = new Set(basePairs.map(p => p.value));
    const extra = BANK.filter(p => !usedVals.has(p.value));
    if (!extra.length) break;
    basePairs.push(...sampleDistinct(extra, Math.min(extra.length, clues.length - basePairs.length)));
  }
  clues.forEach((c, i) => {
    const pair = basePairs[i % basePairs.length];
    c.key = pair.key;
    c.value = pair.value;
    c.trueMap = false;
  });

  // --- 2) Código (3 keys) con valores directos distintos
  let picked = sampleDistinct(BANK, Math.min(3, BANK.length));
  for (let tries=0; tries<6; tries++){
    const vals = new Set(picked.map(p=>p.value));
    if (vals.size === picked.length) break;
    picked = sampleDistinct(BANK, Math.min(3, BANK.length));
  }
  const codeKeys = picked.map(p=>p.key);
  shuffle(codeKeys);

  doorCode.length = 0;
  codeKeys.forEach(k => doorCode.push(k));

  // --- 3) Compuesto A->B->C eligiendo B tal que C no choque con directos
  const compositeIndex = Math.floor(Math.random()*3);
  const compositeKey   = codeKeys[compositeIndex];
  const directKeys     = codeKeys.filter((k,i)=> i!==compositeIndex);
  const directVals     = directKeys.map(k => BANK.find(p=>p.key===k).value);

  const bankKeys = BANK.map(p=>p.key);
  const avoidKeys = new Set(codeKeys);
  let midKeyCandidates = bankKeys.filter(k => !avoidKeys.has(k));
  if (!midKeyCandidates.length) midKeyCandidates = bankKeys.filter(k => k!==compositeKey);

  let midKey = null, finalValue = null;
  for (const cand of shuffle(midKeyCandidates.slice())){
    const pr = BANK.find(p=>p.key===cand);
    if (pr && !directVals.includes(pr.value)) { midKey=cand; finalValue=pr.value; break; }
  }
  if (!midKey) { midKey = midKeyCandidates[0]; finalValue = BANK.find(p=>p.key===midKey).value; }

  // --- 4) Marcar VERDADERAS en slots aleatorios
  const usedTrueIds = new Set();

  // 4.1 directas
  directKeys.forEach(k=>{
    const pair = BANK.find(p=>p.key===k);
    const slot = getRandomFreeClue(usedTrueIds);
    if (slot){
      slot.key = k;
      slot.value = pair.value;
      slot.trueMap = true;
      usedTrueIds.add(slot.id);
    }
  });

  // 4.2 compuesto: A->B, B->C
  const comp1 = getRandomFreeClue(usedTrueIds);
  if (comp1){
    comp1.key = compositeKey; // A
    comp1.value = midKey;     // B (nota: es una KEY, no un value)
    comp1.trueMap = true;
    usedTrueIds.add(comp1.id);
  }
  const comp2 = getRandomFreeClue(usedTrueIds);
  if (comp2){
    comp2.key = midKey;       // B
    comp2.value = finalValue; // C
    comp2.trueMap = true;
    usedTrueIds.add(comp2.id);
  }

  // --- 5) Opciones de selects (sin reservados)
  const reservedValues = new Set([...directVals, finalValue]); // Cuidado: B es key, no value
  const distractors = (excludeSet, correct, n=3) => {
    const pool = allValues.filter(v => v!==correct && !excludeSet.has(v));
    return sample(pool, Math.min(n, pool.length));
  };
  state.selectOptions = [0,1,2].map(i=>{
    const k = codeKeys[i];
    if (i===compositeIndex){
      const correct = finalValue;
      const dist = distractors(reservedValues, correct, 3);
      return shuffle([correct, ...dist]);
    } else {
      const correct = BANK.find(p=>p.key===k).value;
      const dist = distractors(reservedValues, correct, 3);
      return shuffle([correct, ...dist]);
    }
  });

  // --- 6) RECONSTRUCCIÓN de FALSAS para asegurar:
  // (a) no usan reservados, (b) no se duplican entre sí,
  // (c) no recrean edge real para keys del código.
  const trueIds = new Set(clues.filter(c=>c.trueMap).map(c=>c.id));
  const falseClues = clues.filter(c=>!trueIds.has(c.id));

  // Pool de valores permitido para falsas
  let falsePool = allValues.filter(v => !reservedValues.has(v));
  shuffle(falsePool);

  const usedFalse = new Set(); // track valores ya usados en falsas

  for (const c of falseClues){
    // Siempre ponemos un value del pool permitido, único
    let v = c.value;

    const needReplace =
      reservedValues.has(v) ||
      usedFalse.has(v) ||
      (codeKeys.includes(c.key) && BANK.find(p=>p.key===c.key)?.value === v); // evita edge real

    if (needReplace){
      // refrescar pool si se agotó
      if (!falsePool.length){
        falsePool = allValues.filter(val =>
          !reservedValues.has(val) && !usedFalse.has(val)
        );
        shuffle(falsePool);
      }
      // escoger uno válido
      let found = null;
      while (falsePool.length && !found){
        const cand = falsePool.pop();
        // no repetir ni crear edge real si la key es una codeKey
        if (usedFalse.has(cand)) continue;
        if (codeKeys.includes(c.key)){
          const trueVal = BANK.find(p=>p.key===c.key)?.value;
          if (cand === trueVal) continue;
        }
        found = cand;
      }
      if (found) v = found;
    }

    c.value = v;
    usedFalse.add(v);

    // si la key de la falsa es una codeKey, podés rotarla a otra key no-code
    if (codeKeys.includes(c.key)) {
       const nonCodeKeys = bankKeys.filter(k => !codeKeys.includes(k));
       if (nonCodeKeys.length) c.key = choice(nonCodeKeys);
     }
  }

  // --- 7)  verificar duplicados visibles en todas las pistas
  // (no debería haber valores reservados en falsas ni duplicados entre falsas)
   const seen = new Map();
   clues.forEach(c => {
     const k = `${c.trueMap?'T':'F'}:${c.value}`;
     seen.set(k, (seen.get(k)||0)+1);
   });
   for (const [k,n] of seen) if (k.startsWith('F:') && n>1) console.warn('Duplicado en falsas:', k, n);
}




// ===============================
// 1. CONFIGURACIÓN Y DATOS
// ===============================
// ...existing code...
const state = {
    seenClues: new Set(),
    showDevBoxes: false,
    bgEnabled: true,
    doorSeen: false,
    currentScene: 0,
    clicks: -1, 
    timerRunning: false,
    startTime: null,
    timerId: null,
    selectOptions: [[],[],[]],
};

let _clueHideTimer = null;


// ===============================
// 2. UTILIDADES GENERALES
// ===============================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.on) Object.entries(opts.on).forEach(([ev, fn]) => node.addEventListener(ev, fn));
  return node;
}

// -------- HUD: tiempo e intentos --------
function formatTime(ms){
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateHud(){
  const clicksEl = document.getElementById('hudClicks');
  const timeEl   = document.getElementById('hudTime');
  if (clicksEl) clicksEl.textContent = state.clicks;
  if (timeEl){
    if (state.timerRunning) {
      timeEl.textContent = formatTime(Date.now() - state.startTime);
    } else {
      timeEl.textContent = '00:00';
    }
  }
}

function startTimerOnce(){
  if (state.timerRunning) return;
  state.timerRunning = true;
  state.startTime = Date.now();
  state.timerId = setInterval(() => {
    const timeEl = document.getElementById('hudTime');
    if (timeEl) timeEl.textContent = formatTime(Date.now() - state.startTime);
  }, 1000);
}

function stopTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  state.timerRunning = false;
}

function resetHud(){
  state.clicks = -1;
  stopTimer();
  const clicksEl = document.getElementById('hudClicks');
  const timeEl   = document.getElementById('hudTime');
  if (clicksEl) clicksEl.textContent = '0';
  if (timeEl)   timeEl.textContent   = '00:00';
}

function incrementClicks(){
  state.clicks += 1;
  const clicksEl = document.getElementById('hudClicks');
  if (clicksEl) clicksEl.textContent = state.clicks;
  startTimerOnce(); // el tiempo arranca en el primer intento
}

// ===============================
// 3. RENDER Y UI
// ===============================
function fmtCodeTag(word) {
  const span = el('span', { className: 'code-tag' });
  const dot = el('span', { html: '•' });
  const w = el('strong', { text: word });
  span.append(dot, w);
  return span;
}

function renderDoorCode() {
  // Pintar cada palabra en su “chip” correspondiente
  doorCode.forEach((w, i) => {
    const mount = document.getElementById(`codeChip${i}`);
    if (!mount) return;
    mount.innerHTML = '';
    mount.appendChild(fmtCodeTag(w));
  });
}


function placeClue(clue) {
  const btn = el('button', {
    className: 'hotspot lupa',
    attrs: {
      'data-id': clue.id,
      'aria-label': `Pista: ${clue.key} → ${clue.value}`,
    },
    style: { left: clue.x + '%', top: clue.y + '%' },
  });
  btn.addEventListener('click', () => showCluePaper(clue));
  return btn;
}
function renderClues() {
  const scene = $('#scene');
  $$('.hotspot.lupa', scene).forEach(n => n.remove());
  clues.forEach(c => scene.appendChild(placeClue(c)));
}
function updateSeenCounter() {
  $('#seenCount').textContent = state.seenClues.size;
}

function updateSceneIndicator() {
  const ind = document.getElementById('sceneIndicator');
  ind.textContent = `Escena ${state.currentScene + 1}/${SCENES}`;
}

function showDoorIfNeeded() {
  const door = document.getElementById('doorHotspot');
  if (!door) return;
  if (state.currentScene === 0) {
    door.style.display = '';
  } else {
    door.style.display = 'none';
    // si el panel estaba abierto, lo cerramos para no ocupar espacio
    hidePanel();
  }
}

function makeOptionEl(text, val){
  const o = document.createElement('option');
  o.value = val; o.textContent = text;
  return o;
}

function renderSelects(){
  [0,1,2].forEach(i=>{
    const sel = document.getElementById(`sel${i}`);
    sel.innerHTML = "";
    sel.appendChild(makeOptionEl("— Elegí una opción —",""));
    state.selectOptions[i].forEach(v=>{
      sel.appendChild(makeOptionEl(v, v)); 
    });
  });
}


function renderScene() {
  const sceneEl = document.getElementById('scene');

  // Fade out breve
  sceneEl.classList.add('fading');

  // hacemos el cambio tras un tick corto
  setTimeout(() => {
    // 1) puerta visible solo en escena 0
    showDoorIfNeeded();

    // 2) pistas de la escena actual
    [...sceneEl.querySelectorAll('.hotspot.lupa')].forEach(n => n.remove());
    clues
      .filter(c => c.scene === state.currentScene)
      .forEach(c => sceneEl.appendChild(placeClue(c)));

    // 3) indicador (con bump)
    updateSceneIndicator();
    const ind = document.getElementById('sceneIndicator');
    ind.classList.remove('bump'); void ind.offsetWidth; ind.classList.add('bump');

    // 4) cerrar tooltips auxiliares
    document.getElementById('tooltip').style.display = 'none';
    document.getElementById('codeHintTooltip')?.classList.add('hidden');

    sceneEl.style.setProperty('--bg-url', `url('${SCENE_BACKGROUNDS[state.currentScene]}')`);
    sceneEl.classList.add('has-image');

    // Fade in
    sceneEl.classList.remove('fading');
    sceneEl.classList.add('fade-in');
    setTimeout(() => sceneEl.classList.remove('fade-in'), 240);
  }, 20);
}

function showCluePaper(clue){
  // marcar vista para el contador
  state.seenClues.add(clue.id);
  updateSeenCounter();

  // escribir contenido
  const box = document.getElementById('clueOverlay');
  const txt = document.getElementById('clueText');
  if (!box || !txt) return;

  // Texto simple: “key → value”
  txt.textContent = `${clue.key} → ${clue.value}`;

  // mostrar
  box.classList.remove('hidden');
  box.setAttribute('aria-hidden', 'false');

  // autohide a los 4s
  clearTimeout(_clueHideTimer);
  _clueHideTimer = setTimeout(hideCluePaper, 4000);
}

function hideCluePaper(){
  const box = document.getElementById('clueOverlay');
  if (!box) return;
  box.classList.add('hidden');
  box.setAttribute('aria-hidden', 'true');
  clearTimeout(_clueHideTimer);
  _clueHideTimer = null;
}

// ===============================
// FUNCIONES PANEL PUERTA
// ===============================
function showPanel() {
  const panel = document.getElementById('panel');
  panel.classList.remove('hidden');
  renderDoorCode();
  renderSelects();

  state.doorSeen = true;

  document.getElementById('sel0')?.focus();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hidePanel() {
  const panel = document.getElementById('panel');
  panel.classList.add('hidden');
}

// ===============================
// 4. INTERACCIONES Y EVENTOS
// ===============================
const tooltip = $('#tooltip');
function showClueTooltip(target, clue) {
    state.seenClues.add(clue.id);
    updateSeenCounter();
    tooltip.innerHTML = '';
    const row = el('div');
    const k = el('span', { className: 'pill', text: clue.key });
    const arrow = el('span', { text: ' → ' });
    const v = el('span', { className: 'pill', text: clue.value });
    row.append(k, arrow, v);
    tooltip.append(row);
    const rect = target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top) + 'px';
    tooltip.style.display = 'block';
    clearTimeout(showClueTooltip._t);
    showClueTooltip._t = setTimeout(() => { tooltip.style.display = 'none'; }, 2500);
}
document.addEventListener('click', (e) => {
  // Cerrar tooltip si clic fuera de un hotspot lupa
  if (!e.target.closest('.hotspot.lupa')) {
    tooltip.style.display = 'none';
  }
  // Cerrar code hint si clic fuera del badge/tooltip
});

// ===============================
// 5. LÓGICA Y VALIDACIÓN
// ===============================
function computeCorrectSolution() {
  const edges = new Map();
  clues.forEach(c => { if (c.trueMap) edges.set(c.key, c.value); });

  return doorCode.map(k => {
    let v = edges.get(k);
    if (!v) return null;
    const guard = new Set(); 
    while (edges.has(v) && !guard.has(v)) {
      guard.add(v);
      v = edges.get(v);
    }
    return v || null;
  });
}

function validate(userSolution) {
  const correct = computeCorrectSolution();
  const ok = correct.every((val, i) => val && (val.toLowerCase() === (userSolution[i] || "").trim().toLowerCase()));
  return { ok, correct };
}

$('#btnCheck').addEventListener('click', () => {
  incrementClicks();
  const user = [
    document.getElementById('sel0').value,
    document.getElementById('sel1').value,
    document.getElementById('sel2').value,
  ];
  const { ok, correct } = validate(user);
  const out = $('#result');
  if (ok) {
    out.innerHTML = `<span class="ok">✔ Traducción correcta:</span> ${correct.join(', ')}`;
    openWin();
  } else {
    out.innerHTML = `<span class="bad">✘ Aún no es correcto.</span> Probá relacionar pistas que encadenan valores.`;
  }
});


['#sel0', '#sel1', '#sel2'].forEach(sel => {
  const el = document.querySelector(sel);
  if (!el) return; // evita "null.addEventListener"
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnCheck').click();
  });
});

// ===============================
// 6. VICTORIA Y REINICIO
// ===============================
function openWin() {
  stopTimer(); // detener el cronómetro

  const elapsedMs = state.startTime ? (Date.now() - state.startTime) : 0;
  const statClicksEl = document.getElementById('statClicks');
  const statTimeEl   = document.getElementById('statTime');
  if (statClicksEl) statClicksEl.textContent = state.clicks;
  if (statTimeEl)   statTimeEl.textContent   = formatTime(elapsedMs);

  const o = $('#win');
  o.classList.add('show');
  o.setAttribute('aria-hidden', 'false');
  $('#btnPlayAgain').focus();
}

function closeWin() {
  const o = $('#win');
  o.classList.remove('show');
  o.setAttribute('aria-hidden', 'true');
}

$('#btnCloseWin').addEventListener('click', closeWin);
$('#btnPlayAgain').addEventListener('click', () => { closeWin(); resetGame(); });


function resetGame() {
    hidePanel();
    if (!LEVEL) return;
    randomizeContent();
    resetHud();
    state.seenClues.clear();
    state.doorSeen = false;

    document.getElementById('codeHintTooltip').classList.add('hidden');

    updateSeenCounter();
    ['#sel0', '#sel1', '#sel2'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.selectedIndex = 0;
    });
    document.getElementById('result').textContent = '';
    document.getElementById('tooltip').style.display = 'none';

    renderScene();
    incrementClicks()
}

$('#btnReset').addEventListener('click', resetGame);

// ===============================
// 7. HERRAMIENTAS DE DESARROLLO
// ===============================
document.getElementById('btnBackMenu').addEventListener('click', () => {
  window.location.href = './index.html';
});
(function preloadBG() {
  const img = new Image();
  img.onload = () => { $('#scene').classList.add('has-image'); };
  img.onerror = () => { $('#scene').classList.remove('has-image'); };
  img.src = './assets/oficina.jpg';
})();

// ===============================
// 8. INICIALIZACIÓN
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  loadLevelsAndInit();

  // Listener para mostrar/ocultar el panel al clickear la puerta
  document.getElementById('doorHotspot').addEventListener('click', () => {
    const panel = document.getElementById('panel');
    if (panel.classList.contains('hidden')) {
      showPanel();
    } else {
      hidePanel();
    }
  });



  document.getElementById('prevScene').addEventListener('click', () => {
    state.currentScene = (state.currentScene - 1 + SCENES) % SCENES;
    hidePanel(); // por si estaba abierto
    renderScene();
    });

  document.getElementById('nextScene').addEventListener('click', () => {
    state.currentScene = (state.currentScene + 1) % SCENES;
    hidePanel(); // por si estaba abierto
    renderScene();
    });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        const panel = document.getElementById('panel');
        if (panel && !panel.classList.contains('hidden')) {
        e.preventDefault();
        hidePanel();
        }
    }
  });

  // Cerrar el panel al tocar/clickear fuera (ideal para móvil)
  document.addEventListener('click', (e) => {
    // --- cierres de tooltips (lo que ya tenías) ---
    const tooltip = document.getElementById('tooltip');
    if (!e.target.closest('.hotspot.lupa')) {
      if (tooltip) tooltip.style.display = 'none';
    }
    const hintBox = document.getElementById('codeHintTooltip');
    if (hintBox && !hintBox.classList.contains('hidden') &&
        !e.target.closest('#codeHintTooltip')) {
      hintBox.classList.add('hidden');
    }

    // --- cierre del panel si el click fue "fuera" ---
    const panel = document.getElementById('panel');
    if (!panel || panel.classList.contains('hidden')) return;

    const clickedInsidePanel = e.target.closest('#panel');
    const clickedDoorHotspot = e.target.closest('#doorHotspot');     // botón de la puerta
    const clickedAnyHotspot  = e.target.closest('.hotspot');         // lupas/puerta/otros

    // Regla: si el toque no fue dentro del panel,
    // y no fue el botón de la puerta (que ya togglea),
    // cerramos el panel (aunque haya tocado una lupa).
    if (!clickedInsidePanel && !clickedDoorHotspot) {
      hidePanel();
    }
  });

  // Cerrar la hoja de pista tocando/clickeando en cualquier parte
  document.getElementById('clueOverlay').addEventListener('click', hideCluePaper);

  // Si querés que también se cierre con Esc:
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') hideCluePaper();
  });

});