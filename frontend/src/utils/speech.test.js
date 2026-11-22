import { loadReadAloud, pickEnglishVoice, READ_ALOUD_KEY, saveReadAloud } from './speech'

const voice = (lang) => ({ lang, name: lang })

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

test('an American voice is preferred', () => {
  expect(pickEnglishVoice([voice('fr-FR'), voice('en-GB'), voice('en-US')]).lang).toBe('en-US')
})

test('then a British one', () => {
  expect(pickEnglishVoice([voice('fr-FR'), voice('en-GB'), voice('en-AU')]).lang).toBe('en-GB')
})

test('then any English voice, whatever separator it uses', () => {
  expect(pickEnglishVoice([voice('vi-VN'), voice('en_AU')]).lang).toBe('en_AU')
})

test('no English voice gives null', () => {
  expect(pickEnglishVoice([voice('vi-VN')])).toBeNull()
  expect(pickEnglishVoice([])).toBeNull()
})

test('the read-aloud choice is remembered', () => {
  expect(loadReadAloud()).toBeNull()
  saveReadAloud('on')
  expect(localStorage.getItem(READ_ALOUD_KEY)).toBe('on')
  expect(loadReadAloud()).toBe('on')
})

test('an unknown stored value counts as not asked yet', () => {
  localStorage.setItem(READ_ALOUD_KEY, 'maybe')
  expect(loadReadAloud()).toBeNull()
})

test('blocked storage does not break anything', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadReadAloud()).toBeNull()
  expect(() => saveReadAloud('on')).not.toThrow()
})

test("the browser's default voice comes first within a language", () => {
  const picked = pickEnglishVoice([{ lang: 'en-US', name: 'Fred' }, { lang: 'en-US', name: 'Samantha', default: true }])
  expect(picked.name).toBe('Samantha')
})

test('a voice on the device is preferred to a network one', () => {
  const picked = pickEnglishVoice([
    { lang: 'en-US', name: 'Google US English', localService: false },
    { lang: 'en-US', name: 'Microsoft David', localService: true },
  ])
  expect(picked.name).toBe('Microsoft David')
})

test('macOS novelty voices are never picked', () => {
  const picked = pickEnglishVoice([
    { lang: 'en-US', name: 'Albert', localService: true },
    { lang: 'en-US', name: 'Bad News', localService: true },
    { lang: 'en-US', name: 'Zarvox', localService: true },
    { lang: 'en-GB', name: 'Daniel', localService: true },
  ])
  expect(picked.name).toBe('Daniel')
})
