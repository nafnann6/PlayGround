import * as THREE from '../vendor/three.module.js'
import {
  clamp, rand, randInt, chance, damp, dampAngle, shortestAngle, segmentBlocked, raySphere, easeOutCubic,
} from './utils.js'

const FORWARD = new THREE.Vector3(0, 0, -1)
const tempV = new THREE.Vector3()
const tempV2 = new THREE.Vector3()

function makeMaterialSet() {
  return {
    cloth: new THREE.MeshStandardMaterial({ color: 0x1b2022, roughness: 0.92, metalness: 0.02 }),
    armor: new THREE.MeshStandardMaterial({ color: 0x2c3336, roughness: 0.65, metalness: 0.25 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0e1112, roughness: 0.8, metalness: 0.3 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x6e4c38, roughness: 0.85, metalness: 0.0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3f4649, roughness: 0.42, metalness: 0.75 }),
    reflect: new THREE.MeshStandardMaterial({ color: 0xc2c8bd, roughness: 0.45, metalness: 0.08, emissive: 0x686c58, emissiveIntensity: 1.25 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x223133, roughness: 0.2, metalness: 0.9, emissive: 0x050908 }),
  }
}

function addBoxMesh(parent, w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

export class Enemy {
  constructor(scene, position, opts = {}) {
    this.scene = scene
    this.home = position.clone()
    this.position = position.clone()
    this.heavy = !!opts.heavy
    this.maxHealth = this.heavy ? 165 : 100
    this.health = this.maxHealth
    this.alive = true
    this.state = 'patrol'
    this.yaw = opts.yaw ?? rand(0, Math.PI * 2)
    this.alertness = 0
    this.lastSeen = new THREE.Vector3()
    this.searchTimer = 0
    this.patrolTarget = this.randomPatrol()
    this.patrolWait = rand(0.5, 3)
    this.fireCooldown = rand(1.0, 3.0)
    this.burst = 0
    this.burstTimer = 0
    this.strafeDir = chance(0.5) ? 1 : -1
    this.strafeTimer = rand(1, 3)
    this.flash = 0
    this.deathT = 0
    this.deadTime = 0
    this.walkPhase = rand(0, 10)
    this.animSpeed = 0
    this.hitPart = ''
    this.muzzleTimer = 0
    this.canSeePlayer = false
    this.distanceToPlayer = 99
    this.aimBlend = 0
    this.shotsFired = 0
    this.deathBlood = false
    this.radius = this.heavy ? 0.38 : 0.33
    this.build()
    this.root.position.copy(this.position)
    this.root.rotation.y = this.yaw
    scene.add(this.root)
  }

  randomPatrol() {
    return new THREE.Vector3(
      this.home.x + rand(-3.4, 3.4),
      0,
      this.home.z + rand(-3.4, 3.4),
    )
  }

  build() {
    const mats = makeMaterialSet()
    this.mats = mats
    const root = new THREE.Group()
    root.rotation.order = 'YXZ'
    const visual = new THREE.Group()
    root.add(visual)
    this.root = root
    this.visual = visual

    const scale = this.heavy ? 1.1 : 1.0
    visual.scale.setScalar(scale)

    // legs
    this.legL = new THREE.Group()
    this.legL.position.set(-0.13, 0.92, 0)
    visual.add(this.legL)
    this.legR = new THREE.Group()
    this.legR.position.set(0.13, 0.92, 0)
    visual.add(this.legR)
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]]) {
      addBoxMesh(leg, 0.21, 0.55, 0.23, 0, -0.27, 0, mats.cloth)
      addBoxMesh(leg, 0.18, 0.38, 0.2, 0, -0.72, 0.01, mats.dark)
      addBoxMesh(leg, 0.22, 0.13, 0.34, 0, -0.93, -0.06, mats.dark)
      // knee pad
      addBoxMesh(leg, 0.2, 0.16, 0.06, 0, -0.55, -0.12, mats.armor)
      // thigh pouch
      addBoxMesh(leg, 0.11, 0.18, 0.13, side * 0.14, -0.34, 0.02, mats.armor)
    }

    // hips / belt
    addBoxMesh(visual, 0.43, 0.25, 0.28, 0, 0.96, 0, mats.dark)
    addBoxMesh(visual, 0.47, 0.08, 0.31, 0, 1.08, 0, mats.armor)
    for (let i = 0; i < 3; i++) {
      addBoxMesh(visual, 0.1, 0.12, 0.08, -0.14 + i * 0.14, 1.0, -0.15, mats.armor)
    }

    // torso
    this.torso = new THREE.Group()
    this.torso.position.y = 1.1
    visual.add(this.torso)
    addBoxMesh(this.torso, 0.49, 0.62, 0.29, 0, 0.3, 0, mats.cloth)
    // plate carrier
    addBoxMesh(this.torso, 0.54, 0.43, 0.34, 0, 0.34, 0, mats.armor)
    addBoxMesh(this.torso, 0.4, 0.18, 0.05, 0, 0.36, -0.19, mats.dark)
    // pouches
    for (let i = 0; i < 3; i++) {
      addBoxMesh(this.torso, 0.11, 0.14, 0.07, -0.15 + i * 0.15, 0.16, -0.19, mats.dark)
    }
    // reflective strips
    addBoxMesh(this.torso, 0.5, 0.035, 0.36, 0, 0.5, 0, mats.reflect)
    addBoxMesh(this.torso, 0.1, 0.3, 0.04, -0.2, 0.34, -0.2, mats.reflect)
    addBoxMesh(this.torso, 0.1, 0.3, 0.04, 0.2, 0.34, -0.2, mats.reflect)
    // back pack
    addBoxMesh(this.torso, 0.4, 0.46, 0.2, 0, 0.34, 0.23, mats.dark)
    addBoxMesh(this.torso, 0.12, 0.1, 0.03, 0.12, 0.47, 0.34, mats.reflect)

    // head
    this.head = new THREE.Group()
    this.head.position.set(0, 0.72, 0)
    this.torso.add(this.head)
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), mats.skin)
    headMesh.scale.set(1, 1.12, 0.94)
    this.head.add(headMesh)
    // balaclava
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), mats.dark)
    mask.scale.set(1, 0.72, 0.98)
    mask.position.set(0, 0.02, 0.0)
    this.head.add(mask)
    // helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.armor)
    helmet.position.y = 0.07
    helmet.scale.set(1.03, 1.0, 1.06)
    this.head.add(helmet)
    // helmet rail / NVG mount
    addBoxMesh(this.head, 0.08, 0.08, 0.06, 0, 0.14, -0.17, mats.metal)
    // goggles / eyes
    addBoxMesh(this.head, 0.21, 0.065, 0.04, 0, 0.045, -0.15, mats.lens)
    addBoxMesh(this.head, 0.22, 0.02, 0.03, 0, 0.085, -0.16, mats.reflect)
    // headset
    for (const sx of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 8), mats.dark)
      cup.rotation.z = Math.PI / 2
      cup.position.set(sx * 0.165, 0.03, 0.01)
      this.head.add(cup)
    }

    // arms
    this.armL = new THREE.Group()
    this.armL.position.set(-0.31, 1.64, 0)
    visual.add(this.armL)
    this.armR = new THREE.Group()
    this.armR.position.set(0.31, 1.64, 0)
    visual.add(this.armR)
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
      addBoxMesh(arm, 0.17, 0.42, 0.19, 0, -0.19, 0, mats.cloth)
      addBoxMesh(arm, 0.13, 0.34, 0.15, 0, -0.52, -0.06, mats.dark)
      addBoxMesh(arm, 0.15, 0.16, 0.15, 0, -0.72, -0.11, mats.dark)
      addBoxMesh(arm, 0.18, 0.06, 0.2, 0, -0.63, -0.12, mats.armor)
      addBoxMesh(arm, 0.16, 0.035, 0.21, 0, -0.36, -0.1, mats.reflect)
    }

    // rifle
    this.rifle = new THREE.Group()
    this.rifle.position.set(0.16, 1.42, -0.28)
    visual.add(this.rifle)
    addBoxMesh(this.rifle, 0.075, 0.11, 0.54, 0, 0, 0, mats.dark)
    addBoxMesh(this.rifle, 0.06, 0.07, 0.4, 0, 0.02, -0.4, mats.metal)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.34, 6), mats.metal)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.02, -0.66)
    this.rifle.add(barrel)
    addBoxMesh(this.rifle, 0.05, 0.18, 0.08, 0, -0.12, -0.02, mats.dark)
    addBoxMesh(this.rifle, 0.05, 0.22, 0.1, 0, -0.15, -0.14, mats.dark)
    addBoxMesh(this.rifle, 0.07, 0.1, 0.2, 0, -0.02, 0.28, mats.dark)
    addBoxMesh(this.rifle, 0.055, 0.06, 0.12, 0, 0.11, -0.05, mats.metal)
    // muzzle flash sprite
    this.muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeFlashTexture(), color: 0xffc36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.muzzleFlash.position.set(0, 0.02, -0.86)
    this.muzzleFlash.scale.set(0.7, 0.7, 1)
    this.rifle.add(this.muzzleFlash)

    // arm pose (holding rifle)
    this.armR.rotation.set(-0.9, 0, -0.15)
    this.armL.rotation.set(-1.05, 0, 0.55)

    // IR strobe / shoulder LED
    this.led = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeFlashTexture(), color: 0xff4b28, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.led.position.set(0.17, 1.5, -0.17)
    this.led.scale.set(0.17, 0.17, 1)
    visual.add(this.led)
    this.ledPhase = rand(0, 6.28)

    // contact shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.4),
      new THREE.MeshBasicMaterial({
        map: makeShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.015
    root.add(shadow)

    // blood pool (hidden)
    this.blood = new THREE.Mesh(
      new THREE.CircleGeometry(0.65, 20),
      new THREE.MeshBasicMaterial({ color: 0x240406, transparent: true, opacity: 0, depthWrite: false }),
    )
    this.blood.rotation.x = -Math.PI / 2
    this.blood.position.y = 0.02
    root.add(this.blood)

    this.flashMats = [mats.cloth, mats.armor, mats.dark, mats.skin, mats.metal, mats.reflect]
    this.flashMats.forEach((m) => { m.userData.baseEmissive = m.emissive ? m.emissive.getHex() : 0 })
  }

  eyePosition(out = new THREE.Vector3()) {
    return out.set(this.position.x, 1.64 * (this.heavy ? 1.1 : 1), this.position.z)
  }

  muzzlePosition(out = new THREE.Vector3()) {
    const s = this.heavy ? 1.1 : 1
    const localX = 0.16 * s
    const localZ = -0.28 - 0.86
    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    return out.set(
      this.position.x + localX * cos + localZ * sin,
      1.42 * s,
      this.position.z - localX * sin + localZ * cos,
    )
  }

  takeDamage(amount, part, point) {
    if (!this.alive) return false
    this.health -= amount
    this.flash = 0.09
    this.hitPart = part
    this.alertness = 1
    this.state = 'engage'
    this.lastSeen.set(point.x, 0, point.z)
    this.fireCooldown = Math.min(this.fireCooldown, 0.4)
    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  die() {
    if (!this.alive) return
    this.alive = false
    this.state = 'dead'
    this.deathT = 0
    this.deadTime = 0
    this.burst = 0
    this.muzzleFlash.material.opacity = 0
    this.blood.material.opacity = 0.0
  }

  alert(sourcePos, strength = 1) {
    if (!this.alive || this.state === 'dead') return
    this.lastSeen.copy(sourcePos)
    this.alertness = Math.max(this.alertness, strength)
    if (this.state === 'patrol') {
      this.state = 'alert'
      this.searchTimer = 10
      this.fireCooldown = Math.max(this.fireCooldown, 0.7)
    }
  }

  update(dt, ctx) {
    if (this.state === 'dead') {
      this.updateDeath(dt)
      return
    }

    const player = ctx.player
    const eye = this.eyePosition(tempV)
    const playerEye = ctx.playerEye
    const toPlayer = tempV2.subVectors(playerEye, eye)
    const dist = toPlayer.length()
    this.distanceToPlayer = dist
    const los = !segmentBlocked(eye, playerEye, ctx.colliders)
    const dirToPlayer = toPlayer.clone().normalize()
    const fwdX = -Math.sin(this.yaw)
    const fwdZ = -Math.cos(this.yaw)
    const facingDot = fwdX * dirToPlayer.x + fwdZ * dirToPlayer.z
    const inCone = facingDot > 0.25 || dist < 5.5
    const sees = los && dist < 30 && inCone
    this.canSeePlayer = sees

    if (sees) {
      this.lastSeen.copy(player.position)
      this.alertness = clamp(this.alertness + dt * (dist < 10 ? 4 : 2.2), 0, 1)
      if (this.alertness >= 0.35) this.state = 'engage'
      else if (this.state === 'patrol') this.state = 'alert'
    } else {
      this.alertness = clamp(this.alertness - dt * 0.32, 0, 1)
    }

    if (player.dead) {
      this.state = 'patrol'
      this.burst = 0
    }

    let moveX = 0
    let moveZ = 0
    let speed = 0
    const facingTarget = this.state === 'engage' || this.state === 'alert' ? this.lastSeen : this.patrolTarget

    if (this.state === 'patrol') {
      if (this.patrolWait > 0) {
        this.patrolWait -= dt
      } else {
        const d = Math.hypot(this.patrolTarget.x - this.position.x, this.patrolTarget.z - this.position.z)
        if (d < 0.7) {
          this.patrolTarget = this.randomPatrol()
          this.patrolWait = rand(1.2, 4.5)
          this.yaw += rand(-0.7, 0.7)
        } else {
          moveX = (this.patrolTarget.x - this.position.x) / d
          moveZ = (this.patrolTarget.z - this.position.z) / d
          speed = 1.35
          this.yaw = dampAngle(this.yaw, Math.atan2(-moveX, -moveZ), 4, dt)
        }
      }
      if (!sees && this.alertness > 0.01) {
        this.yaw = dampAngle(this.yaw, Math.atan2(-dirToPlayer.x, -dirToPlayer.z), 2, dt)
      }
    } else if (this.state === 'alert') {
      this.searchTimer -= dt
      const d = Math.hypot(this.lastSeen.x - this.position.x, this.lastSeen.z - this.position.z)
      if (d > 1.0) {
        moveX = (this.lastSeen.x - this.position.x) / d
        moveZ = (this.lastSeen.z - this.position.z) / d
        speed = 2.0
      }
      this.yaw = dampAngle(this.yaw, Math.atan2(-dirToPlayer.x, -dirToPlayer.z), 3.5, dt)
      if (sees) this.state = 'engage'
      if (this.searchTimer <= 0) {
        this.state = 'patrol'
        this.patrolWait = rand(0.8, 2)
      }
    } else if (this.state === 'engage') {
      this.yaw = dampAngle(this.yaw, Math.atan2(-dirToPlayer.x, -dirToPlayer.z), 7, dt)
      if (sees) {
        this.strafeTimer -= dt
        if (this.strafeTimer <= 0) {
          this.strafeDir *= -1
          this.strafeTimer = rand(1.0, 2.6)
        }
        if (dist > 9.5) {
          moveX = dirToPlayer.x
          moveZ = dirToPlayer.z
          speed = 2.5
        } else if (dist < 3.7) {
          moveX = -dirToPlayer.x
          moveZ = -dirToPlayer.z
          speed = 1.7
        } else {
          moveX = dirToPlayer.z * this.strafeDir
          moveZ = -dirToPlayer.x * this.strafeDir
          speed = 1.25
        }
        // slight approach
        moveX += dirToPlayer.x * 0.18
        moveZ += dirToPlayer.z * 0.18
      } else {
        this.searchTimer -= dt
        const d = Math.hypot(this.lastSeen.x - this.position.x, this.lastSeen.z - this.position.z)
        if (d > 0.9) {
          moveX = (this.lastSeen.x - this.position.x) / d
          moveZ = (this.lastSeen.z - this.position.z) / d
          speed = 2.3
        } else {
          this.searchTimer -= dt * 2
        }
        if (this.searchTimer <= 0) {
          this.state = 'patrol'
          this.patrolWait = rand(0.5, 1.5)
        }
      }

      // shooting
      if (sees && !player.dead) {
        if (this.burst <= 0 && this.fireCooldown <= 0) {
          this.burst = this.heavy ? randInt(4, 7) : randInt(3, 5)
          this.burstTimer = 0.05
        }
        if (this.burst > 0) {
          this.burstTimer -= dt
          if (this.burstTimer <= 0) {
            this.shoot(ctx, dist)
            this.burst--
            this.burstTimer = rand(0.095, 0.145)
            if (this.burst <= 0) {
              this.fireCooldown = rand(1.05, 2.2) * (this.heavy ? 1.35 : 1)
            }
          }
        }
      } else {
        this.fireCooldown = Math.max(this.fireCooldown, 0.35)
      }
    }

    this.fireCooldown -= dt
    this.strafeTimer -= dt * 0.1

    // steering fallback when blocked
    if (speed > 0) {
      const len = Math.hypot(moveX, moveZ)
      if (len > 0.001) {
        moveX /= len
        moveZ /= len
        let stepX = moveX * speed * dt
        let stepZ = moveZ * speed * dt
        const p = ctx.world.resolveCircle(this.position.x + stepX, this.position.z + stepZ, this.radius, 0, 1.9)
        const moved = Math.hypot(p.x - this.position.x, p.z - this.position.z)
        this.position.x = p.x
        this.position.z = p.z
        // if barely moved, slide to a perpendicular direction
        if (moved < speed * dt * 0.35) {
          const sx = -moveZ * speed * dt
          const sz = moveX * speed * dt
          const p2 = ctx.world.resolveCircle(this.position.x + sx, this.position.z + sz, this.radius, 0, 1.9)
          this.position.x = p2.x
          this.position.z = p2.z
        }
        this.animSpeed = damp(this.animSpeed, speed / 2.5, 6, dt)
        this.walkPhase += dt * (5.2 + speed * 1.2)
      }
    } else {
      this.animSpeed = damp(this.animSpeed, 0, 8, dt)
    }

    // separation from other enemies
    for (const other of ctx.enemies) {
      if (other === this || !other.alive) continue
      const dx = this.position.x - other.position.x
      const dz = this.position.z - other.position.z
      const d = Math.hypot(dx, dz)
      if (d > 0.001 && d < 0.9) {
        this.position.x += (dx / d) * (0.9 - d) * 0.5
        this.position.z += (dz / d) * (0.9 - d) * 0.5
      }
    }

    // animation
    this.root.position.x = this.position.x
    this.root.position.z = this.position.z
    this.root.rotation.y = this.yaw
    const swing = Math.sin(this.walkPhase) * 0.62 * this.animSpeed
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -1.05 - swing * 0.15
    this.armR.rotation.x = -0.9 + swing * 0.06
    this.torso.position.y = 1.1 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.018 * this.animSpeed
    this.torso.rotation.z = Math.sin(this.walkPhase) * 0.02 * this.animSpeed
    // aim blend
    const aiming = this.state === 'engage' ? 1 : 0
    this.aimBlend = damp(this.aimBlend, aiming, 5, dt)
    this.rifle.position.y = 1.42 - this.aimBlend * 0.07
    this.rifle.rotation.x = -this.aimBlend * 0.05

    // hit flash
    if (this.flash > 0) {
      this.flash -= dt
      const on = this.flash > 0
      for (const m of this.flashMats) {
        if (!m.emissive) continue
        if (on) {
          m.emissive.setHex(0x5a0f0f)
          m.emissiveIntensity = 1.8
        } else {
          m.emissive.setHex(m.userData.baseEmissive || 0x000000)
          m.emissiveIntensity = 1
        }
      }
    }

    // IR strobe
    if (this.led) {
      this.led.material.opacity = 0.55 + 0.32 * Math.sin(ctx.time * 3.2 + this.ledPhase)
    }

    // muzzle flash
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt
      this.muzzleFlash.material.opacity = this.muzzleTimer > 0 ? rand(0.65, 1) : 0
      this.muzzleFlash.material.rotation = rand(0, 6.28)
      const s = rand(0.55, 0.85)
      this.muzzleFlash.scale.set(s, s, 1)
    } else {
      this.muzzleFlash.material.opacity = 0
    }
  }

  shoot(ctx, dist) {
    const muzzle = this.muzzlePosition()
    const playerEye = ctx.playerEye
    const accuracy = this.heavy ? 0.72 : 0.62
    const movePenalty = ctx.player.moving ? 0.16 : 0
    const crouchBonus = ctx.player.crouching ? 0.18 : 0
    const hitChance = clamp(accuracy - dist * 0.013 - movePenalty + crouchBonus, 0.18, 0.7)
    const hit = Math.random() < hitChance
    let end = new THREE.Vector3()
    if (hit) {
      end.copy(playerEye)
      const dmg = this.heavy ? rand(9, 14) : rand(5.5, 10)
      ctx.onPlayerHit(dmg, this)
    } else {
      // near miss
      const side = new THREE.Vector3(rand(-1, 1), rand(-0.45, 0.6), rand(-1, 1)).normalize()
      const missDist = rand(0.45, 2.2)
      end.copy(playerEye).addScaledVector(side, missDist)
      // clamp tracer to world
      const dir = end.clone().sub(muzzle).normalize()
      const worldHit = ctx.world.raycast(muzzle, dir, 40)
      if (worldHit.dist < muzzle.distanceTo(end)) end = worldHit.point
      ctx.onNearMiss?.(muzzle, end, this)
    }
    this.shotsFired++
    this.muzzleTimer = 0.055
    this.muzzleFlash.material.opacity = 1
    ctx.audio.enemyShot(this.position, dist)
    ctx.onEnemyShot?.(muzzle, end, this)
  }

  updateDeath(dt) {
    this.deadTime += dt
    this.deathT = Math.min(1, this.deathT + dt * 2.8)
    const t = easeOutCubic(this.deathT)
    this.visual.rotation.x = -1.47 * t
    this.visual.position.y = -0.03 * t
    this.visual.position.z = 0.22 * t
    this.blood.material.opacity = Math.min(0.82, this.deadTime * 0.9)
    this.blood.scale.setScalar(0.7 + Math.min(0.6, this.deadTime * 0.25))
    if (!this.deathBlood && this.deadTime > 0.25) {
      this.deathBlood = true
      // callback handled by manager via pool? Manager polls in update
    }
  }

  dispose() {
    this.scene.remove(this.root)
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material.dispose()
      }
    })
  }
}

let flashTex = null
function makeFlashTexture() {
  if (flashTex) return flashTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,235,1)')
  g.addColorStop(0.2, 'rgba(255,220,140,0.95)')
  g.addColorStop(0.55, 'rgba(255,130,40,0.38)')
  g.addColorStop(1, 'rgba(255,70,10,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  // spikes
  ctx.strokeStyle = 'rgba(255,220,160,0.65)'
  ctx.lineWidth = 4
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(64, 64)
    ctx.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60)
    ctx.stroke()
  }
  flashTex = new THREE.CanvasTexture(c)
  return flashTex
}

let shadowTex = null
function makeShadowTexture() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.75)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.4)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  shadowTex = new THREE.CanvasTexture(c)
  return shadowTex
}

export class EnemyManager {
  constructor(scene, world, audio, callbacks = {}) {
    this.scene = scene
    this.world = world
    this.audio = audio
    this.callbacks = callbacks
    this.enemies = []
    this.total = 0
    this.kills = 0
    this.deathNotified = new WeakSet()
    this.spawn()
  }

  spawn() {
    const specs = [
      [-16.6, 21.2, 0.4, false],
      [13.8, 23.2, -2.4, false],
      [-20.2, 7.1, 0.1, false],
      [17.0, 7.4, -0.5, false],
      [-19.1, -1.8, 0.4, false],
      [6.9, 3.4, -2.7, false],
      [-7.8, -11.7, 0.5, false],
      [11.3, -11.0, -2.0, false],
      [2.0, -20.5, 0.0, true],
      [19.8, -22.2, -0.8, false],
      [-20.8, -21.6, 1.2, false],
    ]
    this.total = specs.length
    this.kills = 0
    for (const [x, z, yaw, heavy] of specs) {
      const e = new Enemy(this.scene, new THREE.Vector3(x, 0, z), { yaw, heavy })
      this.enemies.push(e)
    }
  }

  reset() {
    for (const e of this.enemies) e.dispose()
    this.enemies = []
    this.deathNotified = new WeakSet()
    this.spawn()
  }

  get aliveCount() {
    return this.enemies.filter((e) => e.alive).length
  }

  alertAll(sourcePos, radius = 34) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      const d = e.position.distanceTo(sourcePos)
      if (d < radius) e.alert(sourcePos, clamp(1 - d / radius, 0.35, 1))
    }
  }

  update(dt, ctx) {
    for (const e of this.enemies) {
      e.update(dt, {
        player: ctx.player,
        playerEye: ctx.playerEye,
        colliders: this.world.colliders,
        world: this.world,
        enemies: this.enemies,
        audio: this.audio,
        onPlayerHit: ctx.onPlayerHit,
        onEnemyShot: ctx.onEnemyShot,
        onNearMiss: ctx.onNearMiss,
        time: ctx.time,
      })
      if (!e.alive && !this.deathNotified.has(e)) {
        this.deathNotified.add(e)
        this.kills++
        this.callbacks.onKill?.(e)
        this.callbacks.onBlood?.(e.position)
      }
    }
  }

  idleUpdate(dt) {
    for (const e of this.enemies) {
      if (!e.alive) {
        e.updateDeath(dt)
        continue
      }
      e.walkPhase += dt * 1.4
      e.legL.rotation.x = Math.sin(e.walkPhase) * 0.05
      e.legR.rotation.x = -Math.sin(e.walkPhase) * 0.05
      e.torso.position.y = 1.1 + Math.sin(e.walkPhase * 0.7) * 0.008
      e.head.rotation.y = Math.sin(e.walkPhase * 0.22 + e.home.x) * 0.22
      e.root.rotation.y = e.yaw + Math.sin(e.walkPhase * 0.13 + e.home.z) * 0.08
      if (e.muzzleTimer > 0) e.muzzleTimer -= dt
    }
  }

  raycast(origin, dir, maxDist) {
    let best = null
    for (const e of this.enemies) {
      if (!e.alive) continue
      const s = e.heavy ? 1.1 : 1.0
      const head = tempV.set(e.position.x, 1.82 * s, e.position.z)
      const torso = tempV2.set(e.position.x, 1.28 * s, e.position.z)
      const legs = new THREE.Vector3(e.position.x, 0.62, e.position.z)
      const parts = [
        ['head', head, 0.185 * s],
        ['torso', torso, 0.37 * s],
        ['legs', legs, 0.31 * s],
      ]
      for (const [part, center, radius] of parts) {
        const t = raySphere(origin, dir, center, radius)
        if (t !== null && t > 0.1 && t < maxDist && (!best || t < best.dist)) {
          best = {
            enemy: e,
            part,
            dist: t,
            point: new THREE.Vector3().copy(origin).addScaledVector(dir, t),
          }
        }
      }
    }
    return best
  }
}
