import { clamp, rand } from './utils.js'

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.ambientGain = null
    this.muted = false
    this.noiseBuffer = null
    this.started = false
    this.nextAmbient = rand(7, 16)
  }

  init() {
    if (this.ctx) {
      this.ctx.resume?.()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.46
    this.master.connect(this.ctx.destination)
    this.noiseBuffer = this.makeNoise(2.0)
    this.startAmbient()
    this.started = true
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  startAmbient() {
    const ctx = this.ctx
    // low industrial drone
    const drone = ctx.createGain()
    drone.gain.value = 0.022
    drone.connect(this.master)
    for (const [freq, gain] of [[43, 1], [57, 0.5], [86, 0.24]]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 180
      const g = ctx.createGain()
      g.gain.value = gain
      osc.connect(f).connect(g).connect(drone)
      osc.start()
    }
    // air handling / rain hiss
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 620
    bp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.018
    noise.connect(bp).connect(g).connect(this.master)
    noise.start()
    // fluorescent buzz
    const buzz = ctx.createOscillator()
    buzz.type = 'sine'
    buzz.frequency.value = 120
    const buzzGain = ctx.createGain()
    buzzGain.gain.value = 0.004
    buzz.connect(buzzGain).connect(this.master)
    buzz.start()
    this.ambientGain = drone
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.46, this.ctx.currentTime, 0.05)
  }

  shot(kind = 'rifle') {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const isRifle = kind === 'rifle'
    // crack noise
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = rand(0.9, 1.15)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = isRifle ? 280 : 480
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(isRifle ? 7200 : 9000, now)
    lp.frequency.exponentialRampToValueAtTime(700, now + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(isRifle ? 0.7 : 0.55, now + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, now + (isRifle ? 0.16 : 0.12))
    src.connect(hp).connect(lp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.2)
    // low body thump
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(isRifle ? 105 : 150, now)
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, now)
    og.gain.exponentialRampToValueAtTime(0.55, now + 0.005)
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc.connect(og).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.2)
    // mechanical click
    this.click(0.03, 0.14)
  }

  enemyShot(position, distance) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const vol = clamp(1 - distance / 55, 0.05, 1)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = rand(0.8, 1.0)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900 + (1 - vol) * 500
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.38 * vol * vol, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2 + distance * 0.003)
    src.connect(lp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.3 + distance * 0.003)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, now)
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.2)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.3 * vol, now)
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.connect(og).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.28)
  }

  click(volume = 0.2, freq = 1200, when = 0) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime + when
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.03)
    const g = ctx.createGain()
    g.gain.setValueAtTime(volume, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  reload() {
    if (!this.ctx) return
    this.click(0.14, 900, 0.02)
    this.click(0.12, 650, 0.24)
    this.click(0.18, 1100, 1.0)
    this.click(0.15, 750, 1.45)
  }

  empty() {
    this.click(0.16, 1500)
    this.click(0.1, 900, 0.03)
  }

  footstep(sprint = false) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = rand(0.55, 0.8)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = rand(220, 340)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(sprint ? 0.14 : 0.08, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    src.connect(lp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.12)
    // gear rattle
    if (Math.random() < 0.35) this.click(0.018, rand(2200, 3600), 0.015)
  }

  hitmarker(head = false) {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(head ? 1750 : 1250, now)
    osc.frequency.exponentialRampToValueAtTime(head ? 2100 : 1550, now + 0.035)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.12, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  hurt() {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(95, now)
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.32)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.55, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.45)
    const ring = ctx.createOscillator()
    ring.type = 'sine'
    ring.frequency.value = 3400
    const rg = ctx.createGain()
    rg.gain.setValueAtTime(0.018, now)
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    ring.connect(rg).connect(this.master)
    ring.start(now)
    ring.stop(now + 0.6)
  }

  nearMiss() {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1.8
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(2200, now)
    bp.frequency.exponentialRampToValueAtTime(500, now + 0.1)
    bp.Q.value = 1.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.11, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    src.connect(bp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.14)
  }

  pickup() {
    if (!this.ctx) return
    this.click(0.1, 900, 0)
    this.click(0.12, 1350, 0.09)
    this.click(0.12, 1800, 0.18)
  }

  radio() {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1.2
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1200
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    src.connect(hp).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + 0.18)
    this.click(0.06, 1900, 0.18)
  }

  win() {
    if (!this.ctx) return
    const notes = [440, 554, 659, 880]
    notes.forEach((f, i) => {
      const ctx = this.ctx
      const now = ctx.currentTime + i * 0.14
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
      osc.connect(g).connect(this.master)
      osc.start(now)
      osc.stop(now + 0.55)
    })
  }

  lose() {
    if (!this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(38, now + 1.2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.3, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 1.6)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.35
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.12, now)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
    src.connect(lp).connect(ng).connect(this.master)
    src.start(now)
    src.stop(now + 1.3)
  }

  update(dt) {
    if (!this.ctx || !this.started) return
    this.nextAmbient -= dt
    if (this.nextAmbient <= 0) {
      this.nextAmbient = rand(9, 24)
      this.distantClank()
    }
  }

  distantClank() {
    const ctx = this.ctx
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(rand(180, 380), now)
    osc.frequency.exponentialRampToValueAtTime(rand(60, 120), now + 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(rand(0.02, 0.055), now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + 1.4)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.6
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(300, 700)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.exponentialRampToValueAtTime(rand(0.008, 0.02), now + 0.02)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    src.connect(bp).connect(ng).connect(this.master)
    src.start(now)
    src.stop(now + 0.5)
  }
}
