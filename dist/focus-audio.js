export const soundPresets = [
  ["brown", "Brown noise"],
  ["pink", "Pink noise"],
  ["white", "White noise"],
  ["grey", "Grey noise"],
  ["crickets", "Night crickets"],
  ["train", "Passing train"],
  ["binaural-10", "Binaural · 10 Hz"],
  ["binaural-16", "Binaural · 16 Hz"]
];

// Loop decoded samples rather than restarting a media element at the file boundary.
export function createFocusAudio(onEnd = () => {}) {
  let context, gain, voice, request = 0, preset = "brown", level = 0.5;
  const buffers = new Map();
  function stop() {
    request++;
    if (!voice) return;
    const current = voice;
    voice = null;
    current.onended = null;
    try { current.stop(); } catch {}
    current.disconnect();
  }
  function setVolume(value) {
    level = Math.max(0, Math.min(1, Number(value) || 0));
    if (gain) gain.gain.setTargetAtTime(level, context.currentTime, .025);
  }
  async function load(preset) {
    if (buffers.has(preset)) return buffers.get(preset);
    const name = preset.startsWith("binaural-") ? `mob-${preset}` : `metiq-${preset}`;
    const response = await fetch(new URL(`./${name}.ogg`, import.meta.url));
    if (!response.ok) throw new Error("Sound is unavailable.");
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    // Metiq's prepared loop remains a single continuous stream. Blend its seam
    // across 80 ms, retaining the exact phase of the synthesized binaural tracks.
    const overlap = preset.startsWith("binaural-") ? 0 : Math.min(Math.round(decoded.sampleRate * .08), Math.floor(decoded.length / 4));
    const buffer = context.createBuffer(decoded.numberOfChannels, decoded.length - overlap, decoded.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = decoded.getChannelData(channel);
      const out = buffer.getChannelData(channel);
      out.set(samples.subarray(overlap));
      for (let i = 0; i < overlap; i++) {
        const at = out.length - overlap + i;
        const weight = (i + 1) / overlap;
        out[at] = out[at] * (1 - weight) + samples[i] * weight;
      }
    }
    if (buffers.size >= 3) buffers.delete(buffers.keys().next().value);
    buffers.set(preset, buffer);
    return buffer;
  }
  async function play(next = preset, volume = level, minutes = 25) {
    stop();
    const token = request;
    const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioEngine) throw new Error("This device does not support focus audio.");
    if (!context) {
      context = new AudioEngine();
      gain = context.createGain();
      gain.connect(context.destination);
    }
    await context.resume();
    preset = soundPresets.some(([key]) => key === next) ? next : "brown";
    const buffer = await load(preset);
    if (token !== request) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    voice = source;
    level = Math.max(0, Math.min(1, Number(volume) || 0));
    source.onended = () => {
      source.disconnect();
      if (voice !== source) return;
      voice = null;
      onEnd();
    };
    const start = context.currentTime;
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + .035);
    source.start(start);
    source.stop(start + (minutes === 60 ? 60 : 25) * 60);
  }
  return { play, stop, setVolume, get playing() { return Boolean(voice); }, get preset() { return preset; } };
}
