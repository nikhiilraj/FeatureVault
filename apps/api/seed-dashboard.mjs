// seed-dashboard.mjs
// Run this to permanently populate the Grafana Dashboard with FAANG-grade traffic!

const API_KEY = 'fv_live_b7y0lbiR90ssWrJ3CcktUG-KnluqknA5' // Auto-grabbed from your terminal history
const API_URL = 'http://localhost:4000/sdk/v1'

console.log(`Starting massive simulated traffic using Key: ${API_KEY}`)
console.log('Open Grafana (http://localhost:3001) in 15 seconds to watch it spike!\n')

// 1. Simulating traffic fetching configuration 
setInterval(async () => {
  fetch(API_URL + '/flags', { headers: { 'x-api-key': API_KEY } })
    .then(res => res.text())
    .catch((e) => console.error('Error fetching flags:', e.message))
}, 800)

// 2. Simulating massive traffic conversions queuing natively into BullMQ 
setInterval(async () => {
  // Fire off 5 randomized variant analytics events!
  const events = Array.from({ length: 5 }).map((_, i) => ({
    eventName: 'purchase_completed',
    userId: `sim-user-${Math.random()}`,
    experimentKey: 'resume-demo', // Target active experiments for mathematical distribution 
    properties: { flagKey: 'demo-flag', result: true }
  }))

  fetch(API_URL + '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ events })
  }).then(res => res.text()).catch((e) => console.error('Error posting events:', e.message))
}, 1500)

// 3. Keep 25 Persistent webSockets open natively showing Streaming Tunnels
const sockets = Array.from({ length: 25 }).map(() => {
  try {
    return new WebSocket(`ws://localhost:4000/sdk/v1/ws?apiKey=${API_KEY}`)
  } catch (e) { return null }
})

// 4. Force Authorization Throttle drops natively (429 Security drops tracking)
setInterval(async () => {
  // Firing 10 invalid login attempts extremely fast explicitly forces the REDIS sliding window Rate-Limiter
  for (let i = 0; i < 10; i++) {
    fetch('http://localhost:4000/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@example.com', password: 'nope' })
    }).then(res => res.text()).catch((e) => console.error('Error simulating rate limit:', e.message))
  }
}, 6000)

console.log('Pumping Data... Leave this running and check Grafana!')
