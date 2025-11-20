(async function(){
  const sel = document.getElementById('levelSelect');
  const btn = document.getElementById('btnStart');

  // Cargar niveles
  try {
    const res = await fetch('./assets/levels.json', { cache: 'no-store' });
    const data = await res.json();
    const levels = data.levels || [];

    // Poblar selector
    levels.forEach((lvl, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      const name = lvl.id || `Nivel ${i+1}`;
      const scenes = Array.isArray(lvl.backgrounds) ? lvl.backgrounds.length : lvl.scenes;
      opt.textContent = `${name} — ${scenes || lvl.scenes} escenas`;
      sel.appendChild(opt);
    });

    // Valor por defecto
    sel.value = "0";
  } catch (e) {
    console.error('No se pudo cargar levels.json', e);
    // Fallback mínimo
    const opt = document.createElement('option');
    opt.value = "0";
    opt.textContent = "Nivel 1";
    sel.appendChild(opt);
  }

  // Navegar al juego con el nivel elegido
  btn.addEventListener('click', () => {
    const idx = sel.value || "0";
    // opcional: guardá preferencia
    localStorage.setItem('lastLevel', idx);
    // ir al juego
    location.href = `./game.html?level=${encodeURIComponent(idx)}`;
  });

  // Cargar última selección (opcional)
  const last = localStorage.getItem('lastLevel');
  if (last && sel.querySelector(`option[value="${last}"]`)) {
    sel.value = last;
  }
})();
