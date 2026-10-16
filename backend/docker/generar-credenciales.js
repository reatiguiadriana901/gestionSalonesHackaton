/**
 * Genera (por la salida estándar) las credenciales que usan los workflows,
 * a partir de variables de entorno. n8n las cifra con N8N_ENCRYPTION_KEY al
 * importarlas, así que ninguna contraseña ni API key queda en el repositorio.
 *
 * Los IDs coinciden con los referenciados en backend/workflows/*.json.
 */
const env = process.env;

const proveedorIa = (env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
const apiKeyIa = (env.AI_API_KEY || '').trim() || 'sin-configurar';

// Anthropic se autentica con "x-api-key"; los proveedores compatibles con
// OpenAI (Ollama, LM Studio, vLLM...) usan "Authorization: Bearer <key>".
const encabezadoIa =
  proveedorIa === 'anthropic'
    ? { name: 'x-api-key', value: apiKeyIa }
    : { name: 'Authorization', value: `Bearer ${apiKeyIa}` };

const requerida = (nombre) => {
  if (!env[nombre]) {
    console.error(`[campus] Falta la variable de entorno ${nombre}`);
    process.exit(1);
  }
  return env[nombre];
};

const credenciales = [
  {
    id: 'campusPostgres01',
    name: 'Postgres · Base de datos del campus',
    type: 'postgres',
    data: {
      host: env.DB_HOST || 'db',
      port: Number(env.DB_PORT || 5432),
      database: requerida('DB_NAME'),
      user: requerida('DB_USER'),
      password: requerida('DB_PASSWORD'),
      ssl: 'disable',
      allowUnauthorizedCerts: false,
      maxConnections: 20,
    },
  },
  {
    id: 'campusIaApiKey01',
    name: 'IA · API key del proveedor',
    type: 'httpHeaderAuth',
    data: encabezadoIa,
  },
];

process.stdout.write(JSON.stringify(credenciales));
