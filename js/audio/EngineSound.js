/**
 * EngineSound.js — Son moteur V8 synthétisé (Web Audio API).
 *
 * Aucun fichier audio : le grondement est généré par deux oscillateurs
 * détunés (les impulsions des cylindres) + un souffle de bruit filtré
 * (l'échappement). Le régime (rpm 0..1) est piloté par le scroll.
 * Créé uniquement après un geste utilisateur (politique autoplay).
 */

export class EngineSound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._rpm = 0;
  }

  /** Construit le graphe audio (premier clic sur le bouton son). */
  _init() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    // Volume maître (fondu enchaîné on/off)
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Corps du moteur : deux oscillateurs graves légèrement détunés
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';

    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = 0.16;

    // Filtre passe-bas : plus le régime monte, plus le son s'ouvre
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 220;
    this.filter.Q.value = 2.5;

    this.osc1.connect(this.oscGain);
    this.osc2.connect(this.oscGain);
    this.oscGain.connect(this.filter);
    this.filter.connect(this.master);

    // Souffle d'échappement : bruit blanc bouclé + passe-bande
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.noise = ctx.createBufferSource();
    this.noise.buffer = noiseBuf;
    this.noise.loop = true;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 380;
    this.noiseFilter.Q.value = 0.8;

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.05;

    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);

    // Tremblement du ralenti (LFO sur le volume des oscillateurs)
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 24;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0.04;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.oscGain.gain);

    this.osc1.start(); this.osc2.start();
    this.noise.start(); this.lfo.start();
  }

  /** Active / coupe le son. Retourne le nouvel état. */
  toggle() {
    if (!this.ctx) this._init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.enabled = !this.enabled;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(this.enabled ? 0.5 : 0, t + 0.6);
    return this.enabled;
  }

  /** Régime moteur normalisé [0..1] — appelé chaque frame. */
  setRpm(rpm) {
    if (!this.ctx || !this.enabled) return;
    // Lissage pour éviter les sauts de régime
    this._rpm += (rpm - this._rpm) * 0.06;
    const r = this._rpm;
    const t = this.ctx.currentTime;

    const base = 38 + r * 150;                       // fréquence fondamentale
    this.osc1.frequency.setTargetAtTime(base, t, 0.05);
    this.osc2.frequency.setTargetAtTime(base * 1.5 + 3, t, 0.05);
    this.filter.frequency.setTargetAtTime(200 + r * 2400, t, 0.08);
    this.noiseFilter.frequency.setTargetAtTime(320 + r * 1800, t, 0.08);
    this.noiseGain.gain.setTargetAtTime(0.04 + r * 0.12, t, 0.1);
    this.lfo.frequency.setTargetAtTime(18 + r * 70, t, 0.1);
  }
}
