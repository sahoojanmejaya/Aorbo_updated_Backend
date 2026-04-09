function requireEnv(key) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return process.env[key];
}

function loadEnv() {
  return {
    PORT: process.env.PORT || 5000,
    DB_HOST: requireEnv("DB_HOST"),
    DB_PORT: requireEnv("DB_PORT"),
    DB_USER: requireEnv("DB_USER"),
    DB_PASSWORD: requireEnv("DB_PASSWORD"),
    DB_NAME: requireEnv("DB_NAME")
  };
}

module.exports = loadEnv();
