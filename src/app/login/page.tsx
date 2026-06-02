import LoginForm from './LoginForm'

/**
 * Server component — reads DEMO_EMAIL / DEMO_PASSWORD from the environment
 * and passes them to the client form. When the vars are empty the demo
 * button is hidden automatically.
 */
export default function LoginPage() {
  const demoEmail    = process.env.DEMO_EMAIL    || undefined
  const demoPassword = process.env.DEMO_PASSWORD || undefined

  return <LoginForm demoEmail={demoEmail} demoPassword={demoPassword} />
}
