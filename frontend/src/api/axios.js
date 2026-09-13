import axios from 'axios'

const productionApiBase =
  typeof window !== 'undefined' && window.location.hostname.endsWith('journaly.uz')
    ? 'https://api.journaly.uz/api'
    : '/api'

const BASE = import.meta.env.VITE_API_URL || productionApiBase

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/token/refresh/`, { refresh })
          localStorage.setItem('access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          const pub = ['/', '/login', '/register', '/forgot-password']
          const isPublic = pub.includes(window.location.pathname) ||
            window.location.pathname.startsWith('/invite/')
          if (!isPublic) window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
