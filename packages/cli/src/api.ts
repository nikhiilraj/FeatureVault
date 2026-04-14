import axios, { type AxiosInstance } from 'axios'
import { config } from './config.js'

let _client: AxiosInstance | null = null

export function getClient(): AxiosInstance {
  if (_client) return _client
  _client = axios.create({
    baseURL: config.get('apiUrl') || 'http://localhost:4000',
    headers: { 'Content-Type': 'application/json' },
  })
  return _client
}

export function getAuthHeaders() {
  return { 'Authorization': `Bearer ${config.get('_accessToken') || ''}` }
}

export async function login(apiUrl: string, email: string, password: string) {
  const res = await axios.post(`${apiUrl}/v1/auth/login`, { email, password }, {
    withCredentials: true,
  })
  return res.data.data
}

export async function getProjects(apiUrl: string, token: string) {
  const res = await axios.get(`${apiUrl}/v1/workspaces/me/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data.data
}

export async function getFlags(apiUrl: string, token: string, projectId: string) {
  const res = await axios.get(`${apiUrl}/v1/projects/${projectId}/flags`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

export async function updateFlagStatus(apiUrl: string, token: string, projectId: string, flagId: string, status: string) {
  const res = await axios.patch(
    `${apiUrl}/v1/projects/${projectId}/flags/${flagId}/status`,
    { status },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data.data
}

export async function createFlag(apiUrl: string, token: string, projectId: string, body: object) {
  const res = await axios.post(
    `${apiUrl}/v1/projects/${projectId}/flags`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data.data
}

export async function getExperiments(apiUrl: string, token: string, projectId: string) {
  const res = await axios.get(`${apiUrl}/v1/projects/${projectId}/experiments`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}
