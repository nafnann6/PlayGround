import * as THREE from '../vendor/three.module.js'
import { makeCanvas, canvasTexture, rand, randInt } from './utils.js'

function noiseOverlay(ctx, w, h, count, alpha, light = true) {
  for (let i = 0; i < count; i++) {
    const g = rand(0, 255)
    ctx.fillStyle = `rgba(${g},${g},${g},${rand(alpha * 0.2, alpha)})`
    const s = rand(0.5, 2.5)
    ctx.fillRect(rand(0, w), rand(0, h), s, s)
  }
}

function stains(ctx, w, h, count, color) {
  for (let i = 0; i < count; i++) {
    const x = rand(0, w)
    const y = rand(0, h)
    const r = rand(w * 0.02, w * 0.16)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.05)'))
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

export function makeConcreteFloor() {
  const w = 512
  const h = 512
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3b3d3b'
  ctx.fillRect(0, 0, w, h)
  // Broad tonal patches
  for (let i = 0; i < 50; i++) {
    const x = rand(0, w)
    const y = rand(0, h)
    const r = rand(20, 100)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tone = randInt(45, 78)
    g.addColorStop(0, `rgba(${tone},${tone + 2},${tone - 1},${rand(0.04, 0.16)})`)
    g.addColorStop(1, 'rgba(50,52,50,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  noiseOverlay(ctx, w, h, 16000, 0.12)
  stains(ctx, w, h, 16, 'rgba(12,13,12,0.3)')
  stains(ctx, w, h, 7, 'rgba(70,52,32,0.22)')
  // Slab seams
  ctx.strokeStyle = 'rgba(15,16,15,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 256)
  ctx.lineTo(w, 256)
  ctx.moveTo(256, 0)
  ctx.lineTo(256, h)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(115,118,112,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 259)
  ctx.lineTo(w, 259)
  ctx.moveTo(259, 0)
  ctx.lineTo(259, h)
  ctx.stroke()
  // Cracks
  for (let i = 0; i < 13; i++) {
    let x = rand(0, w)
    let y = rand(0, h)
    ctx.strokeStyle = `rgba(15,16,15,${rand(0.25, 0.65)})`
    ctx.lineWidth = rand(0.5, 1.5)
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = randInt(4, 12)
    for (let j = 0; j < steps; j++) {
      x += rand(-18, 18)
      y += rand(-18, 18)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // Faint painted lane line
  ctx.fillStyle = 'rgba(178,150,42,0.13)'
  ctx.fillRect(0, 64, w, 9)
  ctx.fillRect(0, 430, w, 9)
  noiseOverlay(ctx, w, h, 3000, 0.08)
  return canvasTexture(c, 9, 11)
}

export function makeConcreteFloorRough() {
  const w = 256
  const c = makeCanvas(w, w)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, w)
  for (let i = 0; i < w * w; i++) {
    const v = randInt(140, 240)
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvasTexture(c, 9, 11)
}

export function makeConcreteWall() {
  const w = 512
  const h = 512
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#414541'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 30; i++) {
    const x = rand(0, w)
    const y = rand(0, h)
    const r = rand(30, 130)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tone = randInt(42, 84)
    g.addColorStop(0, `rgba(${tone},${tone + 3},${tone},${rand(0.05, 0.2)})`)
    g.addColorStop(1, 'rgba(50,52,50,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  noiseOverlay(ctx, w, h, 12000, 0.14)
  stains(ctx, w, h, 22, 'rgba(14,15,13,0.35)')
  // Formwork panel seams
  ctx.strokeStyle = 'rgba(20,21,19,0.65)'
  ctx.lineWidth = 2
  for (let y = 0; y < h; y += 170) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(120,122,115,0.1)'
    ctx.beginPath()
    ctx.moveTo(0, y + 3)
    ctx.lineTo(w, y + 3)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(20,21,19,0.65)'
  }
  // Grime streaks
  for (let i = 0; i < 28; i++) {
    const x = rand(0, w)
    const y = rand(0, h * 0.55)
    const len = rand(30, 220)
    const g = ctx.createLinearGradient(x, y, x, y + len)
    g.addColorStop(0, 'rgba(12,14,12,0.25)')
    g.addColorStop(1, 'rgba(12,14,12,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, rand(2, 9), len)
  }
  return canvasTexture(c, 4, 2)
}

export function makeContainer(color = '#5e3328', label = 'TRANSCORP') {
  const w = 1024
  const h = 512
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  // Corrugation
  for (let x = 0; x < w; x += 26) {
    const g = ctx.createLinearGradient(x, 0, x + 26, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.24)')
    g.addColorStop(0.28, 'rgba(255,255,255,0.07)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.13)')
    g.addColorStop(0.8, 'rgba(0,0,0,0.2)')
    g.addColorStop(1, 'rgba(0,0,0,0.32)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 26, h)
  }
  // Top/bottom rails
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(0, 0, w, 34)
  ctx.fillRect(0, h - 38, w, 38)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, 34, w, 5)
  // Rust patches
  for (let i = 0; i < 38; i++) {
    const x = rand(0, w)
    const y = rand(0, h)
    const r = rand(4, 42)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${randInt(74, 105)},${randInt(42, 62)},${randInt(22, 38)},${rand(0.18, 0.58)})`)
    g.addColorStop(1, 'rgba(90,45,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  noiseOverlay(ctx, w, h, 9000, 0.1)
  // Stenciled branding
  ctx.save()
  ctx.globalAlpha = 0.72
  ctx.fillStyle = '#d8d3c2'
  ctx.font = 'bold 68px "Arial Narrow", Arial, sans-serif'
  ctx.letterSpacing = '6px'
  ctx.fillText(label, 54, 148)
  ctx.font = 'bold 26px "Courier New", monospace'
  ctx.fillStyle = '#c8c2b2'
  ctx.fillText('DRY FREIGHT  //  40FT  //  MAX 30,480 KG', 58, 190)
  ctx.font = 'bold 96px "Courier New", monospace'
  ctx.fillStyle = 'rgba(20,20,18,0.45)'
  ctx.fillText('BLK-' + randInt(1000, 9999), 660, 420)
  ctx.restore()
  // Door bars on right end
  ctx.fillStyle = 'rgba(20,20,20,0.45)'
  ctx.fillRect(w - 82, 34, 82, h - 72)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(200,200,190,0.14)'
    ctx.fillRect(w - 70, 60 + i * 76, 58, 8)
  }
  return canvasTexture(c, 1, 1)
}

export function makeWoodCrate() {
  const s = 512
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#59452e'
  ctx.fillRect(0, 0, s, s)
  for (let y = 0; y < s; y += 64) {
    ctx.fillStyle = `rgba(${randInt(80, 110)},${randInt(60, 82)},${randInt(38, 55)},0.55)`
    ctx.fillRect(0, y, s, 62)
    ctx.fillStyle = 'rgba(25,18,10,0.55)'
    ctx.fillRect(0, y + 62, s, 3)
    // grain
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = `rgba(30,20,10,${rand(0.08, 0.22)})`
      ctx.lineWidth = rand(0.5, 1.6)
      const yy = y + rand(5, 55)
      ctx.beginPath()
      ctx.moveTo(0, yy)
      for (let x = 0; x < s; x += 40) ctx.lineTo(x, yy + rand(-2, 2))
      ctx.stroke()
    }
  }
  // Frame
  ctx.strokeStyle = 'rgba(48,34,20,0.9)'
  ctx.lineWidth = 26
  ctx.strokeRect(13, 13, s - 26, s - 26)
  ctx.strokeStyle = 'rgba(135,104,65,0.18)'
  ctx.lineWidth = 4
  ctx.strokeRect(28, 28, s - 56, s - 56)
  ctx.save()
  ctx.rotate(-0.045)
  ctx.fillStyle = 'rgba(210,205,188,0.48)'
  ctx.font = 'bold 34px "Courier New", monospace'
  ctx.fillText('MIL-SURPLUS', 124, 240)
  ctx.font = 'bold 21px "Courier New", monospace'
  ctx.fillText('LOT 88-B / FRAGILE', 146, 274)
  ctx.restore()
  stains(ctx, s, s, 10, 'rgba(20,13,7,0.3)')
  return canvasTexture(c, 1, 1)
}

export function makeHazard() {
  const w = 512
  const h = 128
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#b69b2c'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#171817'
  for (let x = -h; x < w + h; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x + 32, h)
    ctx.lineTo(x + 32 + h, 0)
    ctx.lineTo(x + h, 0)
    ctx.closePath()
    ctx.fill()
  }
  // wear
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(50,48,40,${rand(0.1, 0.4)})`
    ctx.fillRect(rand(0, w), rand(0, h), rand(1, 10), rand(1, 4))
  }
  return canvasTexture(c, 3, 1)
}

export function makeMetal() {
  const s = 256
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#34383b'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 600; i++) {
    ctx.strokeStyle = `rgba(${randInt(100, 180)},${randInt(105, 185)},${randInt(110, 190)},${rand(0.02, 0.08)})`
    ctx.lineWidth = rand(0.4, 1.4)
    const y = rand(0, s)
    ctx.beginPath()
    ctx.moveTo(rand(0, s), y)
    ctx.lineTo(rand(0, s), y + rand(-1, 1))
    ctx.stroke()
  }
  stains(ctx, s, s, 9, 'rgba(90,50,25,0.2)')
  return canvasTexture(c, 2, 2)
}

export function makeShadow() {
  const s = 128
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.72)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.36)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

export function makeSmoke() {
  const s = 128
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.06)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

export function makeGlow() {
  const s = 128
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.16, 'rgba(255,246,210,0.9)')
  g.addColorStop(0.4, 'rgba(255,160,50,0.28)')
  g.addColorStop(1, 'rgba(255,90,10,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

export function makeBulletHole() {
  const s = 128
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, s, s)
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, 28)
  g.addColorStop(0, 'rgba(5,5,4,0.96)')
  g.addColorStop(0.45, 'rgba(15,14,12,0.85)')
  g.addColorStop(0.8, 'rgba(30,28,24,0.3)')
  g.addColorStop(1, 'rgba(30,28,24,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2)
    const r = rand(16, 48)
    ctx.strokeStyle = `rgba(10,9,8,${rand(0.3, 0.7)})`
    ctx.lineWidth = rand(0.6, 1.8)
    ctx.beginPath()
    ctx.moveTo(s / 2 + Math.cos(a) * 10, s / 2 + Math.sin(a) * 10)
    ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r)
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

export function makeBlood() {
  const s = 256
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  for (let i = 0; i < 22; i++) {
    const x = s / 2 + rand(-30, 30)
    const y = s / 2 + rand(-30, 30)
    const r = rand(6, 34)
    ctx.fillStyle = `rgba(${randInt(45, 90)},${randInt(2, 12)},${randInt(4, 14)},${rand(0.35, 0.8)})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * rand(0.5, 1), rand(0, 3), 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(60,4,6,${rand(0.3, 0.7)})`
    ctx.beginPath()
    ctx.arc(rand(0, s), rand(0, s), rand(1, 7), 0, Math.PI * 2)
    ctx.fill()
  }
  return new THREE.CanvasTexture(c)
}

export function makeScreen(kind = 'lab') {
  const w = 512
  const h = 320
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#07110c'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(40,255,130,0.07)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
  ctx.fillStyle = '#79ffb0'
  ctx.font = 'bold 20px "Courier New", monospace'
  if (kind === 'lab') {
    ctx.fillText('CHEM // BATCH 77', 22, 38)
    ctx.fillStyle = 'rgba(120,255,170,0.65)'
    ctx.font = '15px "Courier New", monospace'
    const rows = ['PURITY ......... 94.2%', 'MASS ........... 18.4 KG', 'CELL 04 ........ ONLINE', 'CELL 07 ........ ONLINE', 'PRESSURE ....... 1.04 ATM', '', '> AWAITING INPUT_']
    rows.forEach((r, i) => ctx.fillText(r, 24, 78 + i * 27))
    ctx.strokeStyle = 'rgba(100,255,150,0.4)'
    ctx.strokeRect(310, 80, 176, 120)
    ctx.beginPath()
    for (let i = 0; i < 20; i++) {
      const x = 318 + i * 8.5
      const y = 170 - Math.sin(i * 0.7) * 28 - rand(0, 12)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  } else {
    ctx.fillText('SECURITY GRID // BAY 04', 22, 38)
    ctx.fillStyle = 'rgba(120,255,170,0.5)'
    ctx.font = '14px "Courier New", monospace'
    for (let i = 0; i < 5; i++) ctx.fillText(`CAM 0${i + 1}  ${i === 3 ? 'NO SIGNAL' : 'LIVE'}`, 24, 84 + i * 32)
    ctx.strokeStyle = 'rgba(100,255,150,0.25)'
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(300 + i * 22, 60)
      ctx.lineTo(300 + i * 22, 280)
      ctx.stroke()
    }
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(290, 70 + i * 28)
      ctx.lineTo(470, 70 + i * 28)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,70,50,0.8)'
    ctx.fillRect(360, 130, 22, 22)
  }
  return canvasTexture(c, 1, 1)
}

export function makeSign(lines, options = {}) {
  const w = 512
  const h = 256
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = options.bg || '#c9c4b1'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = options.border || '#22231f'
  ctx.lineWidth = 10
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.fillStyle = options.fg || '#22231f'
  ctx.textAlign = 'center'
  const size = options.size || 58
  ctx.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size + 10) + size * 0.32)
  })
  // grime
  stains(ctx, w, h, 6, 'rgba(20,20,18,0.2)')
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(40,40,35,${rand(0.05, 0.22)})`
    ctx.fillRect(rand(0, w), rand(0, h), rand(1, 8), rand(1, 3))
  }
  return canvasTexture(c, 1, 1)
}

export function makePaper() {
  const s = 128
  const c = makeCanvas(s, s)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#c9c4b3'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = 'rgba(40,40,38,0.55)'
  ctx.lineWidth = 1
  for (let y = 18; y < s - 10; y += 10) {
    ctx.beginPath()
    ctx.moveTo(12, y)
    ctx.lineTo(s - 12 - rand(0, 30), y)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(30,30,28,0.6)'
  ctx.fillRect(12, 8, 48, 4)
  return canvasTexture(c, 1, 1)
}

export function makeEnvironment() {
  const w = 1024
  const h = 512
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#20242a')
  g.addColorStop(0.45, '#121519')
  g.addColorStop(0.6, '#0a0c0f')
  g.addColorStop(1, '#050607')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Cool ceiling strips
  for (let i = 0; i < 8; i++) {
    const x = 70 + i * 128
    const lg = ctx.createLinearGradient(x - 22, 0, x + 22, 0)
    lg.addColorStop(0, 'rgba(180,210,255,0)')
    lg.addColorStop(0.5, 'rgba(190,220,255,0.85)')
    lg.addColorStop(1, 'rgba(180,210,255,0)')
    ctx.fillStyle = lg
    ctx.fillRect(x - 22, 80, 44, 210)
  }
  // Warm exit glow
  const wg = ctx.createRadialGradient(520, 300, 0, 520, 300, 120)
  wg.addColorStop(0, 'rgba(255,130,40,0.3)')
  wg.addColorStop(1, 'rgba(255,130,40,0)')
  ctx.fillStyle = wg
  ctx.fillRect(400, 180, 240, 240)
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
