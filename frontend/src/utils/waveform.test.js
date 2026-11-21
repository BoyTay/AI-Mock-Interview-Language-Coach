import { computePeaks, decodePeaks, nextSpeed, WAVE_BARS } from './waveform'

afterEach(() => vi.unstubAllGlobals())

test('the player draws 48 bars', () => {
  expect(WAVE_BARS).toBe(48)
})

test('each bar is the loudest sample in its slice, relative to the loudest bar', () => {
  expect(computePeaks([Float32Array.of(0, 0.5, 0, -1)], 2)).toEqual([0.5, 1])
})

test('every channel counts towards a bar', () => {
  expect(computePeaks([Float32Array.of(0.2, 0), Float32Array.of(0, -0.4)], 2)).toEqual([0.5, 1])
})

test('silence and an empty clip give flat bars', () => {
  expect(computePeaks([new Float32Array(8)], 4)).toEqual([0, 0, 0, 0])
  expect(computePeaks([new Float32Array(0)], 3)).toEqual([0, 0, 0])
})

test('a clip shorter than the number of bars still gives one number per bar', () => {
  const peaks = computePeaks([Float32Array.of(1, 0.5)], 4)
  expect(peaks).toHaveLength(4)
  expect(peaks.every((p) => Number.isFinite(p) && p >= 0 && p <= 1)).toBe(true)
})

test('the speed goes 1x, 1.25x, 1.5x and back to 1x', () => {
  expect(nextSpeed(1)).toBe(1.25)
  expect(nextSpeed(1.25)).toBe(1.5)
  expect(nextSpeed(1.5)).toBe(1)
  expect(nextSpeed(2)).toBe(1)
})

test('decodePeaks decodes the recording for its duration and peaks', async () => {
  const decoded = { duration: 3.2, numberOfChannels: 1, getChannelData: () => Float32Array.of(0, 1) }
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      decodeAudioData() {
        return Promise.resolve(decoded)
      }
    },
  )
  const blob = new Blob([new Uint8Array([1, 2, 3])])

  expect(await decodePeaks(blob, 2)).toEqual({ duration: 3.2, peaks: [0, 1] })
})

test('decodePeaks fails when the browser has no Web Audio', async () => {
  vi.stubGlobal('OfflineAudioContext', undefined)
  await expect(decodePeaks(new Blob([new Uint8Array([1])]), 2)).rejects.toThrow()
})
