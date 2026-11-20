import * as THREE from '../vendor/three.module.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const randInt = (a, b) => Math.floor(rand(a, b + 1))
export const chance = (p) => Math.random() < p

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

export function shortestAngle(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function dampAngle(current, target, lambda, dt) {
  return current + shortestAngle(current, target) * (1 - Math.exp(-lambda * dt))
}

// Ray / axis-aligned box intersection. Returns { t, normal } or null.
export function rayAABB(origin, dir, box) {
  let tmin = -Infinity
  let tmax = Infinity
  let nAxis = 0
  let nSign = 1
  const o = [origin.x, origin.y, origin.z]
  const d = [dir.x, dir.y, dir.z]
  const mins = [box.minX, box.minY, box.minZ]
  const maxs = [box.maxX, box.maxY, box.maxZ]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return null
      continue
    }
    const inv = 1 / d[i]
    let t1 = (mins[i] - o[i]) * inv
    let t2 = (maxs[i] - o[i]) * inv
    let sign = -1
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
      sign = 1
    }
    if (t1 > tmin) {
      tmin = t1
      nAxis = i
      nSign = sign
    }
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  if (tmax < 0) return null
  const t = tmin >= 0 ? tmin : tmax
  const normal = new THREE.Vector3()
  if (nAxis === 0) normal.x = nSign
  else if (nAxis === 1) normal.y = nSign
  else normal.z = nSign
  return { t, normal }
}

export function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x
  const oy = origin.y - center.y
  const oz = origin.z - center.z
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  const h = b * b - c
  if (h < 0) return null
  const t = -b - Math.sqrt(h)
  return t >= 0 ? t : null
}

export function segmentBlocked(a, b, colliders) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const dist = dir.length()
  if (dist < 0.001) return false
  dir.divideScalar(dist)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  for (const c of colliders) {
    if (c.maxY < minY + 0.02 || c.minY > maxY - 0.02) continue
    const hit = rayAABB(a, dir, c)
    if (hit && hit.t > 0.05 && hit.t < dist - 0.12) return true
  }
  return false
}

export function pointInExpandedBox(x, z, c, r) {
  return x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r
}

export function resolveCircle(x, z, r, colliders, feetY = 0, headY = 1.8) {
  let px = x
  let pz = z
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.maxY < feetY + 0.08 || c.minY > headY) continue
      const cx = clamp(px, c.minX, c.maxX)
      const cz = clamp(pz, c.minZ, c.maxZ)
      let dx = px - cx
      let dz = pz - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const push = r - d + 0.001
        px += (dx / d) * push
        pz += (dz / d) * push
      } else {
        const left = px - c.minX
        const right = c.maxX - px
        const near = pz - c.minZ
        const far = c.maxZ - pz
        const m = Math.min(left, right, near, far)
        if (m === left) px = c.minX - r
        else if (m === right) px = c.maxX + r
        else if (m === near) pz = c.minZ - r
        else pz = c.maxZ + r
      }
    }
  }
  return { x: px, z: pz }
}

export function collidesCircle(x, z, r, colliders, feetY = 0, headY = 1.8) {
  for (const c of colliders) {
    if (c.maxY < feetY + 0.08 || c.minY > headY) continue
    const cx = clamp(x, c.minX, c.maxX)
    const cz = clamp(z, c.minZ, c.maxZ)
    const dx = x - cx
    const dz = z - cz
    if (dx * dx + dz * dz < r * r) return true
  }
  return false
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 4
  return tex
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.())
      else o.material.dispose?.()
    }
  })
}
