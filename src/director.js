import { DialogueQueue } from './dialogue-pages.js';

const PEOPLE = {
  boatswain: ['Contramaestre', 'Barbas, el Insoportable', 'boatswain-restyled-v2.png'],
  lookout: ['Vigía del explorador', 'Pepa Catalejos', 'lookout-restyled-v2.png'],
  harpooner: ['Arponero', 'Jacinto, poco valiente', 'harpooner-restyled-v2.png'],
  sailor: ['Marinero', 'Paco Barril', 'sailor-restyled-v2.png'],
  carpenter: ['Carpintero', 'Don Astilla', 'carpenter-restyled-v2.png'],
  captain: ['Capitán', 'Almirante Roncero', 'boatswain-restyled-v2.png'],
};

export function contextualQuip(player, islands = [], context = {}) {
  if (!player || player.dead) return null;
  const fraction = player.hp / Math.max(1, player.maxHp);
  if (fraction < .4) return ['carpenter', 'Capitán, el casco tiene más agujeros que nuestras cuentas. Un puerto. Pronto.'];
  if (player.gold >= 120) return ['boatswain', 'Con tanto oro a bordo ya somos una oferta de temporada. ¡A Ron Ron antes de que nos compren a cañonazos!'];
  if (Number.isFinite(context.rumCharges) && context.rumCharges <= 0) return ['sailor', 'Se acabó el ron. El agua sigue ahí, pero ninguno firmó para beberla.'];
  const nearPort = context.inPort ?? islands.some(island => island.type === 'port' && island.owner === player.team && Math.hypot(player.x - island.x, player.z - island.z) < island.r + 12);
  if (nearPort) return ['sailor', 'En Ron Ron el oro está seguro. Lo del cambio correcto todavía lo estamos investigando.'];
  if (player.crew <= 4) return ['boatswain', 'Faltan manos para las velas. Y para aplaudir mis órdenes. Contratemos a alguien.'];
  if (context.climate === 'storm') return ['carpenter', 'El cielo nos está probando el casco gratis. Yo hubiera preferido un descuento.'];
  return null;
}

export class Director {
  constructor({ now = () => performance.now(), document: doc = globalThis.document, window: win = globalThis.window, onEvent } = {}) {
    this.doc = doc; this.win = win; this.now = now; this.onEvent = onEvent;
    this.current = null; this.expiry = 0; this.feed = []; this.visited = new Set(); this.reported = new Set();
    this.quipAt = 105; this.queue = new DialogueQueue(); this.spoken = this.queue.seen;
    this.speechUntil = 0; this.speechPriority = 0; this.currentSpeech = null;
    this.readingPaused = false; this.readingPausedAt = 0;
    this.invasionKeys = new WeakMap(); this.nextInvasion = 1; this.lastPageText = '';
    // Cabin chatter stands down while the guns are talking: low-priority lines
    // queue up during a firefight and catch up once the sea has been quiet for a
    // few seconds. Invasions and discoveries always get through.
    this.combatHot = false; this.quietAt = 0; this.deferred = [];
    this.advanceHandler = () => this.advanceSpeech(); this.resizeHandler = () => this.fitSpeech();
    this.$('dialogue-close')?.addEventListener('click', this.advanceHandler);
    this.win?.addEventListener('resize', this.resizeHandler);
    this.doc?.fonts?.ready?.then(() => this.fitSpeech());
    this.$('announcement')?.classList.remove('show');
  }
  $(id) { return this.doc?.getElementById(id); }
  get speeches() { return this.queue.pending; }
  readingNow() { return this.readingPaused ? this.readingPausedAt : this.now(); }
  setReadingPaused(paused) {
    if (!!paused === this.readingPaused) return;
    const now = this.now();
    if (paused) this.readingPausedAt = now;
    else if (this.currentSpeech) this.speechUntil += Math.max(0, now - this.readingPausedAt);
    this.readingPaused = !!paused;
  }
  refreshRelevantSpeech() {
    const current = this.queue.prune();
    if (current !== this.currentSpeech) this.showSpeech(current);
  }
  setCombatHot(hot) {
    if (!!hot === this.combatHot) return;
    this.combatHot = !!hot;
    if (!this.combatHot) this.quietAt = this.now();
  }
  speak(role, message, { priority = 1, key = null, isRelevant = null } = {}) {
    if (this.combatHot && priority < 2) {
      if (this.deferred.length < 4) this.deferred.push({ role, message, options: { priority, key, isRelevant } });
      return false;
    }
    this.refreshRelevantSpeech();
    if (this.currentSpeech && !this.readingPaused && this.readingNow() >= this.speechUntil) this.advanceSpeech();
    const result = this.queue.enqueue({ role: PEOPLE[role] ? role : 'boatswain', message, priority, key, isRelevant });
    if (!result.accepted) return false;
    if (this.queue.current !== this.currentSpeech) this.showSpeech(this.queue.current);
    this.onEvent?.({ type: key?.startsWith('invasion:') ? 'invasion' : key?.startsWith('report:') ? 'discovery' : 'speech', role, priority, key });
    return true;
  }
  showSpeech(speech) {
    if (!speech) { this.hideSpeech(); return; }
    const person = PEOPLE[speech.role] ?? PEOPLE.boatswain, el = this.$('crew-dialogue');
    this.currentSpeech = speech; this.speechPriority = speech.priority; this.lastPageText = '';
    const avatar = this.$('dialogue-avatar');
    if (avatar) { avatar.src = `/assets/harbor-art/${person[2]}`; avatar.alt = person[1]; }
    if (this.$('dialogue-role')) this.$('dialogue-role').textContent = person[1];
    if (this.$('dialogue-name')) this.$('dialogue-name').textContent = person[0];
    el?.classList.add('show');
    this.fitSpeech(); this._schedulePage();
  }
  _schedulePage() {
    const length = this.currentSpeech?.pages.text.length ?? 0;
    this.speechUntil = this.readingNow() + Math.min(14000, Math.max(5000, length * 58));
  }
  fitSpeech() {
    if (!this.currentSpeech) return;
    const copy = this.doc?.querySelector('.dialogue-copy'), message = this.$('dialogue-message');
    if (!message) return;
    const measurable = !!copy?.clientWidth && !!copy.clientHeight, pages = this.currentSpeech.pages;
    const text = pages.fit(candidate => { message.textContent = candidate; return !measurable || copy.scrollHeight <= copy.clientHeight + 1; });
    message.textContent = text;
    if (text !== this.lastPageText) { this.lastPageText = text; this._schedulePage(); }
    const button = this.$('dialogue-close');
    if (button) {
      button.textContent = '▾';
      button.setAttribute('aria-label', pages.hasNext ? 'Continuar mensaje' : 'Cerrar mensaje');
      button.dataset.pageStart = String(pages.cursor); button.dataset.pageEnd = String(pages.pageEnd);
    }
  }
  advanceSpeech() {
    const relevant = this.queue.prune();
    if (relevant !== this.currentSpeech) { this.showSpeech(relevant); return; }
    const previous = this.currentSpeech, next = this.queue.advance();
    if (!next) this.hideSpeech();
    else if (next !== previous) this.showSpeech(next);
    else { this.lastPageText = ''; this.fitSpeech(); this._schedulePage(); }
  }
  hideSpeech() {
    this.$('crew-dialogue')?.classList.remove('show');
    this.currentSpeech = null; this.speechPriority = 0; this.speechUntil = 0; this.lastPageText = '';
  }
  reportIsland(island, ship, time) {
    if (this.reported.has(island.name)) return false;
    this.reported.add(island.name); island.reportedAt = time; island.potentialTreasure = island.type !== 'port' && island.available;
    this.speak('lookout', `¡${island.name}! ${island.available ? 'Hay un cofre esperando dueño.' : 'Ya la han saqueado.'} La marqué en la carta, capitán.`, { priority: 2, key: 'report:' + island.name });
    this.log(`Tierra marcada: ${island.name}.`, 'victory'); return true;
  }
  announce(title, subtitle, kind = 'discovery', { key = null } = {}) {
    // Discoveries already have their lookout and map marker; creatures have a bar.
    if (kind === 'creature' || kind === 'discovery') return false;
    // Legacy invasion banners lack an event key; update emits the actual warning.
    if (/invad(?:iendo|en)|están invadiendo/i.test(title) && kind !== 'invasion') return false;
    const role = kind === 'intro' ? 'captain' : 'boatswain';
    return this.speak(role, [title, subtitle].filter(Boolean).join('. '), { priority: kind === 'invasion' ? 3 : kind === 'victory' || kind === 'intro' ? 2 : 1, key });
  }
  log(message, kind = '') {
    const container = this.$('battle-log'); if (!container) return;
    const el = this.doc.createElement('div'); el.className = `log-entry ${kind}`; el.textContent = message;
    container.prepend(el); this.feed.push({ el, until: this.now() + 8500 });
    while (this.feed.length > 3) this.feed.shift().el.remove();
  }
  update(player, islands, creatures, time, context = {}) {
    const now = this.now();
    if (context.combatHot !== undefined) this.setCombatHot(context.combatHot);
    if (!this.combatHot && this.deferred.length && this.queue.idle && now - this.quietAt >= 6000) {
      const { role, message, options } = this.deferred.shift();
      this.speak(role, message, options);
    }
    this.refreshRelevantSpeech();
    if (this.currentSpeech && !this.readingPaused && this.readingNow() >= this.speechUntil) this.advanceSpeech();
    for (let i = this.feed.length - 1; i >= 0; i--) if (now > this.feed[i].until) { this.feed[i].el.remove(); this.feed.splice(i, 1); }
    for (const island of islands) {
      if (island.invasion && island.owner === player.team && island.invasion.team !== player.team) {
        const invasion = island.invasion;
        let key = this.invasionKeys.get(invasion);
        if (!key) { key = `invasion:${this.nextInvasion++}`; this.invasionKeys.set(invasion, key); }
        this.speak('boatswain', `¡Invaden ${island.name}! A defender la bandera, capitán. ¡Que paguen alquiler!`, {
          priority: 3, key,
          isRelevant: () => island.invasion === invasion && island.owner === player.team && invasion.team !== player.team && !invasion.source?.dead,
        });
      }
      if (!this.visited.has(island.name) && Math.hypot(player.x - island.x, player.z - island.z) < island.r + 19) this.visited.add(island.name);
    }
    for (const creature of creatures) if (!this.visited.has(creature.name) && !creature.dead && Math.hypot(player.x - creature.x, player.z - creature.z) < 26) {
      this.visited.add(creature.name);
      this.speak('harpooner', `¡${creature.name}! No parece de humor. Yo tampoco, pero por razones distintas. Mantengamos distancia.`, { priority: 2, key: 'creature:' + creature.name });
    }
    if (time >= this.quipAt && this.queue.idle) {
      this.quipAt = time + 110; const quip = contextualQuip(player, islands, context);
      if (quip) this.speak(...quip, { priority: 0 });
    }
  }
  dispose() { this.$('dialogue-close')?.removeEventListener('click', this.advanceHandler); this.win?.removeEventListener('resize', this.resizeHandler); }
}
