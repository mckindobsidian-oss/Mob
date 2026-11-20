export const soundPresets = [
  ["brown", "Brown noise"],
  ["pink", "Pink noise"],
  ["white", "White noise"],
  ["grey", "Grey noise"],
  ["crickets", "Night crickets"],
  ["train", "Passing train"]
];

export function createFocusAudio(AudioElement = globalThis.Audio) {
  let player;
  let request = 0;
  let preset = "brown";
  let playing = false;
  let level = 0.2;

  function stop() {
    request++;
    player?.pause();
    player = undefined;
    playing = false;
  }

  function setVolume(value) {
    level = Math.max(0, Math.min(0.6, Number(value) || 0));
    if (player) player.volume = level;
  }

  async function play(next = preset, volume = level) {
    stop();
    const pending = request;
    preset = soundPresets.some(([key]) => key === next) ? next : "brown";
    const element = new AudioElement(new URL(`./metiq-${preset}.ogg`, import.meta.url).href);
    element.loop = true;
    player = element;
    setVolume(volume);
    try {
      await element.play();
      if (pending === request) playing = true;
    } catch {
      if (pending !== request) return;
      stop();
      throw new Error("Couldn’t play this sound. Try again when the audio is available.");
    }
    return preset;
  }

  return { play, stop, setVolume, get playing() { return playing; }, get preset() { return preset; } };
}
