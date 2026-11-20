import * as THREE from '../vendor/three.module.js'
import { clamp, damp, rand } from './utils.js'

function flashTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.16, 'rgba(255,236,170,0.98)')
  g.addColorStop(0.45, 'rgba(255,150,55,0.48)')
  g.addColorStop(1, 'rgba(255,70,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(255,230,180,0.8)'
  ctx.lineWidth = 5
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2
    ctx.beginPath()
    ctx.moveTo(64, 64)
    ctx.lineTo(64 + Math.cos(a) * 61, 64 + Math.sin(a) * 61)
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

function addBox(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}

function addCyl(parent, rt, rb, h, x, y, z, mat, rx = 0, ry = 0, rz = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}

function makeMats() {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x3a4144, roughness: 0.44, metalness: 0.38 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b2022, roughness: 0.62, metalness: 0.28 }),
    polymer: new THREE.MeshBasicMaterial({ color: 0x2a2d20 }),
    fde: new THREE.MeshBasicMaterial({ color: 0x343628 }),
    tape: new THREE.MeshBasicMaterial({ color: 0x3a3a2c }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5b6364, roughness: 0.32, metalness: 0.6 }),
    glove: new THREE.MeshBasicMaterial({ color: 0x0b0e0c }),
    glovePanel: new THREE.MeshBasicMaterial({ color: 0x171b16 }),
    sleeve: new THREE.MeshBasicMaterial({ color: 0x080a09 }),
    sleevePatch: new THREE.MeshBasicMaterial({ color: 0x101410 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x8b6249, roughness: 0.82, metalness: 0.0 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2a18 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x0b1a18, transparent: true, opacity: 0.46, depthWrite: false }),
  }
}

function buildRifle(m) {
  const g = new THREE.Group()
  // Lower receiver
  addBox(g, 0.075, 0.09, 0.28, 0, 0, 0.02, m.gunmetal)
  addBox(g, 0.073, 0.075, 0.2, 0, 0.012, -0.25, m.fde)
  addBox(g, 0.08, 0.025, 0.44, 0, 0.065, -0.03, m.black)
  // rail slots
  for (let i = 0; i < 9; i++) {
    addBox(g, 0.052, 0.006, 0.018, 0, 0.081, -0.2 + i * 0.045, m.gunmetal)
  }
  // barrel and muzzle
  addCyl(g, 0.011, 0.011, 0.33, 0, 0.012, -0.47, m.steel, Math.PI / 2)
  addCyl(g, 0.021, 0.019, 0.075, 0, 0.012, -0.655, m.black, Math.PI / 2)
  addCyl(g, 0.032, 0.032, 0.2, 0, 0.012, -0.79, m.black, Math.PI / 2)
  addCyl(g, 0.035, 0.035, 0.016, 0, 0.012, -0.895, m.gunmetal, Math.PI / 2)
  addBox(g, 0.01, 0.055, 0.012, 0, 0.06, -0.52, m.black)
  // handguard vent holes
  for (let i = 0; i < 5; i++) {
    addBox(g, 0.074, 0.012, 0.032, 0, 0.026, -0.36 + i * 0.06, m.black)
    addBox(g, 0.074, 0.012, 0.032, 0, -0.005, -0.36 + i * 0.06, m.black)
  }
  // gas block
  addBox(g, 0.04, 0.04, 0.05, 0, 0.04, -0.36, m.gunmetal)
  // stock
  const stock = []
  stock.push(addBox(g, 0.052, 0.06, 0.18, 0, 0.006, 0.25, m.polymer))
  stock.push(addBox(g, 0.07, 0.12, 0.045, 0, -0.005, 0.35, m.polymer))
  stock.push(addBox(g, 0.05, 0.03, 0.13, 0, -0.035, 0.26, m.polymer))
  g.userData.stock = stock
  // pistol grip
  addBox(g, 0.052, 0.15, 0.07, 0, -0.105, 0.105, m.polymer, 0.28)
  addBox(g, 0.052, 0.06, 0.075, 0, -0.175, 0.125, m.polymer, 0.28)
  // trigger guard
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 5, 10, Math.PI), m.gunmetal)
  guard.position.set(0, -0.055, 0.04)
  guard.rotation.set(0, Math.PI / 2, Math.PI / 2)
  g.add(guard)
  addBox(g, 0.008, 0.03, 0.007, 0, -0.042, 0.035, m.steel)
  // magazine
  const mag = new THREE.Group()
  mag.position.set(0, -0.095, -0.045)
  mag.rotation.x = -0.12
  addBox(mag, 0.052, 0.16, 0.095, 0, -0.08, 0, m.polymer)
  addBox(mag, 0.058, 0.018, 0.1, 0, -0.16, 0, m.black)
  for (let i = 0; i < 4; i++) addBox(mag, 0.054, 0.006, 0.012, 0, -0.03 - i * 0.035, -0.05, m.black)
  g.add(mag)
  g.userData.mag = mag
  // bolt / ejection port
  addBox(g, 0.004, 0.028, 0.07, 0.04, 0.025, 0.03, m.steel)
  addBox(g, 0.012, 0.016, 0.03, 0.046, 0.035, 0.11, m.black)
  // optic: holographic sight
  const optic = new THREE.Group()
  optic.position.set(0, 0.095, -0.06)
  addBox(optic, 0.07, 0.03, 0.13, 0, 0, 0, m.gunmetal)
  addBox(optic, 0.08, 0.055, 0.05, 0, 0.04, -0.04, m.black)
  addBox(optic, 0.082, 0.055, 0.05, 0, 0.04, 0.05, m.black)
  addBox(optic, 0.055, 0.055, 0.15, 0, 0.042, 0.01, m.black)
  const lens = addBox(optic, 0.05, 0.045, 0.004, 0, 0.042, 0.085, m.glass)
  lens.renderOrder = 2
  const reticle = new THREE.Group()
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 10), m.red)
  dot.position.set(0, 0.042, 0.088)
  reticle.add(dot)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0008, 4, 22), m.red)
  ring.position.set(0, 0.042, 0.088)
  reticle.add(ring)
  optic.add(reticle)
  g.add(optic)
  g.userData.dot = reticle
  // rear iron sight
  addBox(g, 0.055, 0.025, 0.025, 0, 0.098, 0.11, m.black)
  // flashlight under handguard
  addCyl(g, 0.025, 0.025, 0.11, 0.0, -0.055, -0.37, m.black, Math.PI / 2)
  addCyl(g, 0.02, 0.02, 0.005, 0, -0.055, -0.43, new THREE.MeshBasicMaterial({ color: 0x2b332c }), Math.PI / 2)
  // laser box
  addBox(g, 0.035, 0.035, 0.08, 0.045, -0.015, -0.29, m.black)
  // tape / wear
  addBox(g, 0.078, 0.02, 0.1, 0, -0.01, -0.16, m.tape)
  // sling loop
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 4, 8), m.steel)
  loop.position.set(0, -0.045, 0.31)
  g.add(loop)
  // muzzle point
  g.userData.muzzle = new THREE.Object3D()
  g.userData.muzzle.position.set(0, 0.012, -0.7)
  g.add(g.userData.muzzle)
  return g
}

function buildPistol(m) {
  const g = new THREE.Group()
  addBox(g, 0.052, 0.058, 0.23, 0, 0.02, -0.08, m.gunmetal)
  addBox(g, 0.048, 0.045, 0.18, 0, -0.015, -0.09, m.polymer)
  addBox(g, 0.05, 0.13, 0.065, 0, -0.095, 0.015, m.polymer, 0.18)
  addBox(g, 0.052, 0.06, 0.07, 0, -0.17, 0.03, m.black, 0.18)
  // slide serrations
  for (let i = 0; i < 5; i++) addBox(g, 0.054, 0.028, 0.007, 0, 0.026, 0.005 + i * 0.014, m.black)
  addCyl(g, 0.013, 0.013, 0.1, 0, 0.02, -0.235, m.steel, Math.PI / 2)
  addCyl(g, 0.019, 0.018, 0.03, 0, 0.02, -0.285, m.black, Math.PI / 2)
  // sights
  addBox(g, 0.008, 0.015, 0.012, 0, 0.058, -0.17, m.black)
  addBox(g, 0.03, 0.012, 0.01, 0, 0.054, 0.02, m.black)
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 8), m.red)
  dot.position.set(0, 0.058, -0.177)
  g.add(dot)
  g.userData.dot = dot
  // trigger guard
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.005, 5, 10, Math.PI), m.gunmetal)
  guard.position.set(0, -0.055, -0.03)
  guard.rotation.set(0, Math.PI / 2, Math.PI / 2)
  g.add(guard)
  addBox(g, 0.007, 0.028, 0.006, 0, -0.042, -0.035, m.steel)
  // rail / light
  addBox(g, 0.045, 0.035, 0.09, 0, -0.03, -0.15, m.black)
  addCyl(g, 0.014, 0.014, 0.04, 0, -0.03, -0.2, m.steel, Math.PI / 2)
  g.userData.muzzle = new THREE.Object3D()
  g.userData.muzzle.position.set(0, 0.02, -0.3)
  g.add(g.userData.muzzle)
  g.userData.mag = null
  return g
}

function buildGloves(m, rifle = true) {
  const group = new THREE.Group()
  // right hand at grip
  const right = new THREE.Group()
  right.position.set(0.004, -0.105, 0.14)
  right.rotation.set(0.18, -0.08, -0.1)
  addBox(right, 0.068, 0.09, 0.08, 0, 0, 0, m.glove)
  addBox(right, 0.07, 0.026, 0.082, 0, 0.046, 0.006, m.glovePanel)
  for (let i = 0; i < 4; i++) {
    addBox(right, 0.013, 0.044, 0.021, -0.024 + i * 0.016, 0.044, -0.043, m.glove)
  }
  addBox(right, 0.022, 0.021, 0.06, -0.044, 0.014, -0.028, m.glove, 0, 0, 0.4)
  // sleeve
  addBox(right, 0.074, 0.23, 0.082, 0.034, -0.18, 0.065, m.sleeve, -0.72, 0, -0.28)
  addBox(right, 0.08, 0.038, 0.088, 0.022, -0.085, 0.04, m.sleevePatch, -0.28, 0, -0.24)
  group.add(right)

  // left hand under handguard
  const left = new THREE.Group()
  left.position.set(-0.005, -0.045, -0.27)
  left.rotation.set(-0.15, 0.12, 0.18)
  addBox(left, 0.08, 0.075, 0.095, 0, 0, 0, m.glove)
  addBox(left, 0.082, 0.02, 0.097, 0, -0.034, 0, m.glovePanel)
  for (let i = 0; i < 4; i++) {
    addBox(left, 0.016, 0.026, 0.06, -0.027 + i * 0.018, 0.045, 0.0, m.glove, -0.4)
  }
  addBox(left, 0.025, 0.024, 0.07, 0.05, 0.025, -0.02, m.glove, 0, 0, -0.35)
  addBox(left, 0.09, 0.22, 0.088, -0.045, -0.165, 0.09, m.sleeve, 0.62, 0.1, 0.3)
  addBox(left, 0.088, 0.038, 0.094, -0.028, -0.08, 0.05, m.sleevePatch, 0.24, 0.1, 0.26)
  group.add(left)
  if (!rifle) {
    right.position.set(0.0, -0.12, 0.03)
    left.position.set(-0.03, -0.12, 0.02)
    left.rotation.set(0.2, 0.15, -0.3)
  }
  group.userData.right = right
  group.userData.left = left
  return group
}

export class ViewModel {
  constructor(aspect) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(56, aspect, 0.01, 10)
    this.camera.position.set(0, 0, 0)
    this.scene.add(new THREE.HemisphereLight(0xd6e4f5, 0x2a2722, 2.0))
    const key = new THREE.DirectionalLight(0xe8eef6, 4.6)
    key.position.set(-1.4, 2.0, 1.2)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x7da7d8, 2.8)
    rim.position.set(2.0, 0.5, -2.0)
    this.scene.add(rim)
    const fill = new THREE.PointLight(0xffa45c, 0.8, 4, 2)
    fill.position.set(0.6, -0.4, 0.6)
    this.scene.add(fill)

    this.mats = makeMats()
    this.rifle = buildRifle(this.mats)
    this.pistol = buildPistol(this.mats)
    this.rifle.scale.setScalar(0.75)
    this.pistol.scale.setScalar(0.84)
    this.rifleGloves = buildGloves(this.mats, true)
    this.pistolGloves = buildGloves(this.mats, false)
    this.rifle.add(this.rifleGloves)
    this.pistol.add(this.pistolGloves)
    this.scene.add(this.rifle)
    this.scene.add(this.pistol)
    this.pistol.visible = false

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture(), color: 0xffd08a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }))
    this.flash.scale.set(0.4, 0.4, 1)
    this.scene.add(this.flash)
    this.flashLight = new THREE.PointLight(0xffb45e, 0, 3, 2)
    this.scene.add(this.flashLight)

    this.active = 'rifle'
    this.adsBlend = 0
    this.kick = 0
    this.kickRot = 0
    this.flashTimer = 0
    this.reloadT = 0
    this.reloading = false
    this.switchT = 0
    this.bob = 0
    this.swayX = 0
    this.swayY = 0
    this.time = 0
    this.shells = []
    for (let i = 0; i < 7; i++) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.028, 6), new THREE.MeshStandardMaterial({ color: 0xb08a42, roughness: 0.32, metalness: 0.85 }))
      shell.rotation.x = Math.PI / 2
      shell.visible = false
      this.scene.add(shell)
      this.shells.push({ mesh: shell, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 })
    }
    this.shellIndex = 0
    this.recoilRot = 0
    this.recoilZ = 0
    this.muzzleWorld = new THREE.Vector3()
    this.update(0, {
      ads: 0, moveSpeed: 0, sprint: 0, crouch: 0, swayX: 0, swayY: 0,
      reloadT: 0, reloading: false,
    })
  }

  setAspect(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  setActive(name) {
    if (name === this.active) return
    this.active = name
    this.switchT = 1
    this.rifle.visible = name === 'rifle'
    this.pistol.visible = name === 'pistol'
  }

  fire() {
    this.flashTimer = 0.055
    this.kick = 1
    this.kickRot = rand(0.6, 1.0)
    const gun = this.current()
    if (this.flash.parent) this.flash.parent.remove(this.flash)
    gun.add(this.flash)
    this.flash.position.copy(gun.userData.muzzle.position)
    this.flash.position.z -= 0.02
    this.flash.material.rotation = rand(0, 6.28)
    this.flashLight.position.copy(this.flash.position).add(gun.position)
    this.flashLight.intensity = 5
    // eject shell
    const s = this.shells[this.shellIndex++ % this.shells.length]
    const muzzle = this.current().userData.muzzle.position
    s.mesh.position.set(0.06, 0.04, -0.1)
    s.mesh.visible = true
    s.vel.set(rand(0.55, 0.9), rand(0.35, 0.7), rand(0.15, 0.35))
    s.spin.set(rand(4, 10), rand(4, 12), rand(2, 6))
    s.life = 1.4
  }

  current() {
    return this.active === 'rifle' ? this.rifle : this.pistol
  }

  setReloading(active, duration) {
    this.reloading = active
    this.reloadT = active ? duration : 0
    this.reloadDuration = duration
  }

  update(dt, params) {
    this.time += dt
    this.adsBlend = damp(this.adsBlend, params.ads, 12, dt)
    this.kick = damp(this.kick, 0, 13, dt)
    this.kickRot = damp(this.kickRot, 0, 11, dt)
    this.swayX = damp(this.swayX, params.swayX || 0, 10, dt)
    this.swayY = damp(this.swayY, params.swayY || 0, 10, dt)
    this.bob += dt * (3.2 + params.moveSpeed * 1.15)
    this.switchT = damp(this.switchT, 0, 9, dt)
    this.flashTimer -= dt
    this.flash.material.opacity = this.flashTimer > 0 ? rand(0.75, 1) : 0
    this.flash.scale.setScalar(rand(0.28, 0.5) + (this.flashTimer > 0 ? 0.1 : 0))
    this.flashLight.intensity = this.flashTimer > 0 ? rand(3.5, 6.5) : 0

    for (const s of this.shells) {
      if (s.life > 0) {
        s.life -= dt
        s.vel.y -= 2.8 * dt
        s.mesh.position.addScaledVector(s.vel, dt)
        s.mesh.rotation.x += s.spin.x * dt
        s.mesh.rotation.y += s.spin.y * dt
        s.mesh.rotation.z += s.spin.z * dt
        if (s.life <= 0) s.mesh.visible = false
      }
    }

    const gun = this.current()
    const isRifle = this.active === 'rifle'
    const hip = isRifle ? new THREE.Vector3(0.215, -0.235, -1.12) : new THREE.Vector3(0.2, -0.22, -0.9)
    const adsPos = isRifle ? new THREE.Vector3(0.0, -0.102, -0.88) : new THREE.Vector3(0.0, -0.075, -0.74)
    const base = hip.clone().lerp(adsPos, this.adsBlend)
    const bobAmt = (params.moveSpeed || 0) * 0.0045
    const bobX = Math.sin(this.bob) * bobAmt
    const bobY = Math.abs(Math.cos(this.bob)) * bobAmt * 0.8
    const swayScale = 1 - this.adsBlend * 0.72
    base.x += bobX + this.swayX * 0.0032 * swayScale
    base.y += bobY + this.swayY * 0.0022 * swayScale
    base.y -= (params.sprint || 0) * 0.065
    base.z += (params.sprint || 0) * 0.06
    base.y -= (params.crouch || 0) * 0.012

    let reloadDrop = 0
    if (params.reloading) {
      const p = 1 - params.reloadT / Math.max(0.01, params.reloadDuration)
      reloadDrop = Math.sin(clamp(p, 0, 1) * Math.PI)
    }
    base.y -= reloadDrop * 0.15
    base.z += reloadDrop * 0.04

    const switchDrop = this.switchT * 0.22
    base.y -= switchDrop

    gun.position.copy(base)
    gun.position.z += this.kick * 0.055
    gun.position.y += this.kick * 0.007

    const rotBaseX = this.adsBlend * 0.0
    gun.rotation.x = rotBaseX + this.kick * 0.055 * this.kickRot - reloadDrop * 0.42 + this.switchT * 0.4 + (params.sprint || 0) * 0.13
    gun.rotation.y = (1 - this.adsBlend) * (isRifle ? 0.235 : 0.12) + this.swayX * 0.0015
    gun.rotation.z = this.swayX * 0.0018 + reloadDrop * 0.35 + (params.crouch || 0) * 0.01
    // left hand on handguard moves during reload
    const gloves = isRifle ? this.rifleGloves : this.pistolGloves
    gloves.userData.left.position.y = (isRifle ? -0.045 : -0.12) - reloadDrop * 0.08
    gloves.userData.left.rotation.z = (isRifle ? 0.18 : -0.3) + reloadDrop * 0.4
    // magazine drops
    if (isRifle && this.rifle.userData.mag) {
      this.rifle.userData.mag.position.y = -0.095 - reloadDrop * 0.13
      this.rifle.userData.mag.rotation.z = reloadDrop * 0.25
    }
    // stock tucks out of frame while aiming
    if (isRifle && this.rifle.userData.stock) {
      for (const part of this.rifle.userData.stock) part.visible = this.adsBlend < 0.55
    }
    // red dot only in ADS
    if (gun.userData.dot) {
      gun.userData.dot.visible = this.adsBlend > 0.35
    }

    // weapon camera matches nothing; viewmodel anchored to origin
  }

  getMuzzleWorld(camera, out = this.muzzleWorld) {
    const local = this.current().userData.muzzle.position.clone()
    const gun = this.current()
    gun.updateMatrixWorld()
    // Convert viewmodel-local muzzle to camera-space, then world.
    const p = local.applyMatrix4(gun.matrixWorld)
    out.copy(p).applyMatrix4(camera.matrixWorld)
    return out
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material.dispose()
      }
    })
  }
}
