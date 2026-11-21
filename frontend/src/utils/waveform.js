export const WAVE_BARS = 48

const SPEEDS = [1, 1.25, 1.5]

export function nextSpeed(rate) {
  const i = SPEEDS.indexOf(rate)
  return i === -1 ? 1 : SPEEDS[(i + 1) % SPEEDS.length]
}

// One value per bar in [0, 1]: the loudest sample of the bar's slice over every channel,
// relative to the loudest bar, so quiet recordings still fill the height.
export function computePeaks(channels, bars) {
  const length = channels[0]?.length ?? 0
  const peaks = Array.from({ length: bars }, (_, i) => {
    const start = Math.floor((i * length) / bars)
    const end = Math.min(length, Math.max(start + 1, Math.floor(((i + 1) * length) / bars)))
    let peak = 0
    for (const data of channels) {
      for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(data[j]))
    }
    return peak
  })
  const loudest = Math.max(0, ...peaks)
  return loudest > 0 ? peaks.map((p) => p / loudest) : peaks
}

function readBytes(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

// Decodes the recording to read its real duration (MediaRecorder webm often reports Infinity) and its peaks.
export async function decodePeaks(blob, bars) {
  const Context = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext
  if (!Context) throw new Error('Web Audio is not available')
  const audio = await new Context(1, 1, 44100).decodeAudioData(await readBytes(blob))
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i))
  return { duration: audio.duration, peaks: computePeaks(channels, bars) }
}
