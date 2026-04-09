module.exports = {
  apps: [{
    name: 'aorbo-backend',
    script: 'server.js',
    cwd: '/var/www/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
}
