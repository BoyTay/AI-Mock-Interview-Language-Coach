import { api } from './client'

test('uses the default API base URL and a 15s timeout', () => {
  expect(api.defaults.baseURL).toBe('http://localhost:8000/api/v1')
  expect(api.defaults.timeout).toBe(15000)
})
