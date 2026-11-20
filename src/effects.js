import * as THREE from '../vendor/three.module.js'
import { rand, randInt } from './utils.js'

export class Effects {
  constructor(scene, textures) {
    this.scene = scene
    this.textures = textures
    this.sparkCount = 700
    this.sparkGeo = new THREE.BufferGeometry()
    this.sparkPos = new Float32Array(this.sparkCount * 3)
    this.sparkCol = new Float32Array(this.sparkCount * 3)
    this.sparkVel = new Float32Array(this.sparkCount * 3)
    this.sparkLife = new Float32Array(this.sparkCount)
    this.sparkMax = new Float32Array(this.sparkCount)
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3))
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3))
    for (let i = 0; i < this.sparkCount; i++) this.sparkPos[i * 3 + 1] = -100
    this.sparkMat = new THREE.PointsMaterial({
      size: 0.035, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    })
    this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat)
    this.sparks.frustumCulled = false
    scene.add(this.sparks)
    this.sparkIndex = 0

    // Blood droplets (non additive)
    this.bloodCount = 320
    this.bloodGeo = new THREE.BufferGeometry()
    this.bloodPos = new Float32Array(this.bloodCount * 3)
    this.bloodCol = new Float32Array(this.bloodCount * 3)
    this.bloodVel = new Float32Array(this.bloodCount * 3)
    this.bloodLife = new Float32Array(this.bloodCount)
    this.bloodMax = new Float32Array(this.bloodCount)
    this.bloodGeo.setAttribute('position', new THREE.BufferAttribute(this.bloodPos, 3))
    this.bloodGeo.setAttribute('color', new THREE.BufferAttribute(this.bloodCol, 3))
    for (let i = 0; i < this.bloodCount; i++) this.bloodPos[i * 3 + 1] = -100
    this.bloodMat = new THREE.PointsMaterial({
      size: 0.055, vertexColors: true, transparent: true, opacity: 0.9,
      depthWrite: false, sizeAttenuation: true,
    })
    this.blood = new THREE.Points(this.bloodGeo, this.bloodMat)
    this.blood.frustumCulled = false
    scene.add(this.blood)
    this.bloodIndex = 0

    // Tracers
    this.tracers = []
    for (let i = 0; i < 22; i++) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const mat = new THREE.LineBasicMaterial({
        color: 0xffd08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const line = new THREE.Line(geo, mat)
      line.frustumCulled = false
      line.visible = false
      scene.add(line)
      this.tracers.push({ line, life: 0, max: 0.09 })
    }
    this.tracerIndex = 0

    // Smoke puffs
    this.smoke = []
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.smoke, color: 0x6d7475, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.NormalBlending,
      }))
      s.visible = false
      scene.add(s)
      this.smoke.push({ sprite: s, life: 0, max: 1, vel: new THREE.Vector3(), grow: 1 })
    }
    this.smokeIndex = 0

    // muzzle light
    this.flashLight = new THREE.PointLight(0xffb15a, 0, 10, 2)
    this.flashLight.position.set(0, 1.5, 0)
    scene.add(this.flashLight)
    this.flashTime = 0
  }

  spawnSparks(point, normal, count = 10, color = new THREE.Color(0xffc36a), speed = 2.6) {
    for (let i = 0; i < count; i++) {
      const idx = this.sparkIndex++ % this.sparkCount
      this.sparkPos[idx * 3] = point.x
      this.sparkPos[idx * 3 + 1] = point.y
      this.sparkPos[idx * 3 + 2] = point.z
      const v = new THREE.Vector3(
        normal.x + rand(-1, 1),
        normal.y + rand(-0.2, 1.2),
        normal.z + rand(-1, 1),
      ).normalize().multiplyScalar(rand(0.6, 1) * speed)
      this.sparkVel[idx * 3] = v.x
      this.sparkVel[idx * 3 + 1] = v.y
      this.sparkVel[idx * 3 + 2] = v.z
      this.sparkCol[idx * 3] = color.r
      this.sparkCol[idx * 3 + 1] = color.g
      this.sparkCol[idx * 3 + 2] = color.b
      this.sparkLife[idx] = this.sparkMax[idx] = rand(0.18, 0.55)
    }
    this.sparkGeo.attributes.position.needsUpdate = true
    this.sparkGeo.attributes.color.needsUpdate = true
  }

  spawnBlood(point, dir, count = 10) {
    for (let i = 0; i < count; i++) {
      const idx = this.bloodIndex++ % this.bloodCount
      this.bloodPos[idx * 3] = point.x
      this.bloodPos[idx * 3 + 1] = point.y
      this.bloodPos[idx * 3 + 2] = point.z
      const v = new THREE.Vector3(
        dir.x * rand(0.2, 1.4) + rand(-0.7, 0.7),
        rand(-0.2, 1.0),
        dir.z * rand(0.2, 1.4) + rand(-0.7, 0.7),
      )
      this.bloodVel[idx * 3] = v.x
      this.bloodVel[idx * 3 + 1] = v.y
      this.bloodVel[idx * 3 + 2] = v.z
      const dark = rand(0.25, 0.6)
      this.bloodCol[idx * 3] = 0.35 * dark
      this.bloodCol[idx * 3 + 1] = 0.01
      this.bloodCol[idx * 3 + 2] = 0.015
      this.bloodLife[idx] = this.bloodMax[idx] = rand(0.4, 1.1)
    }
    this.bloodGeo.attributes.position.needsUpdate = true
    this.bloodGeo.attributes.color.needsUpdate = true
  }

  spawnTracer(from, to, color = 0xffc985) {
    const item = this.tracers[this.tracerIndex++ % this.tracers.length]
    const arr = item.line.geometry.attributes.position.array
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z
    item.line.geometry.attributes.position.needsUpdate = true
    item.line.material.color.setHex(color)
    item.line.material.opacity = 0.9
    item.line.visible = true
    item.life = item.max
  }

  muzzleFlash(position) {
    this.flashLight.position.copy(position)
    this.flashTime = 0.055
  }

  spawnSmoke(point, size = 0.4, color = 0x7f8585) {
    const item = this.smoke[this.smokeIndex++ % this.smoke.length]
    item.sprite.visible = true
    item.sprite.position.copy(point)
    item.sprite.scale.setScalar(size)
    item.sprite.material.color.setHex(color)
    item.sprite.material.opacity = 0.35
    item.vel.set(rand(-0.15, 0.15), rand(0.15, 0.35), rand(-0.15, 0.15))
    item.life = item.max = rand(0.6, 1.4)
    item.grow = rand(0.7, 1.5)
  }

  update(dt) {
    // sparks
    for (let i = 0; i < this.sparkCount; i++) {
      if (this.sparkLife[i] <= 0) continue
      this.sparkLife[i] -= dt
      if (this.sparkLife[i] <= 0) {
        this.sparkPos[i * 3 + 1] = -100
        continue
      }
      this.sparkVel[i * 3 + 1] -= 5.5 * dt
      this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt
      this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt
      this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt
      if (this.sparkPos[i * 3 + 1] < 0.02) {
        this.sparkPos[i * 3 + 1] = 0.02
        this.sparkVel[i * 3 + 1] *= -0.28
        this.sparkVel[i * 3] *= 0.6
        this.sparkVel[i * 3 + 2] *= 0.6
      }
      const fade = this.sparkLife[i] / this.sparkMax[i]
      this.sparkCol[i * 3] *= 0.995
      this.sparkCol[i * 3 + 1] *= 0.993
      this.sparkCol[i * 3 + 2] *= 0.99
      if (fade < 0.1) this.sparkPos[i * 3 + 1] = -100
    }
    this.sparkGeo.attributes.position.needsUpdate = true
    this.sparkGeo.attributes.color.needsUpdate = true

    // blood
    for (let i = 0; i < this.bloodCount; i++) {
      if (this.bloodLife[i] <= 0) continue
      this.bloodLife[i] -= dt
      if (this.bloodLife[i] <= 0) {
        this.bloodPos[i * 3 + 1] = -100
        continue
      }
      this.bloodVel[i * 3 + 1] -= 6.0 * dt
      this.bloodPos[i * 3] += this.bloodVel[i * 3] * dt
      this.bloodPos[i * 3 + 1] += this.bloodVel[i * 3 + 1] * dt
      this.bloodPos[i * 3 + 2] += this.bloodVel[i * 3 + 2] * dt
      if (this.bloodPos[i * 3 + 1] < 0.02) {
        this.bloodPos[i * 3 + 1] = 0.02
        this.bloodVel[i * 3 + 1] = 0
        this.bloodVel[i * 3] *= 0.2
        this.bloodVel[i * 3 + 2] *= 0.2
      }
    }
    this.bloodGeo.attributes.position.needsUpdate = true

    // tracers
    for (const item of this.tracers) {
      if (!item.line.visible) continue
      item.life -= dt
      item.line.material.opacity = Math.max(0, item.life / item.max) * 0.9
      if (item.life <= 0) item.line.visible = false
    }

    // smoke
    for (const item of this.smoke) {
      if (!item.sprite.visible) continue
      item.life -= dt
      if (item.life <= 0) {
        item.sprite.visible = false
        continue
      }
      item.sprite.position.addScaledVector(item.vel, dt)
      const p = 1 - item.life / item.max
      item.sprite.scale.setScalar((0.4 + p * item.grow))
      item.sprite.material.opacity = Math.sin(Math.min(1, p * 2.2) * Math.PI) * 0.22
    }

    if (this.flashTime > 0) {
      this.flashTime -= dt
      this.flashLight.intensity = rand(14, 24)
    } else {
      this.flashLight.intensity = 0
    }
  }
}
