import { icon } from './hud-art.js';
import { tacticalGuidance } from './tactical-guidance.js';
import './voyage-ui.css';

export function mountVoyageUI({ onResume, onChart }) {
  const card = document.createElement('aside');
  card.id = 'tactical-card'; card.setAttribute('aria-label', 'Guía de la expedición');
  card.innerHTML = `<button id="tactical-toggle" aria-expanded="true" aria-controls="tactical-detail"><span class="tactical-symbol">${icon('wheel')}</span><span><small>TU PRÓXIMA JUGADA</small><strong id="tactical-title"></strong></span><span class="tactical-chevron" aria-hidden="true">−</span></button><div id="tactical-detail"><p id="tactical-copy"></p><button id="tactical-chart">Abrir carta náutica <kbd>Tab</kbd><span aria-hidden="true">↗</span></button></div>`;
  document.body.appendChild(card);
  const toggle = card.querySelector('#tactical-toggle'), detail = card.querySelector('#tactical-detail');
  const compact = matchMedia('(max-width: 960px)');
  function collapse(value) {
    card.classList.toggle('compact', value); detail.hidden = value;
    toggle.setAttribute('aria-expanded', String(!value));
    card.querySelector('.tactical-chevron').textContent = value ? '+' : '−';
  }
  collapse(compact.matches);
  compact.addEventListener('change', event => collapse(event.matches));
  toggle.onclick = () => collapse(toggle.getAttribute('aria-expanded') === 'true');
  card.querySelector('#tactical-chart').onclick = onChart;

  const pause = document.createElement('dialog'); pause.id = 'pause-dialog';
  pause.setAttribute('aria-labelledby', 'pause-title');
  pause.innerHTML = `<div class="pause-seal">${icon('anchor')}</div><div class="eyebrow">UN RESPIRO, CAPITÁN</div><h2 id="pause-title">El mar puede esperar.</h2><p>La batalla está en pausa.<br>Tu próxima jugada merece un buen plan.</p><div class="pause-keys"><span><kbd>W A S D</kbd> Timón</span><span><kbd>ESPACIO</kbd> Andanada</span><span><kbd>Q</kbd> Abordar</span><span><kbd>E</kbd> Desembarcar</span></div><button id="resume-voyage" autofocus>Volver a navegar <span aria-hidden="true">→</span></button><small class="pause-footnote">También puedes pulsar P o Esc</small>`;
  document.body.appendChild(pause);
  pause.querySelector('#resume-voyage').onclick = onResume;
  pause.addEventListener('cancel', event => { event.preventDefault(); onResume(); });
  let last = '';
  return {
    get pauseOpen() { return pause.open; },
    setPaused(value) {
      document.body.classList.toggle('voyage-paused', value);
      if (value && !pause.open) pause.showModal();
      else if (!value && pause.open) {
        pause.close();
        document.querySelector('#game canvas')?.focus({ preventScroll: true });
      }
    },
    update(state) {
      const guidance = tacticalGuidance(state), key = `${guidance.id}:${guidance.detail}`;
      if (key === last) return; last = key;
      card.dataset.tone = guidance.tone; card.dataset.guidance = guidance.id;
      card.querySelector('#tactical-title').textContent = guidance.title;
      card.querySelector('#tactical-copy').textContent = guidance.detail;
    },
  };
}
