import * as THREE from 'three';
import { createGulls, chest, pirate, palette,box,rod } from './world.js';
import { createShip, createIsland, createOcean, createReflections, createClouds, updateUpgradeModel } from './pixel-art.js';
import { clamp, damp, navigate, autopilot, hullIntersection, purchaseUpgrade, upgradeCost, upgradeDefinitions } from './navigation.js';
import { SeaEffects, Wake } from './sea-effects.js';
import { ShotEffects } from './shot-effects.js';
import { createBestiary } from './bestiary.js';
import { Weather } from './weather.js';
import { dressShips, enrichIslands, animatePirate,animateShipLanterns } from './world-detail.js';
import { Director } from './director.js';
import { AudioDirector, AUDIO_DEFAULTS } from './audio-director.js';
import { Campaign } from './campaign.js';
import {applyFleetSails} from './fleet-appearance.js';
import { balance, lootDuration, applyAmmoEffect,reconcileRoles,cannonReload,boardingExchange,broadsideFactor,crossingTBonus,sideKey,splitDamage,rigSpeedFactor,rigRules,boardingLoot } from './campaign-rules.js';
import { FaunaCombat } from './fauna-combat.js';
import { mountNauticalHUD, renderShipPortrait, updateNauticalHUD, drawNauticalMap, toggleChart } from './hud.js';
import { createVoyageState, drinkRum, stepVoyage, weaponProfiles } from './voyage-feel.js';
import { BALL_COLOR, BALL_SCALE, BALL_SPIN, WAKE_PUFF, WAKE_GAP, WAKE_SIZE, WAKE_LIFE } from './projectile-look.js';
import { Expeditions } from './expeditions.js';
import { angleDelta } from './navigation.js';
import { CrewRenderer } from './crew-renderer.js';
import { coastRadius } from './coastline.js';
import { GreekFireTrail } from './greek-fire.js';
import { GrapplingHook } from './grappling.js';
import { arrangeWorldLabels } from './hud-layout.js';
import { createCombatFeel, feel, stepFeel, addTrauma, freeze, timeScale, cameraTrauma, registerHit, comboMultiplier, rollCritical, bearingAngle, lowHullLevel, ramImpulse } from './combat-feel.js';
import { mountCombatJuice } from './combat-juice.js';
import { islandDefinitions,worldBounds,getHomeBase,teamSpawn,isTeamDocked,battleWinner } from './battlefield.js';
import { TerritoryArt } from './territory-art.js';
import { mountQABench, qaSimulationDelta } from './qa-bench.js';
import { mountEmbark } from './embark.js';

const $ = id => document.getElementById(id);
mountNauticalHUD();
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x60b6aa);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(.8); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1; $('game').appendChild(renderer.domElement);
const ambient = new THREE.HemisphereLight(0xfff6da, 0x245c52, 1.6); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe7ae, 2.4); sun.position.set(-35, 70, 45); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 220 });
sun.shadow.normalBias = .12; sun.shadow.bias = -.0003; scene.add(sun, sun.target);
const camera = new THREE.OrthographicCamera(-70, 70, 40, -40, .1, 450);
const cameraTarget = new THREE.Vector3(), cameraOffset = new THREE.Vector3(0, 88, 112);
let requestedZoom = 50, zoom = 50, showcase = null,qaFleetReview=false;
const islands = islandDefinitions.map(def=>Object.assign(createIsland(def),def));
islands.forEach(i => scene.add(i.group));
const port = getHomeBase(islands,'blue'), ocean = createOcean(scene, islands), gulls = createGulls(scene);
createClouds(scene);
const renderReflections = createReflections(renderer, scene, camera, ocean), fx = new SeaEffects(scene), shotFx = new ShotEffects(scene);
const audio = new AudioDirector();
const director = new Director({onEvent:event=>audio.play(event.type==='invasion'?'island.invasion':event.type==='discovery'?'island.discovered':event.role==='harpooner'?'creature.roar':'notice',{priority:event.priority})}), bestiary = createBestiary(scene), islandLife = enrichIslands(islands, scene);
const weather = new Weather(scene, sun, ambient, ocean, (...args) => director.announce(...args));
const ships = [];
function makeShip(name, team, x, z, heading, scale, variant = scale < 1 ? 'cutter' : team === 'red' ? 'galleon' : 'brig') {
  const object = createShip(team, scale, variant); object.position.set(x, 0, z); object.rotation.y = heading; scene.add(object);
  const s = { name, team, variant, object, x, z, heading, scale, speed: 0, vx: 0, vz: 0, yawRate: 0, maxSpeed: 9, hp: 160, maxHp: 160, rig: 100, maxRig: 100, crew: 12, maxCrew: 12, gold: 0, target: null, cooldown: 0, cooldownTotal: 2.8, guns: { port: { left: 0, total: 2.8 }, starboard: { left: 0, total: 2.8 } }, level: 1, damage: 24, reload: 2.8, ai: 0, recoil: 0, dead: 0, bowTimer: 0, smokeTimer: 0, home: { x, z }, upgrades: { hull: 0, cannons: 0, crew: 0 }, wake: new Wake(scene,ocean) };
  s.hitWidth=object.userData.hitWidth;s.hitLength=object.userData.hitLength;
  ships.push(s); return s;
}
const spawn=(team,slot=0)=>teamSpawn(islands,team,slot);
const blueSpawn=spawn('blue'),redSpawn=spawn('red'),blueEscort=spawn('blue',1),redEscort=spawn('red',1);
const player = makeShip('La Indomable', 'blue', blueSpawn.x,blueSpawn.z,blueSpawn.heading,1.4);player.crew=8;player.moored=true;
const ally = makeShip('Brisa de Acero', 'blue',blueEscort.x,blueEscort.z,blueEscort.heading,.78,'guard'); ally.maxSpeed = 6;ally.crew=8;ally.aiRole='defender';
const enemy = makeShip('La Dama Roja', 'red',redSpawn.x,redSpawn.z,redSpawn.heading,1.35); enemy.maxSpeed = 6;enemy.crew=8;enemy.aiRole='skirmisher';
const scout = makeShip('Cuervo Carmesí', 'red',redEscort.x,redEscort.z,redEscort.heading,.8); scout.maxSpeed = 6;scout.crew=8;scout.aiRole='merchant';
for (const ship of ships) if (ship !== player) { ship.damage = 16; ship.reload = ship.cooldownTotal = 4.2; }
dressShips(ships);
renderShipPortrait(player);
const labels = [];
function label(text, object, offset, className = '') {
  const el = document.createElement('div'); el.className = `world-label ${className}`; el.innerHTML = text; $('labels').appendChild(el);
  labels.push({ el, object, offset }); return el;
}
// No label on the player's own hull: the camera is permanently locked to it and
// the ship card in the HUD already carries the name, so a floating tag only
// covers the deck the player is steering.
enemy.label = label('', enemy.object, 15, 'enemy'); scout.label = label('', scout.object, 10, 'enemy secondary-label');
label('FUERTE DEL DIENTE ROTO <small>BASE CORSARIA · CONQUÍSTALA PARA VENCER</small>', getHomeBase(islands,'red').group, 16, 'island');
label('PUERTO RON RON <small>ORO SEGURO. REPUTACIÓN DUDOSA.</small>', port.group, 8, 'island');

const qaEnabled = new URLSearchParams(location.search).get('qa') === '1';
// Per-match tallies for playtesting. Only written under the QA flag.
const qaStats = { fired: 0, hits: 0, hitsByKind: [0, 0, 0, 0], damageByKind: [0, 0, 0, 0], rams: 0 };
let time = 0, elapsed = 0, paused = qaEnabled, qaSpeed = 1, gameOver = false, bank = 200, enemyBank=200,blueScore = 0,redScore=0;
let sound = audio.volumes.master > 0, lastMasterVolume = audio.volumes.master || AUDIO_DEFAULTS.master, toastUntil = 0, quality = 'high';
const combat = createCombatFeel();
const juice = mountCombatJuice();
/** Replaces the old camera `shake` scalar with a single decaying trauma channel. */
const shakeImpulse = amount => addTrauma(combat, amount);
let lootProgress = null, lootBoat=null, boarding = null, selectedEnemy = null, rightHeld = false, buttonHeld = false, fireBuffer = 0, sprintHeld=false;
let inputEngaged = false, frame = 0, uiClock = 0, reflectionClock = 0, fpsClock = 0, fpsFrames = 0, fps = 60;
let xp = 0, rank = 1, weaponIndex = 0, greekActive = 0, greekCooldown = 0, firefightCooldown = 0;
const voyage=createVoyageState();
const flameAtlas=new THREE.TextureLoader().load('/assets/vfx/greek-fire-atlas-v2.png');
flameAtlas.colorSpace=THREE.SRGBColorSpace;flameAtlas.minFilter=THREE.LinearFilter;flameAtlas.magFilter=THREE.NearestFilter;
const greekSea = new GreekFireTrail(scene,{ocean,wave:(x,z,t)=>weather.wave(x,z,t),fx,flameAtlas});
// Four projectiles that have to be told apart at a glance, in flight, at range.
// The palette is separated in hue, not just in brightness: iron and the bomb were
// both near-black, which on dark water is the same dot twice.
const weapons = weaponProfiles.map((w,i)=>({...w,color:BALL_COLOR[i]}));
// These were unlit, which is why a cannonball read as a speck of dirt: the scene
// has a sun and a hemisphere light, and a basic material throws both away. Lit,
// with a little emissive so a ball never sinks into a dark sea, they get a shaded
// body and a moving highlight — which is most of what makes one look solid.
const projectileMaterials = weapons.map(w => new THREE.MeshStandardMaterial({
  color: w.color, roughness: .42, metalness: .55, emissive: w.color, emissiveIntensity: .18,
}));
const keys = new Set(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aim = new THREE.Vector3(), aimScreen = { x: 0, y: 0, valid: false }, temp = new THREE.Vector3(), wakePoint = new THREE.Vector3();
const shots = [], salvoQueue = [], drops = [], raiders = [], airborne = [], floating = [],boardingFighters=[];
const shotGeometry = new THREE.SphereGeometry(.18, 7, 5), shotMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: .42, metalness: .55 });
// Hostile shot reads hot: enemy iron glows red against the water, so a salvo in
// flight can be blamed on a team at a glance instead of being neutral confetti.
const hostileProjectileMaterials = weapons.map(() => new THREE.MeshStandardMaterial({
  color: 0x7a2418, roughness: .42, metalness: .55, emissive: 0xff4526, emissiveIntensity: .55,
}));
const ballPool = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(shotGeometry, shotMaterial); m.visible = false; scene.add(m); return m; });
const shotRing = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.05, 40), new THREE.MeshBasicMaterial({ color: 0xf2c66f, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
shotRing.rotation.x = -Math.PI / 2; shotRing.visible = false; scene.add(shotRing);
const grapple = new GrapplingHook(scene,{onLaunch:(source)=>playSound('hook.launch',1,source),onHit:(target,p)=>{playSound('hook.hit',1,p);shakeImpulse(.3);fx.impact(new THREE.Vector3(p.x,p.y,p.z),true);},onRelease:()=>playSound('hook.release',.8,player)});

// Hull flash needs per-ship materials. The ship builder marks the clones it
// owns; crew and dressing added later reuse the world cache and are skipped so
// one struck hull never lights up every pirate on screen.
function flashMaterials(ship) {
  if (!ship.flashMaterials || time - (ship.flashScannedAt ?? -99) > 4) {
    ship.flashMaterials = [];
    ship.object.traverse(o => { if (o.isMesh && o.material?.emissive && o.material.userData?.shipOwn) ship.flashMaterials.push(o.material); });
    ship.flashScannedAt = time;
  }
  return ship.flashMaterials;
}
function flashHull(target, strength = 1) {
  // Creatures are voxel batches and towers are stonework; neither takes a hit flash.
  if (target.isCreature || target.isTower) return;
  const heat = clamp(strength, .2, 1);
  target.flashUntil = Math.max(target.flashUntil ?? 0, time + .13);
  target.flashPeak = heat;
  for (const material of flashMaterials(target)) material.emissive.setRGB(heat, heat * .82, heat * .6);
}
function stepHullFlash() {
  for (const target of ships) {
    if (!target.flashUntil) continue;
    const left = target.flashUntil - time;
    if (left <= 0) { target.flashUntil = 0; for (const material of flashMaterials(target)) material.emissive.setRGB(0, 0, 0); continue; }
    const heat = target.flashPeak * Math.min(1, left / .13);
    for (const material of flashMaterials(target)) material.emissive.setRGB(heat, heat * .82, heat * .6);
  }
}
/** Screen position of a world point, or null when it is off camera. */
function projectToScreen(point, yOffset = 0) {
  temp.set(point.x, (point.y ?? 0) + yOffset, point.z).project(camera);
  if (temp.z > 1) return null;
  return { x: (temp.x * .5 + .5) * innerWidth, y: (-temp.y * .5 + .5) * innerHeight, inside: Math.abs(temp.x) <= 1 && Math.abs(temp.y) <= 1 };
}

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); toastUntil = performance.now() + 3600; }
function playSound(type, strength = 1, position) { return audio.play(type,{gain:strength,position}); }
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inPort = () => isTeamDocked(player,islands);
const modalOpen = () => !!document.querySelector('dialog[open]');
const locked = () => paused || gameOver || showcase !== null || modalOpen();
const nearestEnemy = (s, range = 48) => ships.filter(o => o.team !== s.team && !o.dead && (s !== player || o.object.visible) && distance(s, o) < range).sort((a, b) => distance(s, a) - distance(s, b))[0];
const nearIsland = () => islands.filter(i=>!(i.homeTeam===player.team&&i.owner===player.team)&&distance(player,i)<i.r+12).sort((a,b)=>distance(player,a)-distance(player,b))[0];

function floatText(text, position, kind = '') {
  if (floating.length > 18) { const old = floating.shift(); old.el.remove(); }
  const el = document.createElement('div'); el.className = `combat-text ${kind}`; el.textContent = text; $('labels').appendChild(el);
  floating.push({ el, position: position.clone(), age: 0 });
}
function resetGuns(s, value) { for (const key of ['port', 'starboard']) { s.guns[key].left = s.guns[key].total = value; } s.cooldown = s.cooldownTotal = value; }
/** Chain shot shreds rigging as well as men: torn sails are a lasting penalty. */
function damageRig(s, amount) {
  const before = s.rig; s.rig = Math.max(0, s.rig - amount);
  if (before > 0 && s.rig <= 0) {
    floatText('¡APAREJO DESTROZADO!', s.object.position.clone().setY(9), 'crit');
    if (s === player) toast('Las velas están hechas jirones. Repara en puerto o con reparadores.');
    director.log(`El aparejo de ${s.name} se destrozó.`, 'hurt');
    playSound('ship.creak', .8, s);
  }
}
function extinguish() {
  if (locked() || player.dead) return;
  if (!(player.burning > 0)) return toast('No hay fuego a bordo. Todavía.');
  if (firefightCooldown > 0) return toast('La tripulación ya está achicando el agua. Un momento.');
  player.burning = 0; player.burnTick = 0; player.fireHint = false; firefightCooldown = 12;
  fx.impact(player.object.position.clone().setY(2), false);
  toast('¡Fuego sofocado! La tripulación mojada protesta.');
  playSound('fire.suppress', .85, player);
}
function fire(s, target = null, point = null) {
  if (s.dead || s.support === 'scout' || s.cooldown > 0 || locked() || (s === player && boarding)) return false;
  // Salvo counters for measurement: shots leaving a hull and rounds reaching
  // one. combat.landed only counts damage events, which merges a bomb shell's
  // five hits into one and hides how many projectiles actually mattered.
  if (s === player) qaStats.fired++;
  target ??= !point ? (s === player && selectedEnemy && selectedEnemy.object.visible && !selectedEnemy.dead && distance(s, selectedEnemy) < 48 ? selectedEnemy : nearestEnemy(s)) : null;
  const kind = s === player ? weaponIndex : 0,profile=weapons[kind];
  const destination = point?.clone() ?? (target ? new THREE.Vector3(target.x, 0, target.z) : new THREE.Vector3(s.x - Math.sin(s.heading) * profile.range*.8, 0, s.z - Math.cos(s.heading) * profile.range*.8));
  // Lead is a hint, not a promise: .6 keeps a turning target possible to miss.
  if (target) { const lead = distance(s, target) / profile.speed; destination.x += target.vx * lead * .6; destination.z += target.vz * lead * .6; }
  temp.set(destination.x - s.x, 0, destination.z - s.z); if (temp.length() > profile.range) destination.copy(temp.setLength(profile.range)).add(new THREE.Vector3(s.x, 0, s.z));
  // Which guns bear is geometry, not aim assist: the salvo comes off the side the
  // destination lies on, and firing forward or astern costs damage and precision.
  const bearing = bearingAngle(destination.x, destination.z, s), side = bearing > 0 ? 1 : -1;
  const gun = s.guns[sideKey(bearing)];
  if (gun.left > 0) {
    if (s === player) { const other = s.guns[side > 0 ? 'port' : 'starboard']; if (other.left <= 0) toast(`Costado ${side > 0 ? 'de babor' : 'de estribor'} recargando. ¡Vira para presentar el otro!`); }
    return false;
  }
  const angleFactor = broadsideFactor(bearing), crossing = target ? crossingTBonus(bearing, bearingAngle(s.x, s.z, target)) : 1;
  const cannons = s.object.userData.cannons.filter(c => c.userData.side === side).slice(0,kind===3?2:99);
  // A live streak turns the same gunnery into a heavier one.
  const streak = s === player ? comboMultiplier(combat.combo) : 1;
  cannons.forEach((cannon, index) => salvoQueue.push({ s, cannon, target,destination: destination.clone().add(new THREE.Vector3((index - (cannons.length-1)/2) * profile.spread * (2 - angleFactor), 0, (index - (cannons.length-1)/2) * profile.spread * (2 - angleFactor))), delay: index * (kind===1?.045:.08), damage: s.damage / cannons.length * profile.damage * angleFactor * crossing * (s === player ? (1 + campaign.weaponLevels[kind] * .08) * streak : 1), kind }));
  // Each broadside rearms on its own clock: fire one side, turn, fire the other.
  gun.total = gun.left = cannonReload(s, profile.reload, s === player && voyage.rumTime > 0);
  s.cooldown = Math.min(s.guns.port.left, s.guns.starboard.left); s.cooldownTotal = Math.max(s.guns.port.total, s.guns.starboard.total);
  if (s === player) { inputEngaged = true; fireBuffer = 0; player.audioCombatUntil = time + 7; }
  return true;
}
function launch(q) {
  if (q.s.dead) return;
  const ball = ballPool.find(b => !b.visible); if (!ball) return;
  q.s.object.updateMatrixWorld(true);
  const origin = q.cannon.localToWorld(new THREE.Vector3(q.cannon.userData.side * .5, 0, 0));
  const direction = q.destination.clone().sub(origin).setY(0).normalize();
  const flight=origin.distanceTo(q.destination)/weapons[q.kind].speed;q.destination.y=weather.wave(q.destination.x,q.destination.z,time+flight)+(q.target?.isCreature ? .2 : q.target ? 1 : -.12);
  ball.position.copy(origin); ball.visible = true;
  ball.material = (q.s.team === player.team ? projectileMaterials : hostileProjectileMaterials)[q.kind]; ball.scale.set(...BALL_SCALE[q.kind]);
  if(!ball.userData.links){ball.userData.links=[];for(const side of [-1,1]){const link=new THREE.Mesh(shotGeometry,projectileMaterials[1]);link.position.x=side*.5;link.scale.set(.9,.9,.9);ball.add(link);ball.userData.links.push(link);}}
  ball.userData.links.forEach(l=>l.visible=q.kind===1);
  shots.push({ ball, from: origin, to: q.destination, previous: origin.clone(), age: 0, trail: 0, duration: Math.max(.22, origin.distanceTo(q.destination) / weapons[q.kind].speed), arc:weapons[q.kind].arc, source: q.s, damage: q.damage, kind: q.kind, streak: shotFx.begin(origin, q.kind) });
  q.cannon.userData.recoil = .32; q.s.recoil += q.cannon.userData.side * .016;
  // Recoil is expressed as hull kick (`s.recoil`) plus a whisper of camera
  // tremor. Deliberately tiny and NOT scaled by cannon count: a broadside fires
  // 12-16 of these within a second, and a per-cannon camera kick that adds up
  // is what turned firing into an earthquake. Muzzle flash and recoil carry the
  // weight instead.
  fx.muzzle(origin, direction, q.kind); if (q.s === player) shakeImpulse(q.kind === 3 ? .07 : q.kind === 1 ? .05 : .03);
  playSound(['cannon.iron','cannon.chain','cannon.fire','cannon.bomb'][q.kind],q.s===player?1:.6,origin);
}
/** Rank-ups are a combat reward, so every kill path funnels through here. */
function grantXp(amount) {
  xp += amount;
  while (xp >= rank * 80) {
    xp -= rank * 80; rank++; player.maxHp += 5; player.hp = Math.min(player.maxHp, player.hp + 5);
    player.damage *= 1.02; player.maxCrew++; player.crew++; updateUpgradeModel(player); renderShipPortrait(player);
    toast(`¡Rango ${rank}! +5 casco, +2% daño y +1 plaza de tripulación.`);
    juice.banner(`RANGO ${rank}`, 'CASCO · DAÑO · TRIPULACIÓN');
    playSound('victory', .5, player);
  }
}
function damage(s, amount, impact, source = player, options = {}) {
  if (s.dead) return 0;
  const byPlayer = source === player, hostile = byPlayer && s.team !== player.team;
  const crit = byPlayer && options.crit === true;
  const dealt = crit ? amount * feel.critMultiplier : amount;
  const split = options.kind === 1 && s.rig != null && !s.isTower && !s.isCreature ? splitDamage(options.kind, dealt) : { hull: dealt, rig: 0 };
  if (split.rig > 0) damageRig(s, split.rig);
  s.hp = Math.max(0, s.hp - split.hull); s.lastHit = time;
  flashHull(s, crit ? 1 : .7);
  if (source?.isCreature) playSound('creature.roar', .8, source);
  const killed = s.hp <= 0;
  if (hostile) {
    registerHit(combat, time, { damage: dealt, crit, killed });
    addTrauma(combat, feel.traumaShot * (crit ? 2.1 : 1));
    if (crit) { freeze(combat, feel.hitStop.crit); juice.critical(); playSound('impact.crit', .95, s); }
    const screen = projectToScreen(impact);
    if (screen) juice.marker(screen.x, screen.y, crit);
    juice.combo(combat.combo, comboMultiplier(combat.combo));
    if (killed) { freeze(combat, feel.hitStop.kill); addTrauma(combat, feel.traumaKill); }
  }
  if (s.isTower) {
    floatText(`−${Math.round(dealt)}`, impact.clone().setY(5), crit ? 'crit' : 'hit');
    if (killed) { s.dead = 1; s.object.visible = false; director.log(`${s.name} cayó. La costa está abierta.`, 'victory'); }
    return dealt;
  }
  if (s.isCreature) {
    playSound('creature.hit', .7, s);
    s.provokedUntil = time + 30;
    floatText(`−${Math.round(dealt)}`, impact.clone().setY(5), crit ? 'crit' : 'hit');
    if (killed) {
      s.dead = 90; s.respawnDuration = 90; drops.push({ g: chest(scene, s.x, .3, s.z, 1.35), gold: s.gold });
      if (byPlayer) grantXp(s.xp);
      director.announce(`${s.name}: al fondo`, byPlayer ? `+${s.xp} EXP. El botín flota. El ego también.` : `El botín flota. ¡A por él!`, 'victory');
      director.log(`${source.name} derrotó a ${s.name}`, 'victory');
      juice.banner(s.name.toUpperCase(), byPlayer ? `+${s.xp} EXP` : 'EL BOTÍN FLOTA'); fx.impact(impact, true); playSound('loot.coin', .75, s);
    }
    return dealt;
  }
  if (s === player) {
    addTrauma(combat, feel.traumaHurt); freeze(combat, feel.hitStop.hurt);
    juice.hurt(bearingAngle(impact.x, impact.z, player), 1);
    combat.damageTaken += dealt;
  }
  floatText(`−${Math.round(dealt)}`, impact.clone().add(new THREE.Vector3(0, 2, 0)), s === player ? 'hurt' : crit ? 'crit' : 'hit');
  if (s.hp < s.maxHp * .65 && s.crew > 6 && Math.random() > .6) {
    s.crew--; const person = pirate(scene, impact.x, 3, impact.z, s.team === 'blue' ? palette.blue : palette.red);
    airborne.push({ object: person, velocity: new THREE.Vector3((Math.random() - .5) * 5, 6, (Math.random() - .5) * 5), life: 2 });
  }
  if (killed) sink(s);
  return dealt;
}
function sink(s) {
  playSound('ship.sink',s===player?1:.75,s);
  const byPlayer = s !== player && s.team !== player.team;
  if (byPlayer) {
    grantXp(20);
    juice.banner(`${s.name.toUpperCase()} SE HUNDE`, '+20 EXP · SU BOTÍN FLOTA');
    freeze(combat, feel.hitStop.kill);
  }
  if(grapple.active&&(s===player||s===grapple.target)){grapple.cancel('target-lost');boarding=null;boardingFighters.splice(0).forEach(p=>p.removeFromParent());}
  // Reinforcements need time to refit. Both AI fleets use the same interval,
  // leaving a real capture window after their defenders have been beaten.
  s.respawnDelay=s===player||s.support?7:35;
  s.dead=s.respawnDelay;s.speed=s.vx=s.vz=s.yawRate=0;s.target=null;
  fx.impact(s.object.position.clone().setY(2), true);
  if (s.gold) { const g = chest(scene, s.x, .3, s.z, 1.2); drops.push({ g, gold: s.gold }); s.gold = 0; }
  if (s.support) { s.destroyed=true;s.object.visible=false;s.wake.clear();if(s.zone)s.zone.visible=false;director.log(`${s.name} se hundió. Su botín flota a la deriva.`);return; }
  if (s === player) { stopLoot(); stopBoarding('sunk'); clearInput(); toast('¡Barco hundido! Regresas a Puerto Ron Ron en 7 segundos.'); }
  else if(s.object.visible&&distance(player,s)<65) { toast(`${s.name} acaba de convertirse en submarino. ¡A por los cofres!`); director.speak('boatswain','Otro capitán que confunde navegar con bucear. ¡Recoge esos cofres!',{priority:1});director.log(`${s.name} ha abandonado la superficie.`, 'victory'); }
}
function stopLoot() { if(lootProgress?.island.lootSource===player)lootProgress.island.lootSource=null; lootProgress = null;lootBoat?.removeFromParent();lootBoat=null; raiders.splice(0).forEach(r => scene.remove(r.object)); }
function loot() {
  if (locked() || player.dead || boarding || grapple.active) return;
  if(lootProgress){stopLoot();toast('Bote de vuelta. Los cofres pueden esperar.');return;}
  const island = nearIsland();
  if (!island) return toast('Acércate a una isla y pulsa E para desembarcar.');
  if(island.invasion?.source===player){campaign.cancelInvasion(island);toast('La tripulación vuelve a bordo.');return;}
  if(island.owner==='neutral'&&!island.defenders&&island.type!=='fort'&&(!island.tower||island.tower.dead)){island.owner=player.team;director.log(`${island.name} se suma a las Velas Azules.`,'victory');}
  if (island.owner !== 'blue') { campaign.startInvasion(island, player); inputEngaged=true; return; }
  if (!island.available) return toast('Esta isla se está recuperando. Busca otro tesoro.');
  if(island.lootSource&&island.lootSource!==player)return toast('Otra tripulación ya está saqueando esta cala.');
  island.lootSource=player;player.target = null; lootProgress = { island, progress: 0,age:0 };
  playSound('crew.step',.75,player); inputEngaged = true;
  lootBoat=new THREE.Group();scene.add(lootBoat);box(lootBoat,1.9,.36,4.4,0x87613b,0,.15,0);for(const side of [-1,1]){box(lootBoat,.17,.3,4.5,0xbb945b,side*.95,.4,0);rod(lootBoat,[side*.8,.45,0],[side*2,.05,0],.07,0xbea470);}for(let n=0;n<3;n++)box(lootBoat,1.8,.12,.3,0xc29b62,0,.5,n*1.25-1.25);
  for (let i = 0; i < Math.min(6,player.crew); i++) raiders.push({ object: pirate(scene, player.x, 1, player.z), from: new THREE.Vector3(player.x, 1, player.z), to: new THREE.Vector3(island.x + island.r * .25 + (i % 3 - 1), .6, island.z + 2 + Math.floor(i / 3)) });
  toast('Tu tripulación desembarca. Protege el barco durante el saqueo.');
}
function stopBoarding(reason='cancelled') {
  grapple.cancel(reason);boarding=null;boardingFighters.splice(0).forEach(p=>p.removeFromParent());
}
function board() {
  if (locked() || player.dead || lootProgress) return;
  if(grapple.active){stopBoarding();toast('Cabo suelto. ¡Vuelve al timón!');return;}
  const eligible=s=>ships.includes(s)&&s!==player&&!s.dead&&!s.destroyed&&s.object.visible&&s.team!==player.team&&distance(player,s)<=grapple.range;
  const target=eligible(selectedEnemy)?selectedEnemy:ships.filter(eligible).sort((a,b)=>distance(player,a)-distance(player,b))[0];
  if(!target)return toast('El garfio alcanza 32 m. Acércate a un barco rival.');
  const result=grapple.launch(player,target);
  if(!result.ok)return toast('Ese barco quedó fuera del alcance del garfio.');
  player.target=null;player.moored=false;selectedEnemy=target;inputEngaged=true;
}

function updateUpgrades() {
  const docked = inPort();
  $('upgrade-message').textContent = docked ? `${bank} oro disponible · cada mejora admite 3 niveles.` : 'Regresa a Puerto Ron Ron para instalar las mejoras.';
  for (const button of document.querySelectorAll('[data-upgrade]')) {
    const kind = button.dataset.upgrade, level = player.upgrades[kind], cost = upgradeCost(kind, level);
    button.disabled = !docked || !!player.dead || bank < cost || level >= 3;
    button.querySelector('b').textContent = level === 3 ? 'Nivel máximo' : `${cost} oro · nivel ${level + 1}`;
    button.querySelector('small').textContent = kind === 'hull' ? `${player.maxHp} → ${player.maxHp + 35} vida · blindaje visible` : kind === 'cannons' ? `${player.damage} → ${player.damage + upgradeDefinitions.cannons.damage} daño · ${(player.reload * upgradeDefinitions.cannons.reloadMultiplier).toFixed(1)} s recarga` : `${player.maxCrew} → ${player.maxCrew + 4} plazas · contrata a los nuevos piratas`;
    button.classList.toggle('maxed', level >= 3);
  }
}
function buyShipUpgrade(kind) {
  const result=purchaseUpgrade(player,kind,bank,inPort());if(!result.ok)return false;
  bank=result.bank;updateUpgradeModel(player);renderShipPortrait(player);playSound('upgrade.install');updateUpgrades();updateHUD();toast('Mejora instalada. ¡Que tiemble la competencia!');return true;
}
document.querySelectorAll('[data-upgrade]').forEach(button=>button.addEventListener('click',()=>buyShipUpgrade(button.dataset.upgrade)));

function clearInput() { keys.clear(); rightHeld = buttonHeld = sprintHeld = false; fireBuffer = 0; voyage.boosting=false; voyage.boostIntensity=0; }
function openDialog(id) { clearInput(); $(id).showModal(); if (id === 'upgrade-dialog') updateUpgrades(); }
function togglePause() { paused = !paused; clearInput(); $('pause').textContent = paused ? '▷' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? 'Continuar' : 'Pausar'); toast(paused ? 'Mar en pausa · P para continuar' : '¡Velas al viento!'); }
$('pause').onclick = togglePause; $('upgrades').onclick = () => openDialog('upgrade-dialog'); $('settings').onclick = () => openDialog('settings-dialog');
$('board').onclick = board; $('loot').onclick = loot;
function switchWeapon() { playSound('ui.select');weaponIndex = (weaponIndex + 1) % weapons.length; $('weapon-name').textContent = weapons[weaponIndex].name; director.log(`Artillero: «${weapons[weaponIndex].name}. Con cariño, capitán.»`); }
function serveRum(){if(locked()||player.dead)return;if(drinkRum(voyage)){director.speak('sailor','¡Una ronda, capitán! Recargamos más rápido. La puntería… ya era discutible.',{priority:1});playSound('crew.rum');}else toast(voyage.rumCharges<=0?'Sin ron. Compra una caja en Compañía.':'Todavía estamos brindando.');}
$('rum').onclick=serveRum;$('map-mode').onclick=toggleChart;
function holdSprint(){
  if(locked()||player.dead||voyage.exhausted||voyage.stamina<=0)return;
  player.moored=false;inputEngaged=true;sprintHeld=true;
}
function releaseSprint(){sprintHeld=false;}
$('sprint').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();holdSprint();if(sprintHeld)$('sprint').setPointerCapture(e.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('sprint').addEventListener(event,releaseSprint);
$('sprint').addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat)holdSprint();}});
$('sprint').addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();releaseSprint();}});
$('sprint').addEventListener('blur',releaseSprint);
function greekFire() {
  if (locked() || player.dead || greekCooldown > 0) return;
  greekActive = Math.min(6,4+campaign.greekLevel*.75); greekCooldown = 26-campaign.greekLevel*2;
  greekSea.igniteTrail(player,campaign.greekLevel);
  const aft=6.5*player.scale,position=new THREE.Vector3(player.x+Math.sin(player.heading)*aft,player.object.position.y+.35,player.z+Math.cos(player.heading)*aft);
  fx.muzzle(position,new THREE.Vector3(Math.sin(player.heading),.15,Math.cos(player.heading)));
  shakeImpulse(.55);director.log('¡Marea roja! Aceite, fuego y ninguna intención de pedir perdón.','victory');playSound('fire.ignite',1,position);
}
$('weapon').onclick = switchWeapon; $('greek-fire').onclick = greekFire;
$('weather-button').onclick = () => { weather.cycle(); $('atmosphere').value = weather.mode; };
$('fire').addEventListener('pointerdown', e => { if (locked()) return; e.preventDefault(); $('fire').setPointerCapture(e.pointerId); buttonHeld = true; fireBuffer = .22; fire(player); });
$('fire').addEventListener('pointerup', () => { buttonHeld = false; }); $('fire').addEventListener('pointercancel', () => { buttonHeld = false; });
$('fire').onclick = e => { if (e.detail === 0) fire(player); };
document.querySelectorAll('dialog .close').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
function updateAudioControls(){
  sound=audio.volumes.master>0;
  $('sound').setAttribute('aria-label',sound?'Silenciar sonido':'Activar sonido');$('sound').setAttribute('aria-pressed',String(sound));$('sound').title=sound?'Silenciar sonido':'Activar sonido';$('sound').classList.toggle('sound-on',sound);
  $('settings-sound').textContent=sound?'Silenciar todo':'Activar sonido';$('settings-sound').setAttribute('aria-pressed',String(sound));
  for(const key of ['master','music','ambience','effects']){const slider=$('audio-'+key),value=Math.round(audio.volumes[key]*100);if(slider){slider.value=String(value);slider.setAttribute('aria-valuetext',value+' por ciento');$('audio-'+key+'-value').textContent=value+' %';}}
}
function syncAudioState(){
  if(!audio.unlocked)return;
  const suspend=paused||document.hidden;
  if(suspend&&!audio.paused)audio.pause();else if(!suspend&&audio.paused)audio.resume();
}
function unlockAudio(){audio.unlock().then(()=>{syncAudioState();updateAudioControls();});}
window.addEventListener('pointerdown',unlockAudio,{once:true,capture:true});window.addEventListener('keydown',unlockAudio,{once:true,capture:true});
$('sound').onclick=()=>{if(audio.volumes.master>0){lastMasterVolume=audio.volumes.master;audio.setVolumes({master:0});}else{audio.setVolumes({master:lastMasterVolume});playSound('ui.select');}updateAudioControls();};
$('settings-sound').onclick=()=>$('sound').click();
for(const key of ['master','music','ambience','effects']){$('audio-'+key)?.addEventListener('input',event=>{audio.setVolumes({[key]:Number(event.target.value)/100});if(key==='master'&&audio.volumes.master>0)lastMasterVolume=audio.volumes.master;updateAudioControls();});}
updateAudioControls();
// Menu foley remains audible while simulation is frozen. Actual pause and hidden
// documents suspend the context; menu scenes gently return to the harbor score.
const menuAudio=new MutationObserver(records=>{for(const record of records)if(record.target.tagName==='DIALOG')playSound(record.target.open?'ui.open':'ui.close');});
menuAudio.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&!button.disabled&&(button.hasAttribute('data-tab')||button.id==='map-mode'||button.id==='chart-open'))playSound('ui.select');});
window.addEventListener('pagehide',()=>audio.dispose(),{once:true});
if(import.meta.hot)import.meta.hot.dispose(()=>{audio.dispose();menuAudio.disconnect();});
$('atmosphere').onchange = e => weather.set(e.target.value);
$('quality').onchange = e => { quality = e.target.value; renderer.setPixelRatio(quality === 'high' ? .8 : .6); renderer.shadowMap.enabled = quality === 'high'; };
window.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || modalOpen() || (['Space','Enter'].includes(e.code)&&e.target.closest('button,[role="button"],a'))) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' && !e.repeat) return togglePause();
  if (e.code === 'KeyH' && !e.repeat) return document.body.classList.toggle('hidden-ui');
  if (locked()) return; keys.add(e.code);if(e.code==='ShiftLeft'||e.code==='ShiftRight'){player.moored=false;inputEngaged=true;}
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) inputEngaged = true;
  if (e.repeat) return;
  if (e.code === 'Space') { fireBuffer = .22; fire(player); }
  if (e.code === 'KeyZ') switchWeapon(); if (e.code === 'KeyR') greekFire(); if (e.code === 'KeyT') { weather.cycle(); $('atmosphere').value = weather.mode; }
  if(e.code==='KeyC')serveRum();if(e.code==='KeyM')toggleChart();
  if (e.code === 'KeyE') loot(); if (e.code === 'KeyQ') board(); if (e.code === 'KeyB') campaign.open('ship'); if (e.code === 'KeyV') extinguish();
});
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { director.setReadingPaused(locked() || document.hidden);if (document.hidden) clearInput();syncAudioState(); });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
function updateAim(e) { aimScreen.x = e.clientX; aimScreen.y = e.clientY; aimScreen.valid = true; pointer.set(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2); raycaster.setFromCamera(pointer, camera); raycaster.ray.intersectPlane(plane, aim); }
renderer.domElement.addEventListener('pointermove', updateAim);
renderer.domElement.addEventListener('pointerdown', e => {
  if (locked() || player.dead) return; updateAim(e); inputEngaged = true;
  if (e.button === 2) { rightHeld = true; renderer.domElement.setPointerCapture(e.pointerId); fire(player, null, aim); return; }
  const targets = [...ships.filter(s => s.team !== player.team), ...bestiary.entries, ...campaign.towers.filter(t=>t.team!=='blue')].filter(s => !s.dead&&s.object.visible);
  const hit = raycaster.intersectObjects(targets.map(s => s.object), true)[0];
  if (hit) { let object = hit.object; while (object.parent && object.parent !== scene) object = object.parent; selectedEnemy = targets.find(s => s.object === object); fire(player, selectedEnemy); }
  else { if(grapple.active||boarding)return toast('Pulsa Q para soltar el cabo antes de cambiar de rumbo.');player.target = { x: clamp(aim.x, worldBounds.minX, worldBounds.maxX), z: clamp(aim.z, worldBounds.minZ, worldBounds.maxZ) }; selectedEnemy = null; const r = $('reticle'); r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`; r.style.display = 'block'; setTimeout(() => r.style.display = 'none', 650); }
});
renderer.domElement.addEventListener('pointerup', () => { rightHeld = false; }); renderer.domElement.addEventListener('pointercancel', clearInput);
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); requestedZoom = clamp(requestedZoom + e.deltaY * .025, showcase === null ? 40 : 14, showcase === null ? 115 : 70); }, { passive: false });
function resize() { const a = innerWidth / innerHeight, span = zoom * Math.max(1, Math.sqrt(1.8 / a)); camera.left = -span * a / 2; camera.right = span * a / 2; camera.top = span / 2; camera.bottom = -span / 2; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
window.addEventListener('resize', resize); resize();

function collideCoasts(s) {
  for (const i of islands) {
    const dx = s.x - i.x, dz = (s.z - i.z) / .72, radius = i.r * coastRadius(Math.atan2(dz,dx),i.x,i.z) + 2.7 * s.scale, d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    const nx = dx / Math.max(d, .001), nz = dz / Math.max(d, .001);
    s.x = i.x + nx * radius; s.z = i.z + nz * radius * .72;
    const normal = new THREE.Vector2(nx, nz / .72).normalize(), inward = s.vx * normal.x + s.vz * normal.y;
    if (inward < 0) { s.vx -= normal.x * inward; s.vz -= normal.y * inward; s.speed *= .94; }
  }
  s.x = clamp(s.x, worldBounds.minX, worldBounds.maxX); s.z = clamp(s.z, worldBounds.minZ, worldBounds.maxZ);
}
function updateShips(dt) {
  for (const s of ships) {
    if (s.destroyed) continue;
    for (const key of ['port','starboard']) { const gun = s.guns[key]; if (gun.left > 0) { gun.left = Math.max(0, gun.left - dt); if (!gun.left && s === player) playSound('cannon.ready', .55, s); } }
    s.cooldown = Math.min(s.guns.port.left, s.guns.starboard.left); s.cooldownTotal = Math.max(s.guns.port.total, s.guns.starboard.total);
    if (s.dead) {
      s.dead=Math.max(0,s.dead-dt);
      const sinkAge=Math.min(7,(s.respawnDelay??7)-s.dead);
      s.object.position.y=-Math.min(9,sinkAge*1.6);s.object.rotation.z=sinkAge*.09;
      s.wake.update(s, dt, time, weather.storm);
      if (!s.dead) { const home=spawn(s.team,s===player||s===enemy?0:1);Object.assign(s,{x:home.x,z:home.z,heading:home.heading,vx:0,vz:0,speed:0,yawRate:0,hp:s.maxHp,rig:s.maxRig,crew:Math.min(8,s.maxCrew),cooldown:2,moored:s===player});resetGuns(s,2);reconcileRoles(s);s.object.rotation.z=0;s.wake.clear(); }
      continue;
    }
    let controls = { turn: 0, throttle: 0 };
    if (s === player) {
      const left = keys.has('KeyA') || keys.has('ArrowLeft'), right = keys.has('KeyD') || keys.has('ArrowRight'), forward = keys.has('KeyW') || keys.has('ArrowUp'), back = keys.has('KeyS') || keys.has('ArrowDown');
      if (left || right || forward || back) {s.target = null;s.moored=false;}
      if (boarding || grapple.active) controls.stop = true;
      else if (s.target) { controls = autopilot(s, s.target, islands); if (controls.arrived) {s.target = null;s.moored=true;} }
      else controls = { stop:!!s.moored,turn: Number(left) - Number(right), throttle: Number(forward) - Number(back) };
    } else if (s.support) controls = campaign.supportOrders(s,dt);
    else if (boarding?.target === s || grapple.active&&grapple.target===s&&grapple.phase!=='flying') controls.stop = true;
    else {controls=campaign.enemyOrders(s,dt)??{stop:true,turn:0,throttle:0};const rival=nearestEnemy(s,36);if(rival&&s.aiRole!=='merchant'&&s.cooldown<=0)fire(s,rival);}
    const cruising = s.maxSpeed; if(s.slow>0)s.maxSpeed*=s.slowFactor??.7; if(s.rig!=null)s.maxSpeed*=rigSpeedFactor(s.rig,s.maxRig);
    if(s===player){const wasBoosting=voyage.boosting;const modifiers=stepVoyage(voyage,{boost:sprintHeld||keys.has('ShiftLeft')||keys.has('ShiftRight'),canSail:!controls.stop&&controls.throttle>=0},dt);s.maxSpeed*=modifiers.speed;controls.acceleration=modifiers.acceleration;controls.handling=modifiers.handling;if(voyage.boosting)controls.throttle=1;if(voyage.boosting&&!wasBoosting)playSound('boost.start',1,player);}
    navigate(s, controls, dt); s.maxSpeed=cruising; collideCoasts(s);
    s.object.position.set(s.x, Math.sin(time * 1.6 + ships.indexOf(s)) * .065 + weather.wave(s.x, s.z, time), s.z); s.object.rotation.y = s.heading;
    const data = s.object.userData, speed = Math.hypot(s.vx, s.vz), power = Math.min(1, speed / 8), boostPower=s===player?voyage.boostIntensity:0;
    if(s===player){renderer.domElement.dataset.sailingSpeed=speed.toFixed(2);renderer.domElement.dataset.boosting=String(voyage.boosting);renderer.domElement.dataset.boostStamina=voyage.stamina.toFixed(1);}
    s.recoil = damp(s.recoil, 0, 7, dt);
    const slopeX=(weather.wave(s.x+2,s.z,time)-weather.wave(s.x-2,s.z,time))/4,slopeZ=(weather.wave(s.x,s.z+3,time)-weather.wave(s.x,s.z-3,time))/6;
    data.body.rotation.z = damp(data.body.rotation.z, clamp(slopeX*Math.cos(s.heading)-slopeZ*Math.sin(s.heading),-.23,.23)+Math.sin(time * 1.25 + ships.indexOf(s)) * .014 - s.yawRate * power * .065 + s.recoil, 5, dt);
    data.body.rotation.x = damp(data.body.rotation.x, clamp(slopeZ*Math.cos(s.heading)+slopeX*Math.sin(s.heading),-.18,.18)+Math.cos(time * 1.7) * (.009 + power * .007)-boostPower*.035, 4, dt);
    animateShipLanterns(s,time,weather.mode==='night');data.oars?.forEach((o,n)=>o.rotation.z=Math.sin(time*3+n%2*Math.PI)*power*.18);
    data.crew.forEach((p, i) => { if (!p.visible) return; if(p.userData.lookout){p.rotation.y=.6+Math.sin(time*.4)*.85;p.userData.head.rotation.y=Math.sin(time*.7)*.12;return;} p.userData.deckOrigin ??= p.position.clone(); const origin = p.userData.deckOrigin, gait = Math.sin(time * .65 + i); p.position.z = origin.z + gait * .14; p.position.y = origin.y + Math.abs(Math.sin(time * 5 + i)) * .025; p.rotation.y = Math.sin(time * .3 + i) > 0 ? 0 : Math.PI; animatePirate(p, time + i, s.cooldown > s.cooldownTotal - .7 ? .8 : .2 + power * .15); });
    data.sails.forEach((rig, i) => { if(!rig.userData.fixedRig){const trim=clamp(angleDelta(s.heading,-.55)*.3,-.48,.48);rig.rotation.y = damp(rig.rotation.y, trim + Math.sin(time * .7 + i) * .035, 2.4, dt);} rig.userData.wind.time.value = time; rig.userData.wind.power.value = power+boostPower*.45; if(s.rig!=null)rig.scale.y=.3+.7*Math.min(1,s.rig/Math.max(1,s.maxRig)); });
    data.flags.forEach((flag, index) => { const p = flag.geometry.attributes.position; for (let j = 0; j < p.count; j++) { const x = p.getX(j); p.setZ(j, Math.sin(x * 3 - time * (3.4 + power + boostPower * 1.5) + index) * (.1 + power * .07 + boostPower * .04) * (x + 1)); } p.needsUpdate = true; });
    data.cannons.forEach(c => { c.userData.recoil = damp(c.userData.recoil, 0, 10, dt); c.position.x = c.userData.baseX - c.userData.side * c.userData.recoil; });
    s.wake.update(s, dt, time, weather.storm); s.bowTimer += dt;
    if (speed > .5 && s.bowTimer > .045-boostPower*.018) {
      s.bowTimer = 0; const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
      for (const side of [-1, 1]) { const p = { x: s.x - sin * 5.8 * s.scale + cos * side * .7, y: s.object.position.y+.08, z: s.z - cos * 5.8 * s.scale - sin * side * .7 };
        fx.emit('foam', p, { x: cos * side * (1.2 + power) + sin * speed * .16, y: .1 + power * .5 + boostPower*.8, z: -sin * side * (1.2 + power) + cos * speed * .16 }, .15 + power * .15 + boostPower*.12, .55 + power * .6);
        if(boostPower>.15)fx.emit('foam',{x:s.x+sin*6*s.scale+cos*side*.6,y:s.object.position.y+.1,z:s.z+cos*6*s.scale-sin*side*.6},{x:sin*1.8+cos*side*.8,y:.2+boostPower*.45,z:cos*1.8-sin*side*.8},.3+boostPower*.15,.65);
      }
    }
    s.smokeTimer += dt; if (s.hp < s.maxHp * .35 && s.smokeTimer > .35) { s.smokeTimer = 0; fx.emit('smoke', { x: s.x, y: 2.5, z: s.z }, { x: .1, y: .8, z: .2 }, .8, 2.5); }
  }
  // Soft hull separation prevents stacking; tangential motion is preserved.
  for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
    const a = ships[i], b = ships[j]; if (a.dead || b.dead) continue;
    const d = distance(a, b), minimum = (a.scale + b.scale) * 2.2;
    if (d > .001 && d < minimum) { tryRam(a, b) || tryRam(b, a); const amount = (minimum - d) * .5, nx = (a.x - b.x) / d, nz = (a.z - b.z) / d; a.x += nx * amount; a.z += nz * amount; b.x -= nx * amount; b.z -= nz * amount; }
  }
}
/** A boosted bow meeting a hull is the oldest weapon on the sea. */
function tryRam(attacker, target) {
  if (attacker !== player || !voyage.boosting) return false;
  const impulse = ramImpulse(combat, attacker, target, Math.hypot(attacker.vx, attacker.vz), Math.random);
  if (!impulse) return false;
  const point = new THREE.Vector3((attacker.x + target.x) / 2, 1.4, (attacker.z + target.z) / 2);
  fx.impact(point, true);
  for (let n = 0; n < 30; n++) fx.emit('wood', point, { x: (Math.random() - .5) * 10, y: 1 + Math.random() * 6, z: (Math.random() - .5) * 10 }, .2 + Math.random() * .18, .6 + Math.random() * .5);
  for (let n = 0; n < 14; n++) fx.emit('foam', { x: point.x, y: .1, z: point.z }, { x: (Math.random() - .5) * 8, y: .6 + Math.random(), z: (Math.random() - .5) * 8 }, .5, .9);
  attacker.speed = Math.max(0, attacker.speed * (1 - impulse.speedLoss));
  damage(attacker, impulse.selfDamage, point, target);
  damage(target, impulse.damage, point, attacker, { crit: true });
  playSound('ship.ram', 1, point); shakeImpulse(feel.traumaRam);
  juice.banner('¡EMBESTIDA!', `${target.name.toUpperCase()} · CASCO ABOLLADO`, 'ram');
  qaStats.rams++;
  director.log(`Espolón contra ${target.name}. Açaí el bote.`);
  return true;
}
function updateCombat(dt) {
  fireBuffer = Math.max(0, fireBuffer - dt);
  if (!player.dead && (keys.has('Space') || buttonHeld || fireBuffer || rightHeld)) fire(player, null, rightHeld ? aim : null);
  for (let i = salvoQueue.length - 1; i >= 0; i--) { const q = salvoQueue[i]; q.delay -= dt; if (q.delay <= 0) { launch(q); salvoQueue.splice(i, 1); } }
  for (let i = shots.length - 1; i >= 0; i--) {
    const sh = shots[i]; sh.previous.copy(sh.ball.position); sh.age += dt;
    const t = Math.min(1, sh.age / sh.duration); sh.ball.position.lerpVectors(sh.from, sh.to, t); sh.ball.position.y += Math.sin(t * Math.PI) * (sh.arc??1.4);
    let hit = null, first = Infinity;
    for (const s of [...ships, ...bestiary.entries, ...campaign.towers]) { if (s.dead || s.team === sh.source.team) continue; const collision = hullIntersection(sh.previous, sh.ball.position, s); if (collision !== null && collision < first) { first = collision; hit = s; } }
    const land = sh.ball.position.y < .45 && islands.some(island => Math.hypot((sh.ball.position.x - island.x) / island.r, (sh.ball.position.z - island.z) / (island.r * .72)) < .94);
    // Each shot turns at its own rate, and chain shot tumbles end over end with
    // its links lagging behind the bar. Left rolling flat, two linked balls read
    // as a dumbbell painted on the water rather than as iron swinging through air.
    sh.ball.rotation.z += dt * BALL_SPIN[sh.kind];
    if (sh.kind === 1) { sh.ball.rotation.x += dt * 9; for (const link of sh.ball.userData.links) link.rotation.x -= dt * 9; }
    // Iron and chain used to trail grey smoke and the firepot and the bomb both
    // trailed fire, so a mixed salvo showed two effects for four guns. The bomb
    // drags soot: it is a shell going up, not a pot already alight.
    sh.trail += sh.ball.position.distanceTo(sh.previous); while (sh.trail >= WAKE_GAP[sh.kind]) { sh.trail -= WAKE_GAP[sh.kind];
      // Each puff is nudged off the flight line. Dropped at a fixed interval they
      // land in an evenly spaced row of dots, which reads as a dotted line no
      // matter how well the spacing is tuned; scatter has to be measured against
      // the gap for it to break that row, so it is scaled by the gap and not by
      // the puff.
      const spread = WAKE_GAP[sh.kind] * .7;
      fx.emit(WAKE_PUFF[sh.kind], wakePoint.set(sh.ball.position.x + (Math.random() - .5) * spread, sh.ball.position.y + (Math.random() - .5) * spread, sh.ball.position.z + (Math.random() - .5) * spread), { x: (Math.random() - .5) * spread, y: .15 + Math.random() * .2, z: (Math.random() - .5) * spread }, WAKE_SIZE[sh.kind], WAKE_LIFE[sh.kind]);
    }
    shotFx.advance(sh.streak, sh.ball.position);
    // Telegraph: a hostile ball already in the air warns on its own bearing.
    if (!sh.warned && sh.source.team !== player.team && t > .15) { sh.warned = true; juice.threat(bearingAngle(sh.ball.position.x, sh.ball.position.z, player)); }
    if (hit || land || t === 1) {
      const pos = hit ? sh.previous.clone().lerp(sh.ball.position, first) : sh.ball.position.clone(); if (!hit && !land) pos.y = .02;
      fx.impact(pos, !!hit || land);
      if (hit) {
        const crit = sh.source === player && rollCritical(Math.random, sh.kind);
        damage(hit, sh.damage, pos, sh.source, { crit, kind: sh.kind });
        applyAmmoEffect(hit,sh.kind,sh.source===player?campaign.weaponLevels[sh.kind]:0,sh.source);
        if (sh.source === player) { qaStats.hits++; qaStats.hitsByKind[sh.kind]++; qaStats.damageByKind[sh.kind] += sh.damage; }
      }
      if(sh.kind===3){fx.impact(pos,true);for(const victim of [...ships,...bestiary.entries,...campaign.towers]){if(victim===hit||victim.dead||victim.team===sh.source.team)continue;const d=Math.hypot(victim.x-pos.x,victim.z-pos.z);if(d<5.5)damage(victim,sh.damage*.7*(1-d/5.5),pos,sh.source);}}
      playSound(hit?(hit.isTower?'impact.stone':hit.isCreature?'impact.water':'impact.wood'):land?'impact.stone':'impact.water',sh.source===player?.9:.5,pos);
      sh.ball.visible = false; shotFx.release(sh.streak); shots.splice(i, 1);
    }
  }
}
function updateLoot(dt) {
  if (lootProgress) {
    if(!lootProgress.island.available){stopLoot();toast('Ese cofre ya salió con otra tripulación.');return;}
    if(distance(player,lootProgress.island)>lootProgress.island.r+32){stopLoot();toast('Bote de vuelta. Nos alejamos demasiado de la costa.');return;}
    const l = lootProgress; l.progress += dt / lootDuration(player.roles.looters);l.age+=dt;const dock=new THREE.Vector3(l.island.x+l.island.r*.35,1,l.island.z+l.island.r*.65+2);
    if(Math.floor(l.age*3)!==l.audioStep){l.audioStep=Math.floor(l.age*3);if(l.progress>.22&&l.progress<.84)playSound('crew.step',.55,l.island);}
    const progress=Math.min(1,l.progress),outbound=Math.min(1,progress/.22),homeward=Math.max(0,(progress-.84)/.16),shipPoint=new THREE.Vector3(player.x,.3,player.z);
    lootBoat.position.lerpVectors(shipPoint,dock.clone().setY(.3),outbound*(1-homeward));lootBoat.rotation.y=Math.atan2(player.x-dock.x,player.z-dock.z)+(homeward>0?Math.PI:0);
    raiders.forEach((r, i) => {
      if(progress<.22||progress>.84){r.object.position.copy(lootBoat.position);r.object.position.x+=(i%2?-.4:.4);r.object.position.z+=Math.floor(i/2)*.8-.8;r.object.position.y=.9;}
      else if(progress<.42)r.object.position.lerpVectors(dock,r.to,(progress-.22)/.2);
      else if(progress>.68)r.object.position.lerpVectors(r.to,dock,(progress-.68)/.16);
      else r.object.position.copy(r.to);
      if(!r.carry){r.carry=chest(r.object,0,.65,.34,.23);r.carry.visible=false;}
      r.carry.visible=progress>.59;r.object.rotation.y=Math.atan2(r.to.x-dock.x,r.to.z-dock.z)+(progress>.68?Math.PI:0);r.object.position.y+=Math.abs(Math.sin(time*8+i))*.055;
      animatePirate(r.object,time+i,progress>.42&&progress<.68?.25:.8);
    });
    if (l.progress >= 1) { player.gold += l.island.gold; l.island.available = false; l.island.treasure.visible = false; l.island.readyAt = time + balance.lootRespawn; floatText(`+${l.island.gold} oro`, player.object.position.clone().setY(10), 'gold'); toast(`+${l.island.gold} oro a bordo. Regresa al puerto para asegurarlo.`); playSound('loot.chest'); stopLoot(); }
  }
  for (const i of islands) if (!i.available && time > i.readyAt) { i.available = true; i.treasure.visible = true; }
  const hookEvent=grapple.update(dt);
  if(grapple.phase==='reeling')playSound('hook.reel',.8,player);
  if(hookEvent?.event==='ready'){boarding={target:hookEvent.target,progress:0};for(let n=0;n<Math.min(4,player.crew);n++)boardingFighters.push(pirate(scene,player.x,player.object.position.y+2,player.z,palette.blue));playSound('boarding.clash',.8,hookEvent.target);}
  if(hookEvent?.event==='released'){stopBoarding(hookEvent.reason);if(hookEvent.reason!=='target-lost')toast('El cabo se soltó. Busca otro ángulo.');}
  if(!boarding&&boardingFighters.length)boardingFighters.splice(0).forEach(p=>p.removeFromParent());
  if (boarding) {
    const b = boarding; b.progress += dt;
    if(Math.floor(b.progress*2)!==b.audioBeat){b.audioBeat=Math.floor(b.progress*2);playSound(b.progress<1.7?'crew.step':'boarding.clash',.65,b.target);}
    const a=player.object.position.clone();a.y+=2.5*player.scale;const c=b.target.object.position.clone();c.y+=2.5*b.target.scale;
    boardingFighters.forEach((p,n)=>{const cross=Math.min(1,Math.max(0,(b.progress-n*.18)/1.7));p.position.lerpVectors(a,c,cross);p.position.y+=Math.sin(cross*Math.PI)*1.1;p.position.x+=n%2?.65:-.65;p.position.z+=Math.floor(n/2)*.8-.4;p.rotation.y=Math.atan2(a.x-c.x,a.z-c.z);animatePirate(p,time+n,cross<1?.85:1.3);});
    if (b.target.dead || distance(player, b.target) > 22) { stopBoarding('target-lost'); toast('El garfio se ha soltado.'); }
    else if (b.progress > 4) { const stolen = boardingLoot(b.target.gold),exchange=boardingExchange(player,b.target); b.target.gold -= stolen; player.gold += stolen; damage(b.target, exchange.outgoing, c,player); damage(player, exchange.retaliation, a,b.target); stopBoarding('complete'); playSound('loot.chest'); toast(`Abordaje terminado. ${stolen} oro recuperado.`); }
  }
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.g.position.y = .3 + Math.sin(time * 2) * .12; d.g.rotation.y += dt * .2; if (!player.dead && distance(player, d.g.position) < 6) { player.gold += d.gold; floatText(`+${d.gold} oro`, d.g.position.clone().setY(5), 'gold'); scene.remove(d.g); drops.splice(i, 1); playSound('loot.chest'); } }
  if (!player.dead && inPort()) { if (player.gold) { const amount = player.gold; bank += amount; blueScore += amount; player.gold = 0; toast(`${amount} oro a salvo. ¡La ronda corre por su cuenta!`); playSound('loot.deposit'); } player.hp = Math.min(player.maxHp, player.hp + dt * 6); }
}

const map = $('minimap').getContext('2d');
function minimap() {
  drawNauticalMap(map, { bounds:worldBounds, islands, ships, creatures:bestiary.entries, player, sources:campaign.fog.sources,time });
}
let lastCrew = -1;
function updateHUD() {
  $('cargo').textContent = player.gold; $('bank').textContent = bank;
  for(const team of ['blue','red']){const home=getHomeBase(islands,team),state=home.owner!==team?'CAÍDA':home.invasion?'DISPUTADA':'A SALVO';$(''+team+'-score').textContent=state;$(''+team+'-score').closest('.team').classList.toggle('contested',!!home.invasion);$(''+team+'-score').title=`${home.name}: ${state.toLowerCase()}`;}
  $('health-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`; $('health-bar').style.width = `${player.hp / player.maxHp * 100}%`;
  $('health-bar').classList.toggle('critical', player.hp < player.maxHp * .3); $('crew').textContent = player.crew; $('max-crew').textContent = player.maxCrew;
  $('ship-level').textContent = `RANGO ${rank} · ${xp}/${rank*80} EXP · ${Math.hypot(player.vx, player.vz).toFixed(1)} NUDOS${combat.combo >= 2 ? ` · RACHA ×${combat.combo}` : ''}`;
  $('greek-status').textContent = greekActive > 0 ? '¡No mires atrás!' : greekCooldown > 0 ? `Recarga ${Math.ceil(greekCooldown)} s` : 'Fuego griego';
  $('greek-fire').disabled = greekCooldown > 0 || !!player.dead || paused; $('greek-fire').classList.toggle('active', greekActive > 0);
  const boss = selectedEnemy?.isCreature && !selectedEnemy.dead ? selectedEnemy : null; $('creature-bar').style.display = boss ? 'block' : 'none'; if(boss){$('creature-name').textContent=boss.name;$('creature-subtitle').textContent=`${boss.xp} EXP · ${boss.epithet}`;$('creature-health').style.width=`${boss.hp/boss.maxHp*100}%`;}
  if (lastCrew !== player.crew) { $('crew-dots').innerHTML = '<i></i>'.repeat(Math.min(player.crew, 24)); lastCrew = player.crew; }
  const cooldown = player.cooldown > 0;
  $('reload').textContent = cooldown ? `Recarga ${player.cooldown.toFixed(1)} s` : 'Mantén para disparar';
  $('fire').style.setProperty('--reload', `${(1 - player.cooldown / player.cooldownTotal) * 100}%`);
  $('fire').classList.toggle('reloading', cooldown); $('fire').disabled = !!player.dead || paused || !!boarding || gameOver;
  $('loot-hint').textContent = lootProgress ? `Saqueando ${Math.floor(lootProgress.progress * 100)}%` : nearIsland() ? (nearIsland().owner==='blue'?'Roba su botín':'Toma la isla') : 'Busca una isla';
  $('loot').disabled=!!player.dead||!!lootProgress||grapple.active||paused;$('board').disabled=!!player.dead||!!lootProgress||paused;
  renderer.domElement.dataset.grapplePhase=grapple.phase;renderer.domElement.dataset.grappleRange=grapple.active?distance(player,grapple.target).toFixed(1):'';
  $('board').classList.toggle('active',grapple.active);$('board').querySelector('strong').textContent=grapple.active?'Soltar':'Abordar';
  document.body.classList.toggle('has-guard',campaign.living('guard').length>0);document.body.classList.toggle('has-island',nearIsland()?.owner==='blue');
  $('board').querySelector('small').textContent=boarding?`Abordando ${Math.floor(boarding.progress/4*100)}%`:grapple.phase==='flying'?'Garfio en vuelo':grapple.active?'Atrayendo al rival':nearestEnemy(player,grapple.range)?'Rival al alcance':'Garfio · 32 m';
  $('port-distance').textContent = inPort() ? 'Amarrado · reparando' : `${Math.round(distance(player, port))} m`;
  $('port-status').classList.toggle('in-port', inPort());
  for (const s of ships) {
    const data = s.object.userData; data.crew.forEach((p, i) => {p.visible = i < s.crew-(s===player?(lootProgress?raiders.length:boardingFighters.length):0);if(p.userData.repairGear)p.userData.repairGear.visible=s===player&&i<player.roles.repairers;if(p.userData.lootGear)p.userData.lootGear.visible=s===player&&i>=player.roles.repairers&&i<player.roles.repairers+player.roles.looters;}); data.cargo.visible = s.gold > 0;
    data.cargo.children.forEach((c, i) => c.visible = i < Math.ceil(s.gold / 35));
    if (s.label) { s.label.innerHTML = `${s.name.toUpperCase()}<small>◈ ${s.gold} ORO · ${Math.ceil(s.hp / s.maxHp * 100)}% CASCO</small>${s.burning>0?`<span class="burn-timer">ARDE · ${Math.ceil(s.burning)} s</span>`:''}<span class="enemy-health"><i style="width:${s.hp / s.maxHp * 100}%"></i></span>`; s.label.classList.toggle('selected', s === selectedEnemy);s.label.classList.toggle('burning',s.burning>0); }
  }
  const seconds=Math.floor(elapsed);$('timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  updateNauticalHUD({player,rank,xp,greekCooldown,greekTotal:26-campaign.greekLevel*2,greekActive,grapple,boarding,invasion:islands.find(i=>i.invasion?.source===player)?.invasion,lootProgress,paused,gameOver,voyage,weaponIndex,guns:player.guns,firefight:firefightCooldown});
  if ($('upgrade-dialog').open) updateUpgrades(); minimap();
  // DOM diagnostics allow performance QA without altering live game state.
  renderer.domElement.dataset.fps = fps.toFixed(1); renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls); renderer.domElement.dataset.particles = String(fx.alive);
  renderer.domElement.dataset.combo = String(combat.combo); renderer.domElement.dataset.trauma = combat.trauma.toFixed(3);
  renderer.domElement.dataset.hitStop = combat.hitStop.toFixed(3); renderer.domElement.dataset.ramReady = String(combat.ramCooldown <= 0);
  renderer.domElement.dataset.lowHull = lowHullLevel(player.hp, player.maxHp).toFixed(2);
}
const threatList = [];
/** Screen-space reading of the fight: bearings, target lock, hull panic. */
function updateCombatFeel(dt) {
  const lowHull = player.dead ? 0 : lowHullLevel(player.hp, player.maxHp);
  if (lowHull > 0) {
    combat.lowHullSince += dt;
    if (combat.lowHullSince >= feel.heartbeatGap / (1 + lowHull * 1.7)) { combat.lowHullSince = 0; playSound('combat.heartbeat', .45 + lowHull * .55, player); }
  }
  threatList.length = 0;
  if (!player.dead) for (const s of [...ships, ...bestiary.entries]) {
    if (s.dead || s.destroyed || !s.object.visible || s.team === player.team) continue;
    const gap = distance(player, s);
    if (gap < 12) continue;
    const screen = projectToScreen(s);
    if (gap <= feel.threatRange && screen?.inside) continue;
    threatList.push({ angle: bearingAngle(s.x, s.z, player), kind: s.isCreature ? 'creature' : 'enemy', name: s.name, gap });
  }
  threatList.sort((a, b) => a.gap - b.gap);
  juice.arrows(threatList);
  const mark = selectedEnemy && !selectedEnemy.dead && selectedEnemy.object.visible && !player.dead ? selectedEnemy : null;
  const screen = mark ? projectToScreen(mark, 3.6 * (mark.scale ?? 1)) : null;
  juice.target(screen ? { x: screen.x, y: screen.y, name: mark.name, hp: mark.hp, maxHp: mark.maxHp, burning: mark.burning > 0 } : null);
  stepHullFlash();
  juice.frame(dt, { combo: combat.combo, lowHull });
}
function updateCamera(dt) {
  const nextZoom = damp(zoom, requestedZoom, 7, dt); if (Math.abs(nextZoom - zoom) > .005) { zoom = nextZoom; resize(); }
  const boostView=showcase===null&&!locked()?voyage.boostIntensity:0;
  const cameraZoom=1-boostView*.065;
  if(Math.abs(camera.zoom-cameraZoom)>.0001){camera.zoom=cameraZoom;camera.updateProjectionMatrix();}
  const target = qaEnabled&&qaFleetReview ? new THREE.Vector3(0,0,61) : showcase !== null ? new THREE.Vector3(islands[showcase].x,0,islands[showcase].z) : new THREE.Vector3(player.x + 2.88 + player.vx * (.8+boostView*.2), 0, player.z - 11.16 + player.vz * (.7+boostView*.2));
  cameraTarget.lerp(target, 1 - Math.exp(-dt * 1.7)); camera.position.copy(cameraTarget).add(cameraOffset);
  const impulse = !locked() && combat.trauma > .004 ? cameraTrauma(combat, time) : null;
  if (impulse) { camera.position.x += impulse.x; camera.position.y += impulse.y; }
  camera.lookAt(cameraTarget);
  if (impulse?.roll) camera.rotateZ(impulse.roll);
  camera.updateMatrixWorld();ocean.water.position.x=cameraTarget.x;ocean.water.position.z=cameraTarget.z;
  sun.target.position.copy(cameraTarget); sun.position.copy(cameraTarget).add(new THREE.Vector3(-35, 70, 45));
  if (aimScreen.valid && rightHeld) { pointer.set(aimScreen.x / innerWidth * 2 - 1, 1 - aimScreen.y / innerHeight * 2); raycaster.setFromCamera(pointer, camera); raycaster.ray.intersectPlane(plane, aim); }
  shotRing.visible = !player.dead && (!!selectedEnemy && !selectedEnemy.dead || rightHeld);
  if (shotRing.visible) { const target = rightHeld ? aim : selectedEnemy; shotRing.position.set(target.x, .015, target.z); shotRing.scale.setScalar(rightHeld ? .45 : selectedEnemy.scale); shotRing.material.color.set(rightHeld ? 0xf2c66f : 0xef8e70); }
}
function updateLabels(dt) {
  const reserved=[...document.querySelectorAll('.topbar,.ship-card,.action-bar,.map-panel,.captain-tools,#sailing-tools,#crew-dialogue.show,#weapon,#invasion-alert.show')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());
  const candidates=[];
  for(const l of labels){
    l.el.style.display='none';if(!l.object.visible||l.object.position.y< -2)continue;
    const range=Math.hypot(l.object.position.x-player.x,l.object.position.z-player.z),isIsland=l.el.classList.contains('island'),selected=selectedEnemy?.object===l.object;
    // A locked enemy is read through the lock frame, which draws its own name and
    // health bar. Leaving the world label up as well stacks two of each on top of
    // the same hull, so the label stands down until the target is released.
    if(selected)continue;
    if(range>(isIsland?70:52))continue;
    temp.copy(l.object.position);temp.y+=l.offset;temp.project(camera);if(temp.z>1||Math.abs(temp.x)>1||Math.abs(temp.y)>1)continue;
    l.el.style.display='';candidates.push({label:l,x:(temp.x*.5+.5)*innerWidth,y:(-temp.y*.5+.5)*innerHeight,width:l.el.offsetWidth,height:l.el.offsetHeight,priority:selected?4:l.object===player.object?3:isIsland?2:1,distance:range});l.el.style.display='none';
  }
  for(const p of arrangeWorldLabels(candidates,reserved,{width:innerWidth,height:innerHeight,top:innerWidth<960?165:115,bottom:innerWidth<620?325:170})){p.label.el.style.display='';p.label.el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;}
  for (let i = floating.length - 1; i >= 0; i--) { const f = floating[i]; f.age += dt; temp.copy(f.position); temp.y += f.age * 2.2; temp.project(camera); f.el.style.transform = `translate(${(temp.x * .5 + .5) * innerWidth}px,${(-temp.y * .5 + .5) * innerHeight}px)`; f.el.style.opacity = String(Math.min(1, (1.15 - f.age) * 3)); if (f.age > 1.15) { f.el.remove(); floating.splice(i, 1); } }
}
function updateGreekFire(dt) {
  greekCooldown=Math.max(0,greekCooldown-dt);greekActive=Math.max(0,greekActive-dt);
  const contacts=greekSea.update(dt,{source:player,emitting:greekActive>0&&!player.dead,level:campaign.greekLevel,targets:ships,time,render:false});
  for(const contact of contacts){
    Object.assign(contact.target,contact.burn);
    if(contact.newIgnition){
      const s=contact.target;playSound('fire.ignite',.7,s);director.log(`${s.name} arde. El fuego seguirá dañando su casco al salir de la marea.`, 'victory');
      for(let n=0;n<4;n++)fx.emit('fire',{x:s.x+(n%2?1:-1)*s.scale,y:s.object.position.y+2*s.scale,z:s.z+(n<2?-1:1)*s.scale},{x:0,y:2,z:0},.35,.7);
    }
  }
  const burning=ships.filter(s=>s.burning>0&&!s.dead);
  renderer.domElement.dataset.firePools=String(greekSea.patches.length);
  renderer.domElement.dataset.burningShips=String(burning.length);
  renderer.domElement.dataset.fireContactShips=String(contacts.length);
  renderer.domElement.dataset.burningTargetHp=burning.map(s=>`${s.name}:${s.hp.toFixed(1)}`).join(',');
  renderer.domElement.dataset.burningSeconds=burning.map(s=>s.burning.toFixed(1)).join(',');
}
function towerShot(tower,target,amount) {
  const ball=ballPool.find(b=>!b.visible);if(!ball)return;
  const from=new THREE.Vector3(tower.x,4.3,tower.z),to=new THREE.Vector3(target.x,-.12,target.z);
  ball.position.copy(from);ball.material=(tower.team===player.team?projectileMaterials:hostileProjectileMaterials)[0];ball.scale.setScalar(1);ball.visible=true;
  shots.push({ball,from,to,previous:from.clone(),age:0,trail:0,duration:from.distanceTo(to)/30,source:tower,damage:amount,kind:0});fx.muzzle(from,to.clone().sub(from).normalize());playSound('cannon.iron',.65,from);
}
function updateStatuses(dt) {
  for(const s of [...ships,...bestiary.entries,...campaign.towers]){
    s.slow=Math.max(0,(s.slow??0)-dt);
    if(s.dead){s.burning=0;continue;}
    if(s.burning>0){s.burning-=dt;s.burnTick=(s.burnTick??0)+dt;
      if(s===player&&!s.fireHint){s.fireHint=true;toast('¡Fuego a bordo! Pulsa V para sofocarlo.');}
      if(s.burnTick>.16){fx.emit('fire',{x:s.x+(Math.random()-.5)*2,y:2,z:s.z+(Math.random()-.5)*2},{x:0,y:1,z:0},.3,.7);}
      if(s.burnTick>=1){s.burnTick-=1;if(s.rig!=null)s.rig=Math.max(0,s.rig-rigRules.burnRigPerSecond);damage(s,s.burnDamage??2,s.object.position.clone().setY(2),s.burnSource??player);}
    }else{s.burnTick=0;s.fireHint=false;}
  }
}
const campaign = new Campaign({scene,ocean,islands,port,player,ships,bestiary,fx,makeShip,fire,damage,towerShot,voyage,beginLoot:()=>loot(),refreshHUD:()=>updateHUD(),bounds:worldBounds,toast,director,inPort,locked,clearInput,buyShipUpgrade,
  onPurchase:order=>playSound(['repairer','looter','boarder','gunner','recruit'].includes(order)?'crew.hire':order==='crew-dismiss'?'crew.step':order==='rum'?'crew.rum':order==='scout'||order==='guard'?'loot.deposit':'upgrade.install'),
  onIslandCaptured:(island,team)=>{if(team===player.team||distance(player,island)<80)playSound('island.captured',.8,island);},
  getBank:()=>bank,charge:amount=>{if(amount<0||bank<amount)return false;bank-=amount;return true;},credit:amount=>{bank+=amount;blueScore+=amount;playSound('loot.deposit',.55,port);},creditEnemy:amount=>redScore+=amount,
  getTeamBank:team=>team==='blue'?campaign.aiBanks.blue:enemyBank,
  chargeTeam:(team,amount)=>{const wallet=team==='blue'?campaign.aiBanks.blue:enemyBank;if(!Number.isFinite(amount)||amount<0||wallet<amount)return false;if(team==='blue')campaign.aiBanks.blue-=amount;else enemyBank-=amount;return true;},
  creditTeam:(team,amount,ship)=>{if(!Number.isFinite(amount)||amount<=0)return;if(team==='blue'){campaign.aiBanks.blue+=amount;blueScore+=amount;}else{enemyBank+=amount;redScore+=amount;}if(team===player.team)playSound('loot.deposit',.4,ship??port);},
  onAIUpgrade:ship=>{updateUpgradeModel(ship);renderShipPortrait(player);},
  onBaseCaptured:team=>finishExpedition(team),
});
const territoryArt=new TerritoryArt(islands);
const faunaCombat = new FaunaCombat(scene,bestiary.entries,ships,fx,damage,director,player);
const crewRenderer=new CrewRenderer(scene);crewRenderer.update(0);
const expeditions=new Expeditions({islands,player,director,toast,locked,clearInput,isBusy:()=>!!lootProgress||!!boarding||grapple.active,engage:()=>inputEngaged=true,mapState:()=>({bounds:worldBounds,islands,ships,creatures:bestiary.entries,player,sources:campaign.fog.sources,time})});
for(const target of [...ships.filter(s=>s.team==='red'),...bestiary.entries]){
  if(!target.label)target.label=label(`${target.name.toUpperCase()}<small>${target.xp} EXP · CLIC PARA APUNTAR</small>`,target.object,target.isCreature?7:15,'enemy');
  target.label.setAttribute('role','button');target.label.tabIndex=0;target.label.setAttribute('aria-label',`Apuntar a ${target.name}`);
  const aimTarget=()=>{if(locked()||target.dead)return;selectedEnemy=target;inputEngaged=true;if(distance(player,target)>weapons[weaponIndex].range)toast('Objetivo fijado. Acércate para que la andanada lo alcance.');else fire(player,target);};
  target.label.onclick=aimTarget;target.label.onkeydown=e=>{if(e.code==='Enter'){e.preventDefault();aimTarget();}};
}
for(const island of islands){
  let item=labels.find(l=>l.object===island.group);
  if(!item){const el=label(`${island.name.toUpperCase()}<small>COSTA POR EXPLORAR</small>`,island.group,Math.max(8,island.r*.6),'island');item=labels.find(l=>l.el===el);}
  item.el.tabIndex=0;item.el.setAttribute('role','button');item.el.setAttribute('aria-label',`Poner rumbo a ${island.name}`);item.el.onclick=()=>expeditions.setCourse(island);item.el.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();expeditions.setCourse(island);}};
}
const gallery = document.createElement('div'); gallery.id='island-gallery';
gallery.innerHTML='<span>ÁLBUM DEL CARTÓGRAFO</span><select id="gallery-island" aria-label="Isla del álbum"></select><button id="gallery-close">Volver a navegar · Esc</button>';
document.body.appendChild(gallery);
const galleryChoice = document.createElement('label'); galleryChoice.textContent='Visitar el álbum de islas';
const galleryButton=document.createElement('button');galleryButton.textContent='Abrir álbum';galleryButton.id='gallery-open';galleryChoice.appendChild(galleryButton);$('settings-dialog').appendChild(galleryChoice);
islands.forEach((i,n)=>{const option=document.createElement('option');option.value=n;option.textContent=i.name;$('gallery-island').appendChild(option);});
function selectGallery(index){clearInput();showcase=index;requestedZoom=Math.max(20,Math.min(40,islands[index].r*2.4));document.body.classList.add('showcase');islands.forEach((i,n)=>{i.group.visible=true;ocean.islands.value[n].z=i.r;});$('gallery-island').value=index;}
galleryButton.onclick=()=>{$('settings-dialog').close();selectGallery(islands.indexOf(port));};$('gallery-island').onchange=e=>selectGallery(Number(e.target.value));
const galleryClimate=$('atmosphere').cloneNode(true);galleryClimate.id='gallery-climate';galleryClimate.setAttribute('aria-label','Clima del álbum');gallery.insertBefore(galleryClimate,$('gallery-close'));galleryClimate.onchange=e=>{weather.set(e.target.value);$('atmosphere').value=e.target.value;};
function closeGallery(){showcase=null;requestedZoom=50;document.body.classList.remove('showcase');campaign.updateVision(.4);}
$('gallery-close').onclick=closeGallery;window.addEventListener('keydown',e=>{if(e.code==='Escape'&&showcase!==null)closeGallery();});
cameraTarget.set(player.x+2.88,0,player.z-11.16);
const resultDialog=document.createElement('dialog');resultDialog.id='result-dialog';resultDialog.setAttribute('aria-label','Resultado de la expedición');
resultDialog.innerHTML='<img class="result-host" src="/assets/harbor-art/boatswain-restyled-v2.png" alt="Almirante Roncero"><div class="eyebrow">LA COFRADÍA CIERRA LAS CUENTAS</div><h2 id="result-title"></h2><p id="result-story"></p><div class="result-score"><span>VELAS AZULES<b id="result-blue"></b></span><span>CORSARIOS ROJOS<b id="result-red"></b></span></div><button id="sail-again">Volver a zarpar</button>';
document.body.appendChild(resultDialog);$('sail-again').onclick=()=>location.reload();
function finishExpedition(winner){if(gameOver)return;gameOver=true;clearInput();updateHUD();campaign.updateHUD();playSound(winner==='blue'?'victory':'defeat');const won=winner==='blue';$('result-title').textContent=won?'¡El Diente Roto es nuestro!':winner==='draw'?'Dos banderas. Ningún hogar.':'Ron Ron cayó en malas manos.';$('result-story').textContent=won?'Tu bandera ondea sobre la base corsaria. Presumían de disciplina; dejaron la puerta y los recibos abiertos.':'La base rival no se conquista con excusas. Protege Ron Ron, reúne una tripulación y vuelve a por su bandera.';$('result-blue').textContent=`${blueScore} oro depositado`;$('result-red').textContent=`${redScore} oro depositado`;resultDialog.showModal();}
// QA is deliberately visible and opt-in. Artificial review fixtures never count as a real run.
const qaBench = qaEnabled ? mountQABench({
  campaign,
  getState:()=>({player,islands,ships,bank,time,lootIsland:lootProgress?.island,boarding,grappleActive:grapple.active,gameOver,winner:battleWinner(islands),locked:locked()}),
  setCourse:(point,island)=>{
    if(locked()||player.dead||boarding||grapple.active)return false;
    const invasion=islands.find(i=>i.invasion?.source===player);
    if(invasion&&distance(point,invasion)>invasion.r+32)return false;
    player.target={x:point.x,z:point.z};player.moored=false;inputEngaged=true;
    expeditions.destination=island??null;return true;
  },
  stopCourse:()=>{player.target=null;player.moored=true;},
  loot:()=>loot(),cancelLoot:()=>stopLoot(),fire:target=>fire(player,target),
  startInvasion:island=>campaign.startInvasion(island,player),
  cancelInvasion:island=>campaign.cancelInvasion(island),
  prepareRun:()=>{
    qaFleetReview=false;
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    if(showcase!==null)closeGallery();paused=false;clearInput();
    $('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pausar');
  },
  setSpeed:value=>{if([.25,1,4].includes(value))qaSpeed=value;},
  restore:()=>location.reload(),
  runFixture:id=>{
    qaFleetReview=false;
    clearInput();stopLoot();stopBoarding();player.target=null;player.moored=true;qaSpeed=1;
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    if(showcase!==null)closeGallery();
    const place=(ship,x,z)=>{Object.assign(ship,{x,z,vx:0,vz:0,speed:0,yawRate:0,dead:0,destroyed:false,moored:true,target:null});ship.object.position.set(x,0,z);ship.object.visible=true;ship.wake.clear();};
    const toPort=()=>place(player,blueSpawn.x,blueSpawn.z);
    paused=true;
    if(id==='fleet-purchases'){bank=1000;toPort();campaign.open('fleet');}
    else if(id==='fleet-designs'){
      place(player,0,105);player.heading=Math.PI;player.object.rotation.y=Math.PI;requestedZoom=zoom=24;qaFleetReview=true;resize();
      for(const [key,role,x,level] of [['scout-i','scout',-13,1],['scout-ii','scout',0,2],['guard','guard',13,1]]){
        let ship=ships.find(s=>s.qaFleetKey===key);
        if(!ship){ship=campaign.spawnSupport(role);ship.qaFleetKey=key;}
        place(ship,x,61);ship.heading=-Math.PI*.18;ship.object.rotation.y=ship.heading;applyFleetSails(ship,level);
      }
      cameraTarget.set(0,0,61);weather.set('clear');campaign.updateVision(.4);
      director.queue.pending.length=0;director.hideSpeech();director.queue.current=null;
    }
    else if(id==='funds'){bank=0;toPort();campaign.open('ship');}
    else if(id==='crew-full'){toPort();player.crew=player.maxCrew;campaign.open('crew');}
    else if(id==='max-upgrades'){
      toPort();Object.assign(player.upgrades,{hull:3,cannons:3,crew:3});
      campaign.weaponLevels.fill(3);campaign.greekLevel=3;campaign.scoutLevel=3;
      campaign.open('ship');
    }else if(id==='notices'){
      director.speak('sailor','Capitán, alguien ha puesto agua en el ron. Sospecho del océano.',{priority:0,key:'qa:humor'});
      const island=islands.find(i=>!i.homeTeam);island.discovered=true;island.treasureKnown=true;
      director.reportIsland(island,{name:'Explorador de prueba'},time);
      const base=getHomeBase(islands,'blue');base.tower.dead=1;base.tower.hp=0;base.tower.object.visible=false;
      place(enemy,base.x+base.r*.35,base.z+base.r*.72+8);
      campaign.startInvasion(base,enemy);
      selectedEnemy=bestiary.entries.find(creature=>!creature.dead)??null;
      director.update(player,islands,bestiary.entries,time,{inPort:true});
      campaign.updateHUD();
    }else if(id==='invasion'){
      const base=getHomeBase(islands,'blue');base.tower.dead=1;base.tower.hp=0;base.tower.object.visible=false;
      place(enemy,base.x+base.r*.35,base.z+base.r*.72+8);
      campaign.startInvasion(base,enemy);director.update(player,islands,bestiary.entries,time);campaign.updateHUD();
    }else if(id==='combat-hook'){
      place(player,0,65);place(enemy,0,43);selectedEnemy=enemy;enemy.gold=80;
      paused=false;board();
    }else if(id.startsWith('duel-')){
      // A bare duel: both hulls at full health, no island in between and the
      // fog lifted, so a measurement of the fight is a measurement of the fight
      // and not of how long the approach happened to take.
      // duel-<range>-<bearing>[-w<weapon>]  e.g. duel-40-0-w2 is 40 units out,
      // dead ahead, with the firepot loaded.
      const parts = id.slice(5).split('-');
      const range = Number(parts[0]), bearingDeg = Number(parts[1]);
      const armed = parts[2]?.startsWith('w') ? Number(parts[2].slice(1)) : null;
      // Open water, well clear of every island: (0,0) sits inside La Boca del
      // Abismo, and collideCoasts pins a hull there at one knot.
      const arena = { x: 0, z: 52 };
      player.heading = 0;player.object.rotation.y = 0;
      place(player,arena.x,arena.z);
      const target = { x: arena.x + Math.sin(bearingDeg * Math.PI / 180) * range, z: arena.z - Math.cos(bearingDeg * Math.PI / 180) * range };
      place(enemy,target.x,target.z);
      for (const ship of [player, enemy]) {
        ship.hp = ship.maxHp;ship.crew = ship.maxCrew;ship.dead = 0;ship.destroyed = false;
        ship.moored = false;ship.speed = 0;resetGuns(ship,0);ship.gold = 0;
      }
      player.object.visible = true;enemy.object.visible = true;
      player.object.position.set(arena.x,0,arena.z);
      enemy.object.position.set(target.x,0,target.z);
      enemy.heading = Math.PI;enemy.object.rotation.y = Math.PI;
      // Nothing else may join: no sister ship, no creature, no tower, no
      // respawning rival. Every point of damage below has one owner.
      ally.x = -900;ally.z = 900;ally.object.visible = false;ally.dead = 0;
      scout.x = 900;scout.z = 900;scout.object.visible = false;
      bestiary.entries.forEach(c => { c.dead = 1;c.object.visible = false; });
      campaign.towers.forEach(t => { t.dead = 1;t.object.visible = false; });
      Object.assign(qaStats, { fired: 0, hits: 0, hitsByKind: [0, 0, 0, 0], damageByKind: [0, 0, 0, 0], rams: 0 });
      if (armed !== null) weaponIndex = armed;
      $('weapon-name').textContent = weapons[weaponIndex].name;
      selectedEnemy = enemy;paused = false;cameraTarget.set(arena.x,0,arena.z);qaSpeed = 1;
      updateHUD();
    }else if(id==='greek-fire'){
      place(player,-14,62);place(enemy,-14,72);player.heading=0;player.object.rotation.y=0;
      greekCooldown=0;selectedEnemy=enemy;paused=false;greekFire();
    }else if(id==='fire-trail'){
      place(player,-14,62);place(enemy,110,0);player.heading=Math.PI*.45;player.object.rotation.y=player.heading;
      player.target={x:-70,z:45};selectedEnemy=null;greekCooldown=0;paused=false;greekFire();
      }else if(id.startsWith('portrait-')){
        director.queue.pending.length=0;director.hideSpeech();director.queue.current=null;
        const role=id.slice(9), lines={
          sailor:'Capitán… creo que ya hice mi parte por hoy.',
          harpooner:'Capitán, el Kraken no parece de humor… yo tampoco, pero por razones distintas.',
          boatswain:'¡Rumbo a Ron Ron! El oro está seguro. La reputación ya venía hundida.',
          lookout:'¡Isla a la vista! La marqué en la carta. El tesoro no va a robarse solo.',
          carpenter:'El casco tiene más agujeros que nuestras cuentas. Un puerto. Pronto.',
        };
        director.speak(role,lines[role],{priority:3});
      }else if(id==='victory'||id==='defeat'){
      gameOver=false;finishExpedition(id==='victory'?'blue':'red');
    }else throw new Error(`Fixture desconocido: ${id}`);
    updateHUD();
  },
}) : null;
if(qaEnabled){$('pause').textContent='▷';$('pause').setAttribute('aria-label','Continuar');}
let last = performance.now(), previewTime = 0, frozenRenderAt = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const frameStarted=performance.now(),wallDt=(now-last)/1000,realDt=Math.min(wallDt,.25); last = now; frame++;
  syncAudioState();director.setReadingPaused(locked() || document.hidden);if(document.hidden)return;
  // Hit-stop dilates real time, so it is stepped and read outside the scaled dt.
  stepFeel(combat, realDt, time);
  const baseDt = locked() ? 0 : qaEnabled ? qaSimulationDelta(wallDt,qaSpeed) : realDt;
  const dt = baseDt * timeScale(combat);
  if(!dt&&showcase===null&&now-frozenRenderAt<150)return;
  if(!dt)frozenRenderAt=now;
  if (dt) {
    // Substeps preserve steering and collision stability during an occasional slow frame.
    const steps = Math.ceil(dt / (1 / 60)), step = dt / steps;
    for (let n = 0; n < steps; n++) {
      if(locked())break;
        time += step; elapsed += step;fx.advanceClock(step);qaBench?.update(step);updateShips(step);updateCombat(step);updateLoot(step);
      bestiary.update(time,step,fx);campaign.update(step,time);faunaCombat.update(step,time);updateStatuses(step);updateGreekFire(step);
    }
    weather.update(dt, player); expeditions.update(dt); islandLife.update(time, dt, fx, weather.mode === 'night',player); fx.update(dt); shotFx.update(realDt, camera); director.update(player,islands,bestiary.entries,time,{rumCharges:voyage.rumCharges,inPort:inPort(),climate:weather.mode,combatHot:(player.audioCombatUntil??0)>time||shots.some(sh=>sh.source.team!==player.team&&distance(player,sh.source)<65)});
    for (let i = airborne.length - 1; i >= 0; i--) { const p = airborne[i]; p.life -= dt; p.velocity.y -= dt * 9; p.object.position.addScaledVector(p.velocity, dt); p.object.rotation.z += dt * 4; if (p.life <= 0) { fx.impact(p.object.position.clone().setY(.02)); scene.remove(p.object); airborne.splice(i, 1); } }
    const winner=battleWinner(islands);if(winner)finishExpedition(winner);
  }
  if(!dt||gameOver)qaBench?.update(0);
  if(showcase!==null){previewTime+=realDt;weather.update(realDt,islands[showcase]);islandLife.update(time+previewTime,realDt,fx,weather.mode==='night',islands[showcase]);fx.update(realDt);shotFx.update(realDt,camera);}
  for(const ship of ships)if(ship.dead&&(ship.respawnDelay??7)-ship.dead>=7)ship.object.visible=false;
  const inMenu=modalOpen()||gameOver||showcase!==null;
  const nearbyFire=!inMenu&&(player.burning>0||greekSea.patches.some(patch=>distance(player,patch)<18)||ships.some(ship=>ship.burning>0&&distance(player,ship)<22));
  audio.setScene({listener:{x:player.x,z:player.z,heading:0},climate:inMenu?'clear':{mode:weather.mode,storm:weather.storm},combat:!inMenu&&((player.audioCombatUntil??0)>time||shots.some(shot=>distance(player,shot.source)<65)),inPort:inMenu||inPort(),speed:inMenu?0:player.speed,burning:nearbyFire?1:0,time});
  if(!inMenu&&!player.dead&&time>=(player.audioCreakAt??4)){player.audioCreakAt=time+4.8;if(player.speed>4||weather.storm>.3||player.hp<player.maxHp*.65)playSound('ship.creak',.5,player);}
  ocean.time.value = time + (showcase!==null?previewTime:0);
  greekSea.draw(ships,time,player);
  territoryArt.update(time+previewTime,realDt);
  for (const b of gulls) { b.g.position.set(Math.cos(time * .035 + b.phase) * b.r, b.y, Math.sin(time * .035 + b.phase) * b.r * .7); b.g.rotation.y = -time * .035 - b.phase; b.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (.2 + Math.sin(time * 3 + b.phase) * .22)); }
  updateCamera(realDt); updateLabels(dt); updateCombatFeel(realDt);
  if (now > toastUntil) $('toast').classList.remove('visible');
  fpsClock += wallDt; fpsFrames++; if (fpsClock >= 1) { fps = fpsFrames / fpsClock; fpsFrames = 0; fpsClock = 0; }
  uiClock += realDt; if (uiClock > .1) { uiClock = 0; updateHUD();const state=audio.status;renderer.domElement.dataset.audioState=state.unlocked?(state.paused?'paused':'ready'):'locked';renderer.domElement.dataset.audioMusic=state.music;renderer.domElement.dataset.audioDecoded=String(state.decoded);renderer.domElement.dataset.audioVoices=String(state.voices);renderer.domElement.dataset.audioErrors=String(Object.keys(state.errors).length); }
  reflectionClock += realDt; if (reflectionClock >= (quality === 'high' ? 1 / 15 : 1 / 10)) { renderReflections(); renderer.shadowMap.needsUpdate = true; reflectionClock = 0; }
  crewRenderer.update(realDt);campaign.fog.mesh.visible = showcase === null; renderer.render(scene, camera);
  renderer.domElement.dataset.frameCpuMs=(performance.now()-frameStarted).toFixed(1);renderer.domElement.dataset.frameIntervalMs=(wallDt*1000).toFixed(1);renderer.domElement.dataset.triangles=String(renderer.info.render.triangles);
}
updateCamera(.016); renderReflections(); renderer.shadowMap.needsUpdate = true; updateHUD(); requestAnimationFrame(animate);
setTimeout(() => { $('loading').style.opacity = 0; setTimeout(() => $('loading')?.remove(), 750); }, 500);

if (!qaEnabled) mountEmbark({ onStart: () => {
  paused = false; clearInput(); updateHUD();
  playSound('notice');
  setTimeout(()=>director.speak('captain','200 de adelanto. Saquea y trae el oro a puerto. ¡Y el barco!',{priority:2,key:'intro'}),1000);
} });
window.pirateTides = { getState: () => ({ player: { x: player.x, z: player.z, speed: player.speed, heading: player.heading, hp: player.hp, gold: player.gold, crew: player.crew, level: player.level, upgrades: { ...player.upgrades } }, bank, blueScore, elapsed, paused, fps, drawCalls: renderer.info.render.calls, particles: fx.alive, shots: shots.length, lootProgress: lootProgress?.progress ?? null,audio:audio.status, combat: { ...combat }, camera: { roll: camera.rotation.z, timeScale: timeScale(combat) } }) };

/**
 * A read-only census of everything a player could act on this frame: which guns
 * bear on what, and how long until the next salvo. Measuring whether a fight
 * actually offers decisions means sampling the fight as it runs, and none of
 * that is visible from the outside. Opt-in, same flag as the rest of the tooling.
 */
if (qaEnabled) window.pirateTides.runFixture = id => qaBench.runFixture(id);
if (qaEnabled) window.pirateTides.probe = () => {
  const hostile = ships.filter(s => !s.dead && s.team !== player.team && s.object.visible);
  const bearing = s => Math.abs(bearingAngle(s.x, s.z, player));
  return {
    me: { hp: Math.round(player.hp), maxHp: player.maxHp, dead: !!player.dead, x: +player.x.toFixed(1), z: +player.z.toFixed(1), heading: +player.heading.toFixed(3), speed: +player.speed.toFixed(2) },
    weapon: weaponIndex, weaponName: weapons[weaponIndex].name,
    cooldown: +player.cooldown.toFixed(2), reload: +player.cooldownTotal.toFixed(2),
    ready: player.cooldown <= 0,
    boosting: voyage.boosting, stamina: +voyage.stamina.toFixed(1),
    selected: selectedEnemy && !selectedEnemy.dead && selectedEnemy.object.visible ? selectedEnemy.name : null,
    threats: hostile.length,
    closest: hostile.length ? +Math.min(...hostile.map(s => distance(player, s))).toFixed(1) : null,
    hostiles: hostile.map(s => ({
      name: s.name, hp: Math.round(s.hp), maxHp: s.maxHp, role: s.aiRole ?? 'n/a',
      x: +s.x.toFixed(1), z: +s.z.toFixed(1),
      d: +distance(player, s).toFixed(1), bearing: +bearing(s).toFixed(2),
      // Bearings outside this band mean the target sits ahead of or behind the
      // broadside, which is what "turn to bring a gun to bear" would hinge on.
      abeam: bearing(s) > .35 && bearing(s) < Math.PI - .35,
    })),
    fleet: ships.map(s => ({ name: s.name, team: s.team, dead: s.dead, vis: s.object.visible, x: Math.round(s.x), z: Math.round(s.z), hp: Math.round(s.hp) })),
    tally: { ...qaStats, hitsByKind: [...qaStats.hitsByKind], damageByKind: qaStats.damageByKind.map(v => +v.toFixed(1)) },
  };
};









