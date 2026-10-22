const { execSync } = require('child_process')
const path = require('path')

module.exports = async function globalSetup() {
  process.env.DATABASE_URL ||= 'postgresql://ordr:ordr@localhost:5432/ordr_test'
  const cwd = path.join(__dirname, '..')
  execSync('pnpm exec prisma generate', { stdio: 'inherit', cwd, env: process.env })
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', cwd, env: process.env })
}
