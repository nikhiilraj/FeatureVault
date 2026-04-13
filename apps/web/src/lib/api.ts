import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends refreshToken cookie automatically
})

// Attach access token from store to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.__fv_token
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
let refreshing = false
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !refreshing && !err.config._retry) {
      refreshing = true
      try {
        const res = await axios.post(`${API_URL}/v1/auth/refresh`, {}, { withCredentials: true })
        const token = res.data.data.accessToken
        if (typeof window !== 'undefined') window.__fv_token = token
        err.config._retry = true
        err.config.headers.Authorization = `Bearer ${token}`
        return axios(err.config)
      } catch {
        if (typeof window !== 'undefined') {
          window.__fv_token = undefined
          window.location.href = '/login'
        }
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

declare global {
  interface Window { __fv_token?: string }
}
