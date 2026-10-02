import { icon } from './hud-art.js';
import './embark.css';

/** The expedition clock remains stopped by the native modal until the captain is ready. */
export function mountEmbark({ onStart }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'embark-dialog';
  dialog.setAttribute('aria-labelledby', 'embark-title');
  dialog.innerHTML = `
    <img class="embark-art" src="/assets/voyage/archipelago-dawn.webp" alt="" fetchpriority="high">
    <div class="embark-shade"></div>
    <header class="embark-brand">${icon('anchor')}<span>PIRATE TIDES<small>EL MAR DE LOS SINVERGÜENZAS</small></span></header>
    <div class="embark-content">
      <div class="embark-kicker"><span></span> CONQUISTA NAVAL</div>
      <h1 id="embark-title">El mar no tiene rey.<br><em>Todavía.</em></h1>
      <p class="embark-intro">Tu barco. Tu tripulación. Una bandera que plantar.<br>Haz fortuna y conquista la base corsaria antes de perder la tuya.</p>
      <ol class="embark-steps">
        <li><span>01</span><div><strong>Explora y saquea</strong><small>Las islas esconden tu próxima ventaja.</small></div></li>
        <li><span>02</span><div><strong>Vuelve más fuerte</strong><small>Asegura el oro en puerto y equipa tu flota.</small></div></li>
        <li><span>03</span><div><strong>Arrebata su bandera</strong><small>Destruye la torre y conquista el Diente Roto.</small></div></li>
      </ol>
      <button id="embark-start" autofocus>${icon('wheel')}<span>¡A la mar!<small>Al mando de La Indomable</small></span><span class="embark-arrow" aria-hidden="true">→</span></button>
      <details class="embark-guide"><summary>¿Primera travesía? Mira los controles</summary><div><span><kbd>W A S D</kbd> Navegar</span><span><kbd>CLIC</kbd> Rumbo / enemigo</span><span><kbd>ESPACIO</kbd> Andanada</span><span><kbd>E</kbd> Desembarcar</span><span><kbd>F</kbd> Puerto y flota</span><span><kbd>SHIFT</kbd> A toda vela</span></div></details>
    </div>
    <footer class="embark-footer"><span>11 ISLAS · DOS BANDERAS · NINGUNA EXCUSA</span><span>Partida local contra IA</span></footer>`;
  document.body.appendChild(dialog);
  const start = () => {
    if (!dialog.open) return;
    dialog.close();
    document.body.classList.remove('embarking');
    onStart();
    const canvas = document.querySelector('#game canvas');
    canvas?.setAttribute('tabindex', '0');
    canvas?.focus({ preventScroll: true });
  };
  dialog.querySelector('#embark-start').addEventListener('click', start);
  // Escape does not silently start a match; the start action is explicit.
  dialog.addEventListener('cancel', event => event.preventDefault());
  document.body.classList.add('embarking');
  dialog.showModal();
  return dialog;
}
