import { diffWords } from './diff'

test('marks the replaced word and keeps the rest', () => {
  expect(diffWords('Yesterday I fix the bug.', 'Yesterday I fixed the bug.')).toEqual([
    { type: 'same', text: 'Yesterday I' },
    { type: 'del', text: 'fix' },
    { type: 'add', text: 'fixed' },
    { type: 'same', text: 'the bug.' },
  ])
})

test('replacing the whole phrase gives one deletion then one addition', () => {
  expect(diffWords('more easy', 'easier')).toEqual([
    { type: 'del', text: 'more easy' },
    { type: 'add', text: 'easier' },
  ])
})

test('a pure deletion has no addition', () => {
  expect(diffWords('a very big dog', 'a big dog')).toEqual([
    { type: 'same', text: 'a' },
    { type: 'del', text: 'very' },
    { type: 'same', text: 'big dog' },
  ])
})

test('a pure insertion has no deletion', () => {
  expect(diffWords('I went home', 'I went back home')).toEqual([
    { type: 'same', text: 'I went' },
    { type: 'add', text: 'back' },
    { type: 'same', text: 'home' },
  ])
})

test('identical sentences are one unchanged run', () => {
  expect(diffWords('All good.', 'All good.')).toEqual([{ type: 'same', text: 'All good.' }])
})

test('ignores whitespace differences between the two sentences', () => {
  expect(diffWords('He  go home', 'He goes\nhome')).toEqual([
    { type: 'same', text: 'He' },
    { type: 'del', text: 'go' },
    { type: 'add', text: 'goes' },
    { type: 'same', text: 'home' },
  ])
})

test('empty input gives no runs', () => {
  expect(diffWords('', '')).toEqual([])
})
