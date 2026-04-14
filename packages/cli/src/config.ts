import Conf from 'conf'

interface FVConfig {
  apiUrl:    string
  apiKey:    string
  projectId: string
  email:     string
}

export const config = new Conf<FVConfig>({
  projectName: 'featurevault',
  schema: {
    apiUrl:    { type: 'string', default: '' },
    apiKey:    { type: 'string', default: '' },
    projectId: { type: 'string', default: '' },
    email:     { type: 'string', default: '' },
  },
})

export function isConfigured(): boolean {
  return !!(config.get('apiUrl') && config.get('apiKey') && config.get('projectId'))
}
