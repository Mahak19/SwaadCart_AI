// Test-time environment defaults so the config schema can be parsed in CI
// without a local .env file. Real env vars always win over these defaults.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/swaadcart-test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
process.env.AI_MODEL = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
