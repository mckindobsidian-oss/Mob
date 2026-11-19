export const soundPresets = [
  ['soft-beat','Soft pulse','A gentle 70 BPM rhythm'],
  ['lofi','Slow groove','Warm tones and a light 80 BPM pulse'],
  ['brown','Brown noise','A low, steady texture'],
  ['pink','Soft noise','A brighter filtered texture'],
  ['rain','Rain texture','Soft, generated rainfall'],
  ['binaural-10','Binaural · 10 Hz','200 Hz left / 210 Hz right · headphones'],
  ['binaural-16','Binaural · 16 Hz','200 Hz left / 216 Hz right · headphones']
];

// Synthesized locally: no streaming, third-party recordings or Supabase audio traffic.
export function createFocusAudio(Context = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context, master, nodes=[], scheduler, playing=false, preset='brown', level=0.2, sequence=0;
  function stop() {
    sequence++;playing=false; clearInterval(scheduler); scheduler=null;
    for(const node of nodes) {try {node.stop?.();node.disconnect();}catch{}}
    nodes=[];
    if(master) master.gain.value=0;
  }
  const track=node=>(nodes.push(node),node);
  function tone(hz,destination=master) {
    const node=track(context.createOscillator());node.frequency.value=hz;node.connect(destination);node.start();return node;
  }
  function noise(kind) {
    const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate), data=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<data.length;i++) {const white=Math.random()*2-1;brown=(brown+0.02*white)/1.02;data[i]=kind==='brown' ? brown*3.5 : white*0.3;}
    const source=track(context.createBufferSource());source.buffer=buffer;source.loop=true;
    const filter=track(context.createBiquadFilter());filter.type='lowpass';filter.frequency.value=kind==='rain'?2400:kind==='pink'?900:450;
    source.connect(filter);filter.connect(master);source.start();
  }
  function pulse(at,hz,duration,strength) {
    const oscillator=context.createOscillator(), gain=context.createGain();
    oscillator.frequency.setValueAtTime(hz,at);oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,hz*0.5),at+duration);
    gain.gain.setValueAtTime(0.001,at);gain.gain.exponentialRampToValueAtTime(strength,at+0.015);gain.gain.exponentialRampToValueAtTime(0.001,at+duration);
    oscillator.connect(gain);gain.connect(master);oscillator.start(at);oscillator.stop(at+duration+0.02);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  async function play(next=preset,volume=level) {
    stop();
    const request=sequence;
    if(!Context) throw Error('Audio is unavailable on this device.');
    if(!context || context.state==='closed'){context=new Context();master=null;}await context.resume();
    if(request!==sequence)return;
    preset=soundPresets.some(([id])=>id===next)?next:'brown';
    if(!master){master=context.createGain();master.gain.value=0;master.connect(context.destination);}setVolume(volume);playing=true;
    if(preset.startsWith('binaural')) {
      const merger=track(context.createChannelMerger(2));merger.connect(master);
      const left=track(context.createOscillator()),right=track(context.createOscillator());
      left.frequency.value=200;right.frequency.value=200+Number(preset.split('-')[1]);
      left.connect(merger,0,0);right.connect(merger,0,1);left.start();right.start();
    } else if(['brown','pink','rain'].includes(preset)) noise(preset);
    else {
      const period=60/(preset==='lofi'?80:70);let at=context.currentTime+0.04, step=0;
      const schedule=()=>{while(at<context.currentTime+0.2) {pulse(at,step%4===0?110:65,0.18,step%2===0?0.35:0.16);if(preset==='lofi' && step%4===0)pulse(at,220,0.5,0.08);step++;at+=period;}};
      schedule();scheduler=setInterval(schedule,80);
    }
    return preset;
  }
  function setVolume(value) {level=Math.max(0,Math.min(0.6,Number(value)||0));if(master)master.gain.setTargetAtTime(level*0.25,context.currentTime,0.04);}
  return {play,stop,setVolume,get playing(){return playing;},get context(){return context;},get preset(){return preset;}};
}
