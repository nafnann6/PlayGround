import * as THREE from '../vendor/three.module.js'
import { buildWorld } from './world.js'
import { ViewModel } from './weapons.js'
import { EnemyManager } from './enemies.js'
import { Effects } from './effects.js'
import { AudioEngine } from './audio.js'
import { createPost } from './post.js'
import { clamp, damp, rand, formatTime } from './utils.js'

const canvas = document.getElementById('game')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2) * 0.82)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.autoClear = false
renderer.setClearColor(0x05070a, 1)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.03, 140)
camera.rotation.order = 'YXZ'
scene.add(camera)

const world = buildWorld(scene, renderer)
const viewModel = new ViewModel(window.innerWidth / window.innerHeight)
const effects = new Effects(scene, world.textures)
const audio = new AudioEngine()
const post = createPost(renderer)

// Player flashlight
const flashlight = new THREE.SpotLight(0xffe8c4, 42, 30, 0.43, 0.58, 1.45)
flashlight.position.set(0, 1.6, 0)
scene.add(flashlight)
const flashlightTarget = new THREE.Object3D()
scene.add(flashlightTarget)
flashlight.target = flashlightTarget

const WEAPONS = {
  rifle: {
    name: 'MK18', label: 'MK18 / 5.56', mode: 'AUTO', magSize: 30, reserveMax: 180,
    rpm: 760, damage: 31, headMult: 3.6, legMult: 0.68, reload: 1.75,
    spreadHip: 0.015, spreadAds: 0.0025, recoil: 0.0065, auto: true,
  },
  pistol: {
    name: 'M17', label: 'M17 / 9MM', mode: 'SEMI', magSize: 15, reserveMax: 90,
    rpm: 420, damage: 44, headMult: 3.2, legMult: 0.75, reload: 1.25,
    spreadHip: 0.019, spreadAds: 0.004, recoil: 0.011, auto: false,
  },
}

const EYE_HEIGHT = 1.68
const CROUCH_HEIGHT = 1.18
const PLAYER_RADIUS = 0.34

const state = {
  mode: 'menu',
  time: 0,
  menuTime: 0,
  elapsed: 0,
  locked: false,
  everLocked: false,
  fade: 1,
  damageFlash: 0,
  hitMarker: 0,
  shake: 0,
  shakeTime: 0,
  radioTimer: 0,
  radioFull: '',
  radioChars: 0,
  deathTimer: 0,
  endShown: false,
  lowHealth: 0,
  triggerHeld: false,
  pendingShot: false,
  rightDown: false,
  adsBlend: 0,
  fireCooldown: 0,
  reloading: false,
  reloadT: 0,
  reloadDuration: 0,
  switchCooldown: 0,
  weapon: 'rifle',
  flashOn: true,
  battery: 100,
  killFeed: [],
  exfilActive: false,
  exfilNotified: false,
  clearNotified: false,
  intelNotified: false,
  damageDirTimer: 0,
}

const player = {
  position: new THREE.Vector3(0, 0, 25.3),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  height: EYE_HEIGHT,
  crouching: false,
  sprinting: false,
  moving: false,
  speed: 0,
  stamina: 100,
  health: 100,
  invuln: 0,
  dead: false,
  grounded: true,
  lastDamage: 0,
  bob: 0,
  stepDist: 0,
  recoilPitch: 0,
  recoilYaw: 0,
  strafe: 0,
  swayX: 0,
  swayY: 0,
  ads: 0,
}

const ammo = {
  rifle: { mag: 30, reserve: 150 },
  pistol: { mag: 15, reserve: 75 },
}

const stats = {
  shots: 0,
  hits: 0,
  headshots: 0,
  kills: 0,
  intel: false,
}

let manager = null
let hitMarkerTimeout = null
const keys = new Set()

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const el = (id) => document.getElementById(id)
const ui = {
  menu: el('menu'),
  hud: el('hud'),
  pause: el('pause'),
  end: el('end'),
  recTime: el('recTime'),
  missionClock: el('missionClock'),
  batteryFill: el('batteryFill'),
  batteryText: el('batteryText'),
  heading: el('heading'),
  cardinal: el('cardinal'),
  objMarker: el('objMarker'),
  objMarkerLabel: el('objMarkerLabel'),
  healthNum: el('healthNum'),
  healthBar: el('healthBar'),
  staminaBar: el('staminaBar'),
  ammoMag: el('ammoMag'),
  ammoReserve: el('ammoReserve'),
  weaponName: el('weaponName'),
  fireMode: el('fireMode'),
  weaponSlots: el('weaponSlots'),
  objectiveTitle: el('objectiveTitle'),
  objectiveSub: el('objectiveSub'),
  objIntel: el('objIntel'),
  objHostiles: el('objHostiles'),
  objExfil: el('objExfil'),
  intelCount: el('intelCount'),
  hostileCount: el('hostileCount'),
  radio: el('radio'),
  radioText: el('radioText'),
  killfeed: el('killfeed'),
  interact: el('interact'),
  interactText: el('interactText'),
  crosshair: el('crosshair'),
  hitmarker: el('hitmarker'),
  damageDir: el('damageDir'),
  endTitle: el('endTitle'),
  endSub: el('endSub'),
  endStats: el('endStats'),
  endTag: el('endTag'),
  pauseStats: el('pauseStats'),
  controls: el('controls'),
  deployBtn: el('deployBtn'),
  controlsBtn: el('controlsBtn'),
  resumeBtn: el('resumeBtn'),
  restartBtn: el('restartBtn'),
  quitBtn: el('quitBtn'),
  retryBtn: el('retryBtn'),
  menuBtn: el('menuBtn'),
  closeControls: el('closeControls'),
  lockHint: el('lockHint'),
}

function showRadio(text, duration = 5.5) {
  state.radioFull = text
  state.radioChars = 0
  state.radioTimer = duration
  ui.radio.classList.add('show')
  ui.radioText.textContent = ''
}

function updateRadio(dt) {
  if (state.radioTimer <= 0) return
  state.radioTimer -= dt
  state.radioChars = Math.min(state.radioFull.length, state.radioChars + dt * 58)
  ui.radioText.textContent = state.radioFull.slice(0, Math.floor(state.radioChars))
  if (state.radioTimer <= 0) ui.radio.classList.remove('show')
}

function addKillFeed(text, headshot = false) {
  const item = document.createElement('div')
  item.className = 'kill-item' + (headshot ? ' head' : '')
  item.innerHTML = `<span class="kill-x">×</span><span>${text}</span><span class="kill-tag">${headshot ? 'HEAD' : 'CONFIRMED'}</span>`
  ui.killfeed.appendChild(item)
  state.killFeed.push({ el: item, t: 3.4 })
  while (ui.killfeed.children.length > 4) ui.killfeed.firstChild.remove()
}

function updateKillFeed(dt) {
  for (let i = state.killFeed.length - 1; i >= 0; i--) {
    const k = state.killFeed[i]
    k.t -= dt
    if (k.t <= 0) {
      k.el.classList.add('out')
      if (k.t < -0.4) {
        k.el.remove()
        state.killFeed.splice(i, 1)
      }
    }
  }
}

function showHitmarker(head = false) {
  ui.hitmarker.classList.remove('active', 'head')
  void ui.hitmarker.offsetWidth
  ui.hitmarker.classList.add('active')
  if (head) ui.hitmarker.classList.add('head')
  state.hitMarker = 0.16
  if (hitMarkerTimeout) clearTimeout(hitMarkerTimeout)
  hitMarkerTimeout = setTimeout(() => ui.hitmarker.classList.remove('active'), 110)
}

function setMode(mode) {
  state.mode = mode
  if (mode === 'menu') {
    ui.menu.classList.remove('hidden')
    ui.hud.classList.add('hidden')
    ui.pause.classList.add('hidden')
    ui.end.classList.add('hidden')
    document.body.classList.remove('playing')
    document.body.classList.add('menu')
  } else if (mode === 'playing') {
    ui.menu.classList.add('hidden')
    ui.hud.classList.remove('hidden')
    ui.pause.classList.add('hidden')
    ui.end.classList.add('hidden')
    document.body.classList.add('playing')
    document.body.classList.remove('menu')
  } else if (mode === 'paused') {
    ui.pause.classList.remove('hidden')
    ui.hud.classList.remove('hidden')
    document.body.classList.remove('playing')
  } else if (mode === 'dead' || mode === 'won') {
    ui.hud.classList.remove('hidden')
    document.body.classList.remove('playing')
  }
}

function requestLock() {
  const target = document.body
  if (!document.pointerLockElement) {
    try {
      const p = target.requestPointerLock?.()
      if (p && p.catch) p.catch(() => {})
    } catch {}
  }
}

function setActiveWeapon(name, silent = false) {
  if (name === state.weapon && !silent) return
  state.weapon = name
  viewModel.setActive(name)
  state.switchCooldown = 0.32
  state.reloading = false
  viewModel.setReloading(false, 0)
  if (!silent) audio.click(0.14, 900)
  updateWeaponHUD()
}

function updateWeaponHUD() {
  const w = WEAPONS[state.weapon]
  const a = ammo[state.weapon]
  ui.weaponName.textContent = w.label
  ui.fireMode.textContent = w.mode
  ui.ammoMag.textContent = String(a.mag).padStart(2, '0')
  ui.ammoReserve.textContent = String(a.reserve).padStart(3, '0')
  ui.ammoMag.classList.toggle('low', a.mag <= Math.ceil(w.magSize * 0.25))
  const slots = ui.weaponSlots.querySelectorAll('.slot')
  slots.forEach((s) => {
    s.classList.toggle('active', s.dataset.weapon === state.weapon)
  })
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function resetGame() {
  player.position.set(0, 0, 25.3)
  player.velocity.set(0, 0, 0)
  player.yaw = 0
  player.pitch = 0
  player.height = EYE_HEIGHT
  player.crouching = false
  player.sprinting = false
  player.moving = false
  player.speed = 0
  player.stamina = 100
  player.health = 100
  player.invuln = 2.6
  player.dead = false
  player.grounded = true
  player.lastDamage = 0
  player.bob = 0
  player.stepDist = 0
  player.recoilPitch = 0
  player.recoilYaw = 0
  player.strafe = 0
  player.swayX = 0
  player.swayY = 0
  player.ads = 0

  ammo.rifle = { mag: 30, reserve: 150 }
  ammo.pistol = { mag: 15, reserve: 75 }
  stats.shots = 0
  stats.hits = 0
  stats.headshots = 0
  stats.kills = 0
  stats.intel = false

  state.elapsed = 0
  state.fade = 0
  state.damageFlash = 0
  state.hitMarker = 0
  state.shake = 0
  state.deathTimer = 0
  state.endShown = false
  state.lowHealth = 0
  state.triggerHeld = false
  state.pendingShot = false
  state.rightDown = false
  state.adsBlend = 0
  state.fireCooldown = 0
  state.reloading = false
  state.reloadT = 0
  state.reloadDuration = 0
  state.switchCooldown = 0
  state.weapon = 'rifle'
  state.flashOn = true
  state.battery = 100
  state.exfilActive = false
  state.exfilNotified = false
  state.clearNotified = false
  state.intelNotified = false
  state.radioTimer = 0
  state.killFeed = []
  ui.killfeed.innerHTML = ''

  manager.reset()
  world.intel.collected = false
  world.intel.screenMat.emissive.setHex(0x5aff9c)
  world.exfil.active = false
  world.exfil.completed = false
  viewModel.setActive('rifle', true)
  viewModel.setReloading(false, 0)
  updateWeaponHUD()
  updateObjectiveHUD()
  ui.hitmarker.classList.remove('active', 'head')
  ui.damageDir.classList.remove('show')
  ui.interact.classList.remove('show')

  camera.fov = 78
  camera.updateProjectionMatrix()
  camera.position.set(player.position.x, EYE_HEIGHT, player.position.z)
  camera.rotation.set(0, 0, 0)
  flashlight.visible = true
  setMode('playing')
  post.material.uniforms.uFade.value = 0

  setTimeout(() => {
    showRadio('UNIT 7, FEED IS LIVE. LOCATE THE MANIFEST IN LAB 03. WATCH YOUR CORNERS.', 7)
    audio.radio()
  }, 700)
}

function startGame() {
  audio.init()
  resetGame()
  requestLock()
}

function pauseGame() {
  if (state.mode !== 'playing') return
  setMode('paused')
  state.triggerHeld = false
  state.rightDown = false
  if (document.pointerLockElement) document.exitPointerLock()
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0
  ui.pauseStats.innerHTML = `
    <div><span>MISSION TIME</span><strong>${formatTime(state.elapsed)}</strong></div>
    <div><span>HOSTILES DOWN</span><strong>${stats.kills} / ${manager.total}</strong></div>
    <div><span>ACCURACY</span><strong>${acc}%</strong></div>
  `
}

function resumeGame() {
  if (state.mode !== 'paused') return
  setMode('playing')
  state.fade = 1
  requestLock()
}

function quitToMenu() {
  setMode('menu')
  if (document.pointerLockElement) document.exitPointerLock()
  state.mode = 'menu'
  state.menuTime = 0
  camera.fov = 78
  camera.updateProjectionMatrix()
  ui.pause.classList.add('hidden')
  ui.end.classList.add('hidden')
  document.body.classList.remove('playing')
  document.body.classList.add('menu')
}

function showEnd(win) {
  if (state.endShown) return
  state.endShown = true
  if (document.pointerLockElement) document.exitPointerLock()
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0
  ui.endTitle.textContent = win ? 'OPERATION COMPLETE' : 'SIGNAL LOST'
  ui.endTitle.classList.toggle('win', win)
  ui.endSub.textContent = win ? 'UNIT 07 — EXTRACTION CONFIRMED' : 'UNIT 07 — VITALS FLATLINE'
  ui.endTag.textContent = win ? 'FEED ARCHIVED // 03:17' : 'FEED TERMINATED // NO RECOVERY'
  ui.endStats.innerHTML = `
    <div class="end-stat"><span>TIME</span><strong>${formatTime(state.elapsed)}</strong></div>
    <div class="end-stat"><span>HOSTILES</span><strong>${stats.kills} / ${manager.total}</strong></div>
    <div class="end-stat"><span>ACCURACY</span><strong>${acc}%</strong></div>
    <div class="end-stat"><span>HEADSHOTS</span><strong>${stats.headshots}</strong></div>
    <div class="end-stat"><span>MANIFEST</span><strong>${stats.intel ? 'SECURED' : 'MISSING'}</strong></div>
  `
  ui.end.classList.remove('hidden')
  ui.end.classList.toggle('loss', !win)
  setMode(win ? 'won' : 'dead')
  ui.end.classList.remove('hidden')
}

function collectIntel() {
  if (world.intel.collected) return
  world.intel.collected = true
  stats.intel = true
  world.intel.screenMat.emissive.setHex(0xffa33d)
  audio.pickup()
  addKillFeed('MANIFEST SECURED')
  showRadio('MANIFEST SECURED. EXFIL IS COMPROMISED — CLEAR THE SITE AND GET TO THE NORTH GATE.', 7)
  updateObjectiveHUD()
  maybeActivateExfil()
}

function maybeActivateExfil() {
  if (world.intel.collected && manager.aliveCount === 0 && !state.exfilActive) {
    state.exfilActive = true
    world.exfil.active = true
    audio.radio()
    showRadio('SECTOR CLEAR. NORTH GATE IS GREEN. MOVE TO EXTRACTION.', 7)
    addKillFeed('EXTRACTION UNLOCKED')
    updateObjectiveHUD()
  }
}

function die() {
  if (player.dead) return
  player.dead = true
  state.triggerHeld = false
  state.rightDown = false
  state.deathTimer = 0
  state.damageFlash = 1
  audio.lose()
  setMode('dead')
  ui.crosshair.classList.add('hidden')
  showRadio('OFFICER DOWN. SIGNAL LOST.', 10)
  setTimeout(() => showEnd(false), 1800)
}

function win() {
  if (state.mode === 'won' || state.endShown) return
  state.exfilActive = true
  world.exfil.completed = true
  audio.win()
  setMode('won')
  showRadio('EXTRACTION CONFIRMED. GOOD WORK, UNIT 7.', 10)
  setTimeout(() => showEnd(true), 900)
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
function startReload() {
  if (state.mode !== 'playing' || state.reloading || player.dead) return
  const w = WEAPONS[state.weapon]
  const a = ammo[state.weapon]
  if (a.mag >= w.magSize || a.reserve <= 0) return
  state.reloading = true
  state.reloadT = w.reload
  state.reloadDuration = w.reload
  viewModel.setReloading(true, w.reload)
  audio.reload()
}

function finishReload() {
  const w = WEAPONS[state.weapon]
  const a = ammo[state.weapon]
  const need = w.magSize - a.mag
  const take = Math.min(need, a.reserve)
  a.mag += take
  a.reserve -= take
  state.reloading = false
  state.reloadT = 0
  viewModel.setReloading(false, 0)
  updateWeaponHUD()
}

function fireWeapon() {
  if (state.mode !== 'playing' || player.dead || state.reloading || state.switchCooldown > 0 || state.fireCooldown > 0) return
  const w = WEAPONS[state.weapon]
  const a = ammo[state.weapon]
  if (a.mag <= 0) {
    audio.empty()
    state.triggerHeld = false
    if (a.reserve > 0) startReload()
    return
  }
  a.mag--
  stats.shots++
  state.fireCooldown = 60 / w.rpm
  state.shake = Math.min(1, state.shake + 0.35)
  state.shakeTime = 0.09
  player.recoilPitch += w.recoil * (1 - state.adsBlend * 0.35)
  player.recoilYaw += rand(-1, 1) * w.recoil * 0.45
  viewModel.fire()
  audio.shot(state.weapon)

  camera.updateMatrixWorld(true)
  const origin = camera.position.clone()
  const dir = camera.getWorldDirection(new THREE.Vector3())
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const spread = (state.adsBlend > 0.5 ? w.spreadAds : w.spreadHip) * (player.moving ? 1.55 : 1) * (player.crouching ? 0.8 : 1)
  const ang = rand(0, Math.PI * 2)
  const rad = Math.sqrt(Math.random()) * spread
  dir.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize()

  const worldHit = world.raycast(origin, dir, 120)
  const enemyHit = manager.raycast(origin, dir, worldHit.dist)
  const muzzle = viewModel.getMuzzleWorld(camera)

  if (enemyHit) {
    const e = enemyHit.enemy
    let dmg = w.damage
    if (enemyHit.part === 'head') dmg *= w.headMult
    else if (enemyHit.part === 'legs') dmg *= w.legMult
    const killed = e.takeDamage(dmg, enemyHit.part, enemyHit.point)
    stats.hits++
    if (enemyHit.part === 'head') stats.headshots++
    effects.spawnBlood(enemyHit.point, dir, enemyHit.part === 'head' ? 18 : 10)
    effects.spawnTracer(muzzle, enemyHit.point, 0xffd79a)
    audio.hitmarker(enemyHit.part === 'head')
    showHitmarker(enemyHit.part === 'head')
    if (killed) {
      addKillFeed('HOSTILE DOWN', enemyHit.part === 'head')
    }
  } else {
    const point = worldHit.point || origin.clone().addScaledVector(dir, 60)
    effects.spawnSparks(point, worldHit.normal || new THREE.Vector3(0, 1, 0), 12)
    effects.spawnSmoke(point, 0.3, 0x757a78)
    effects.spawnTracer(muzzle, point, 0xffcb84)
    world.addImpact(point, worldHit.normal || new THREE.Vector3(0, 1, 0))
  }

  effects.muzzleFlash(muzzle)
  manager.alertAll(player.position, 38)
  state.adsBlend = Math.max(state.adsBlend, 0.05)
  updateWeaponHUD()
}

function onPlayerHit(dmg, enemy) {
  if (player.dead || state.mode !== 'playing' || player.invuln > 0) return
  player.health = Math.max(0, player.health - dmg)
  player.lastDamage = 0
  state.damageFlash = Math.min(1, state.damageFlash + 0.35 + dmg * 0.03)
  state.shake = Math.min(1.3, state.shake + 0.55)
  state.shakeTime = 0.22
  state.damageDirTimer = 1.1
  const dx = enemy.position.x - player.position.x
  const dz = enemy.position.z - player.position.z
  const targetYaw = Math.atan2(-dx, -dz)
  let rel = targetYaw - player.yaw
  while (rel > Math.PI) rel -= Math.PI * 2
  while (rel < -Math.PI) rel += Math.PI * 2
  ui.damageDir.style.transform = `translate(-50%, -50%) rotate(${-rel * 180 / Math.PI}deg)`
  ui.damageDir.classList.add('show')
  audio.hurt()
  if (player.health <= 0) die()
}

// ---------------------------------------------------------------------------
// Movement / camera
// ---------------------------------------------------------------------------
function updatePlayer(dt) {
  if (player.dead) return
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
  let ix = 0
  let iz = 0
  if (keys.has('KeyW')) iz += 1
  if (keys.has('KeyS')) iz -= 1
  if (keys.has('KeyD')) ix += 1
  if (keys.has('KeyA')) ix -= 1
  const wish = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix)
  const movingInput = wish.lengthSq() > 0
  if (movingInput) wish.normalize()

  const wantAds = state.rightDown && !player.sprinting && !state.reloading
  player.ads = damp(player.ads, wantAds ? 1 : 0, 12, dt)
  state.adsBlend = player.ads

  const canSprint = keys.has('ShiftLeft') && movingInput && iz > 0 && !wantAds && !player.crouching && player.stamina > 2
  player.sprinting = canSprint
  if (player.sprinting) {
    player.stamina = Math.max(0, player.stamina - dt * 26)
  } else {
    player.stamina = Math.min(100, player.stamina + dt * (movingInput ? 10 : 18))
  }

  const speed = player.crouching ? 2.15 : player.sprinting ? 6.45 : wantAds ? 2.6 : 4.25
  const accel = player.grounded ? 11 : 3.5
  const targetVX = wish.x * speed
  const targetVZ = wish.z * speed
  player.velocity.x = damp(player.velocity.x, targetVX, accel, dt)
  player.velocity.z = damp(player.velocity.z, targetVZ, accel, dt)
  player.strafe = damp(player.strafe, ix, 8, dt)

  // jump / gravity
  if (keys.has('Space') && player.grounded && !player.crouching) {
    player.velocity.y = 4.45
    player.grounded = false
    keys.delete('Space')
    audio.footstep(true)
  }
  player.velocity.y -= 13.2 * dt
  player.position.y += player.velocity.y * dt
  if (player.position.y <= 0) {
    if (!player.grounded) audio.footstep(false)
    player.position.y = 0
    player.velocity.y = 0
    player.grounded = true
  }

  const nextX = player.position.x + player.velocity.x * dt
  const nextZ = player.position.z + player.velocity.z * dt
  const height = player.crouching ? CROUCH_HEIGHT : EYE_HEIGHT
  const resolved = world.resolveCircle(nextX, nextZ, PLAYER_RADIUS, player.position.y, player.position.y + height)
  player.position.x = clamp(resolved.x, -24.3, 24.3)
  player.position.z = clamp(resolved.z, -29.2, 29.2)
  player.height = damp(player.height, player.crouching ? CROUCH_HEIGHT : EYE_HEIGHT, 10, dt)

  const realSpeed = Math.hypot(player.velocity.x, player.velocity.z)
  player.speed = realSpeed
  player.moving = realSpeed > 0.4

  // footstep cadence + bob
  if (player.grounded && realSpeed > 0.5) {
    player.bob += dt * (4.2 + realSpeed * 1.1)
    player.stepDist += realSpeed * dt
    const stepLength = player.sprinting ? 1.55 : player.crouching ? 2.2 : 1.85
    if (player.stepDist > stepLength) {
      player.stepDist = 0
      audio.footstep(player.sprinting)
    }
  } else {
    player.bob += dt * 1.6
  }

  // recoil recovery
  player.recoilPitch = damp(player.recoilPitch, 0, 7.5, dt)
  player.recoilYaw = damp(player.recoilYaw, 0, 7.5, dt)
  player.swayX = damp(player.swayX, 0, 7, dt)
  player.swayY = damp(player.swayY, 0, 7, dt)

  // stamina / health regen
  player.invuln = Math.max(0, player.invuln - dt)
  player.lastDamage += dt
  if (player.lastDamage > 6.5 && player.health < 100) {
    player.health = Math.min(100, player.health + dt * 6.5)
  }
  state.lowHealth = player.health < 35 ? 1 - player.health / 35 : 0
  state.battery = clamp(100 - state.elapsed * 0.055, 0, 100)
}

function updateCamera(dt) {
  const speedBob = clamp(player.speed / 5, 0, 1)
  const bobY = Math.sin(player.bob * 2) * 0.026 * speedBob + Math.sin(state.time * 1.3) * 0.004
  const bobX = Math.cos(player.bob) * 0.018 * speedBob
  const shakeX = state.shakeTime > 0 ? rand(-1, 1) * state.shake * 0.007 : 0
  const shakeY = state.shakeTime > 0 ? rand(-1, 1) * state.shake * 0.007 : 0
  state.shakeTime = Math.max(0, state.shakeTime - dt)
  state.shake = damp(state.shake, 0, 5, dt)

  camera.position.set(
    player.position.x + bobX + player.swayX * 0.0012,
    player.position.y + player.height + bobY,
    player.position.z,
  )
  const roll = Math.sin(player.bob) * 0.006 * speedBob - player.strafe * 0.012 + (state.shakeTime > 0 ? rand(-1, 1) * state.shake * 0.01 : 0)
  camera.rotation.set(
    player.pitch + player.recoilPitch + shakeY,
    player.yaw + player.recoilYaw + shakeX,
    roll,
  )
  const targetFov = player.ads > 0.5 ? 57 : player.sprinting ? 82 : 78
  camera.fov = damp(camera.fov, targetFov, 12, dt)
  camera.updateProjectionMatrix()
  viewModel.camera.fov = damp(viewModel.camera.fov, player.ads > 0.5 ? 50 : 60, 10, dt)
  viewModel.camera.updateProjectionMatrix()

  // flashlight follows view
  const fwd = new THREE.Vector3()
  camera.getWorldDirection(fwd)
  flashlight.position.copy(camera.position).addScaledVector(fwd, 0.15)
  flashlightTarget.position.copy(camera.position).addScaledVector(fwd, 14)
  flashlight.visible = state.flashOn
}

function updateMenuCamera(dt) {
  state.menuTime += dt
  const t = state.menuTime
  const z = 27.4 - (Math.sin(t * 0.045) * 0.5 + 0.5) * 7.0
  camera.position.set(Math.sin(t * 0.11) * 1.6, 1.72 + Math.sin(t * 0.5) * 0.01, z)
  camera.rotation.set(-0.015, Math.sin(t * 0.07) * 0.055, Math.sin(t * 0.4) * 0.002)
  camera.fov = 76
  camera.updateProjectionMatrix()
  flashlight.visible = false
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------
function nearestInteraction() {
  const p = player.position
  if (!world.intel.collected) {
    const d = Math.hypot(p.x - world.intel.position.x, p.z - world.intel.position.z)
    if (d < 2.5) return { type: 'intel', label: 'RECOVER THE MANIFEST', key: 'E' }
  }
  const dx = p.x - world.exfil.position.x
  const dz = p.z - world.exfil.position.z
  if (Math.hypot(dx, dz) < 3.2) {
    if (state.exfilActive) return { type: 'exfil', label: 'EXTRACT', key: 'E' }
    return { type: 'exfilLocked', label: state.exfilActive ? 'EXTRACT' : 'EXFIL LOCKED — CLEAR THE SITE', key: 'E' }
  }
  return null
}

function interact() {
  if (state.mode !== 'playing' || player.dead) return
  const it = nearestInteraction()
  if (!it) return
  if (it.type === 'intel') collectIntel()
  else if (it.type === 'exfil') win()
  else if (it.type === 'exfilLocked') {
    showRadio(state.exfilActive ? 'EXTRACTION IS OPEN. MOVE.' : 'EXFIL LOCKED. MANIFEST AND ALL HOSTILES REQUIRED.', 4)
    audio.radio()
  }
}

function updateInteract() {
  if (state.mode !== 'playing' || player.dead) {
    ui.interact.classList.remove('show')
    return
  }
  const it = nearestInteraction()
  if (it) {
    ui.interact.classList.add('show')
    ui.interactText.textContent = it.label
  } else {
    ui.interact.classList.remove('show')
  }
  // Auto-extract when standing in the zone
  if (state.exfilActive && !world.exfil.completed) {
    const d = Math.hypot(player.position.x - world.exfil.position.x, player.position.z - world.exfil.position.z)
    if (d < 2.4) win()
  }
}

// ---------------------------------------------------------------------------
// HUD update
// ---------------------------------------------------------------------------
function updateObjectiveHUD() {
  const remaining = manager ? manager.aliveCount : 0
  const intel = world.intel.collected
  if (!intel) {
    ui.objectiveTitle.textContent = 'RECOVER THE MANIFEST'
    ui.objectiveSub.textContent = 'LAB 03 // WEST WING'
  } else if (remaining > 0) {
    ui.objectiveTitle.textContent = 'NEUTRALIZE HOSTILES'
    ui.objectiveSub.textContent = `${remaining} CONTACT${remaining === 1 ? '' : 'S'} REMAIN`
  } else if (state.exfilActive) {
    ui.objectiveTitle.textContent = 'REACH THE EXTRACTION'
    ui.objectiveSub.textContent = 'NORTH GATE // GREEN SMOKE'
  } else {
    ui.objectiveTitle.textContent = 'HOLD POSITION'
    ui.objectiveSub.textContent = 'AWAITING EXFIL CLEARANCE'
  }
  ui.objIntel.classList.toggle('done', intel)
  ui.intelCount.textContent = intel ? '1 / 1' : '0 / 1'
  const killed = manager ? manager.kills : 0
  ui.objHostiles.classList.toggle('done', remaining === 0)
  ui.hostileCount.textContent = `${killed} / ${manager ? manager.total : 0}`
  ui.objExfil.classList.toggle('done', world.exfil.completed)
  ui.objExfil.classList.toggle('locked', !state.exfilActive)
}

function updateHUD(dt) {
  const w = WEAPONS[state.weapon]
  const a = ammo[state.weapon]
  ui.ammoMag.textContent = String(a.mag).padStart(2, '0')
  ui.ammoReserve.textContent = String(a.reserve).padStart(3, '0')
  ui.ammoMag.classList.toggle('low', a.mag <= Math.ceil(w.magSize * 0.25))
  ui.healthNum.textContent = String(Math.ceil(player.health)).padStart(3, '0')
  ui.healthBar.style.width = `${clamp(player.health, 0, 100)}%`
  ui.healthBar.classList.toggle('low', player.health < 35)
  ui.staminaBar.style.width = `${clamp(player.stamina, 0, 100)}%`
  ui.batteryFill.style.width = `${state.battery}%`
  ui.batteryText.textContent = `${Math.floor(state.battery)}%`
  const heading = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360
  ui.heading.textContent = String(Math.round(heading)).padStart(3, '0')
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  ui.cardinal.textContent = cardinals[Math.round(heading / 45) % 8]
  const frame = Math.floor((state.elapsed * 30) % 30)
  ui.recTime.textContent = `03:${String(17 + Math.floor(state.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(state.elapsed) % 60).padStart(2, '0')}:${String(frame).padStart(2, '0')}`
  ui.missionClock.textContent = formatTime(state.elapsed)

  const gap = 4 + (player.ads > 0.5 ? 1 : 5) + clamp(player.speed * 1.2, 0, 7) + (state.triggerHeld ? 1 : 0)
  document.documentElement.style.setProperty('--cross-gap', `${gap}px`)
  ui.crosshair.classList.toggle('ads', player.ads > 0.55)
  ui.crosshair.classList.toggle('hidden', state.mode !== 'playing' || player.dead)

  // objective compass marker
  let target = null
  let label = ''
  if (!world.intel.collected) {
    target = world.intel.position
    label = 'MANIFEST'
  } else if (state.exfilActive) {
    target = world.exfil.position
    label = 'EXFIL'
  }
  if (target && state.mode !== 'menu') {
    const dx = target.x - player.position.x
    const dz = target.z - player.position.z
    const dist = Math.hypot(dx, dz)
    const targetYaw = Math.atan2(-dx, -dz)
    let rel = targetYaw - player.yaw
    while (rel > Math.PI) rel -= Math.PI * 2
    while (rel < -Math.PI) rel += Math.PI * 2
    const pct = 50 + clamp(rel / (Math.PI * 0.75), -1, 1) * 46
    ui.objMarker.style.left = `${pct}%`
    ui.objMarkerLabel.textContent = `${label} ${Math.round(dist)}M`
    ui.objMarker.classList.remove('hidden')
    ui.objMarker.classList.toggle('behind', Math.abs(rel) > Math.PI * 0.6)
  } else {
    ui.objMarker.classList.add('hidden')
  }

  if (state.damageDirTimer > 0) {
    state.damageDirTimer -= dt
    if (state.damageDirTimer <= 0) ui.damageDir.classList.remove('show')
  }
  state.damageFlash = damp(state.damageFlash, 0, 3.5, dt)
  post.material.uniforms.uDamage.value = state.damageFlash
  post.material.uniforms.uLowHealth.value = state.lowHealth
  post.material.uniforms.uTime.value = state.time
  post.material.uniforms.uFade.value = clamp(state.fade, 0, 1)
  state.fade = Math.min(1, state.fade + dt * 2.2)

  updateInteract()
  updateKillFeed(dt)
  updateRadio(dt)
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  if (e.repeat) {
    keys.add(e.code)
    return
  }
  keys.add(e.code)
  if (state.mode === 'menu') {
    if (e.code === 'Enter') startGame()
    return
  }
  if (state.mode === 'paused') {
    if (e.code === 'Escape' || e.code === 'Enter') resumeGame()
    return
  }
  if (state.mode === 'dead' || state.mode === 'won') {
    if (e.code === 'Escape') quitToMenu()
    if (e.code === 'KeyR') startGame()
    return
  }
  if (state.mode !== 'playing') return
  switch (e.code) {
    case 'Escape':
      pauseGame()
      break
    case 'KeyR':
      startReload()
      break
    case 'KeyC':
      player.crouching = !player.crouching
      break
    case 'KeyF':
      state.flashOn = !state.flashOn
      audio.click(0.08, 1400)
      break
    case 'KeyE':
      interact()
      break
    case 'Digit1':
      setActiveWeapon('rifle')
      break
    case 'Digit2':
      setActiveWeapon('pistol')
      break
    case 'KeyM':
      audio.setMuted(!audio.muted)
      break
  }
})

window.addEventListener('keyup', (e) => keys.delete(e.code))

canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing') return
  if (!state.locked) requestLock()
  if (e.button === 0) {
    state.triggerHeld = true
    state.pendingShot = true
  }
  if (e.button === 2) state.rightDown = true
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    state.triggerHeld = false
    state.pendingShot = false
  }
  if (e.button === 2) state.rightDown = false
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

document.addEventListener('mousemove', (e) => {
  if (state.mode !== 'playing' || player.dead) return
  if (!document.pointerLockElement && !state.locked) return
  const sens = 0.00215 * (1 - player.ads * 0.42)
  player.yaw -= e.movementX * sens
  player.pitch -= e.movementY * sens
  player.pitch = clamp(player.pitch, -1.43, 1.43)
  player.swayX = clamp(player.swayX + e.movementX * 0.5, -22, 22)
  player.swayY = clamp(player.swayY + e.movementY * 0.5, -22, 22)
})

document.addEventListener('pointerlockchange', () => {
  state.locked = !!document.pointerLockElement
  if (state.locked) {
    state.everLocked = true
    ui.lockHint.classList.add('hidden')
  } else if (state.mode === 'playing' && state.everLocked) {
    // Esc is handled by keydown; clicking outside also drops the feed.
    ui.lockHint.classList.remove('hidden')
  }
})

window.addEventListener('blur', () => {
  state.triggerHeld = false
  state.rightDown = false
  keys.clear()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame()
})

ui.deployBtn.addEventListener('click', () => {
  audio.init()
  startGame()
})
ui.controlsBtn.addEventListener('click', () => {
  audio.init()
  ui.controls.classList.remove('hidden')
})
ui.closeControls.addEventListener('click', () => ui.controls.classList.add('hidden'))
ui.resumeBtn.addEventListener('click', resumeGame)
ui.restartBtn.addEventListener('click', () => startGame())
ui.quitBtn.addEventListener('click', quitToMenu)
ui.retryBtn.addEventListener('click', () => startGame())
ui.menuBtn.addEventListener('click', quitToMenu)
ui.lockHint.addEventListener('click', () => requestLock())

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function updatePlaying(dt) {
  state.elapsed += dt
  updatePlayer(dt)
  updateCamera(dt)

  // weapon state
  if (state.reloading) {
    state.reloadT -= dt
    if (state.reloadT <= 0) finishReload()
  }
  state.switchCooldown = Math.max(0, state.switchCooldown - dt)
  state.fireCooldown = Math.max(0, state.fireCooldown - dt)

  if (!player.dead) {
    if (state.pendingShot) {
      state.pendingShot = false
      fireWeapon()
    }
    if (state.triggerHeld && WEAPONS[state.weapon].auto) fireWeapon()
  }

  // weapon viewmodel
  viewModel.update(dt, {
    ads: player.ads,
    moveSpeed: player.speed,
    sprint: player.sprinting ? 1 : 0,
    crouch: player.crouching ? 1 : 0,
    swayX: player.swayX,
    swayY: player.swayY,
    reloading: state.reloading,
    reloadT: state.reloadT,
    reloadDuration: state.reloadDuration,
  })

  const playerEye = camera.position
  manager.update(dt, {
    player,
    playerEye,
    time: state.time,
    onPlayerHit,
    onEnemyShot: (muzzle, end) => {
      effects.spawnTracer(muzzle, end, 0xffb066)
      effects.muzzleFlash(muzzle)
    },
    onNearMiss: (muzzle, end) => {
      if (end.distanceTo(playerEye) < 2.6) {
        audio.nearMiss()
        state.shake = Math.min(1, state.shake + 0.08)
        state.shakeTime = 0.05
      }
    },
  })

  effects.update(dt)
  world.update(state.time, dt, player.position)
  audio.update(dt)

  // clear notifications
  if (manager.aliveCount === 0 && !state.clearNotified) {
    state.clearNotified = true
    if (world.intel.collected) {
      maybeActivateExfil()
    } else if (!state.intelNotified) {
      showRadio('SITE CLEAR. MANIFEST STILL SECURE IN LAB 03.', 6)
      audio.radio()
    }
  }
  if (world.intel.collected && !state.intelNotified) state.intelNotified = true
  updateObjectiveHUD()

  // exfil visual activation
  world.exfil.active = state.exfilActive

  if (player.dead) {
    state.deathTimer += dt
  }
}

function animate(now) {
  requestAnimationFrame(animate)
  const dt = Math.min(0.05, Math.max(0.001, (now - animate.last) / 1000 || 0.016))
  animate.last = now
  state.time += dt

  if (state.mode === 'menu') {
    updateMenuCamera(dt)
    world.update(state.time, dt, null)
    manager.idleUpdate(dt)
    effects.update(dt)
    state.fade = Math.min(1, state.fade + dt * 1.4)
    post.material.uniforms.uFade.value = state.fade
    post.material.uniforms.uTime.value = state.time
    post.material.uniforms.uDamage.value = 0
    post.material.uniforms.uLowHealth.value = 0
    post.render(renderer, scene, camera, null, null)
    updateHUD(dt)
    return
  }

  if (state.mode === 'playing') {
    updatePlaying(dt)
  } else if (state.mode === 'paused') {
    updateCamera(dt)
    effects.update(dt * 0.2)
    viewModel.update(dt, {
      ads: player.ads, moveSpeed: 0, sprint: 0, crouch: 0, swayX: 0, swayY: 0,
      reloading: state.reloading, reloadT: state.reloadT, reloadDuration: state.reloadDuration,
    })
    post.material.uniforms.uTime.value = state.time
  } else {
    // dead / won
    updateCamera(dt)
    effects.update(dt)
    world.update(state.time, dt, player.position)
    viewModel.update(dt, {
      ads: 0, moveSpeed: 0, sprint: 0, crouch: 0, swayX: 0, swayY: 0,
      reloading: false, reloadT: 0, reloadDuration: 0,
    })
    post.material.uniforms.uTime.value = state.time
  }

  updateHUD(dt)
  const showWeapon = state.mode === 'playing' || state.mode === 'paused'
  post.render(renderer, scene, camera, showWeapon ? viewModel.scene : null, showWeapon ? viewModel.camera : null)
}

animate.last = performance.now()

// ---------------------------------------------------------------------------
// Boot / resize / debug
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2) * 0.82)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  viewModel.setAspect(w / h)
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  post.setSize(size.x, size.y)
}

window.addEventListener('resize', onResize)

// initial manager
manager = new EnemyManager(scene, world, audio, {
  onKill: (e) => {
    stats.kills++
    if (e.hitPart === 'head') stats.headshots = Math.max(stats.headshots, 0)
    if (manager.aliveCount === 0) {
      // handled in updatePlaying so objective order stays clear
    }
  },
  onBlood: (pos) => {
    world.addBloodPool(pos)
  },
})

setMode('menu')
document.body.classList.add('menu')
updateWeaponHUD()
updateObjectiveHUD()
ui.objMarker.classList.add('hidden')

// debug hooks for verification and capture
window.__game = {
  state,
  player,
  ammo,
  stats,
  camera,
  scene,
  world,
  renderer,
  viewModel,
  effects,
  get manager() { return manager },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  quit: quitToMenu,
  teleport(x, z, yaw = player.yaw, pitch = player.pitch) {
    player.position.x = x
    player.position.z = z
    player.yaw = yaw
    player.pitch = pitch
    updateCamera(0.016)
  },
  lookAt(x, y, z) {
    const dx = x - camera.position.x
    const dy = y - camera.position.y
    const dz = z - camera.position.z
    player.yaw = Math.atan2(-dx, -dz)
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz))
    updateCamera(0.016)
  },
  setMode,
  fire: fireWeapon,
  reload: startReload,
  interact,
  win,
  die,
  setAds(v) { state.rightDown = v; player.ads = v ? 1 : 0; state.adsBlend = player.ads },
  getMuzzle: () => viewModel.getMuzzleWorld(camera),
  showEnd,
}
window.__game.ready = true

requestAnimationFrame(animate)
