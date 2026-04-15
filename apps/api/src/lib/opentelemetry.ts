import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

const isDev = process.env.NODE_ENV !== 'production'

// Only enable exporter if OTEL_EXPORTER_OTLP_ENDPOINT is provided (like Grafana Tempo)
// Otherwise, it skips trace exporting to prevent crashes when developing locally without Tempo.
const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT 
  ? new OTLPTraceExporter()
  : undefined

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'featurevault-api',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // We explicitly enable fastify and generic HTTP 
      '@opentelemetry/instrumentation-fastify': {
        requestHook: (span, info) => {
          span.setAttribute('http.method', info.request.method)
        }
      },
      '@opentelemetry/instrumentation-pg': {
        enhancedDatabaseReporting: true,
      },
      '@opentelemetry/instrumentation-ioredis': {}
    }),
  ],
})

// Initialize the SDK if we have an exporter or force enabled it
if (traceExporter || process.env.ENABLE_OTEL === 'true') {
  sdk.start()
  console.log('📡 OpenTelemetry SDK initialized')
  
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('OpenTelemetry SDK shut down'))
      .finally(() => process.exit(0))
  })
}
