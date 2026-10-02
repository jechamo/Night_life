import { useNavigate } from 'react-router'
import { PhoneStep } from '../steps/PhoneStep'

/** "Ya tengo cuenta": phone + OTP; a finished account goes straight to the app. */
export function LoginScreen() {
  const navigate = useNavigate()
  return (
    <PhoneStep
      mode="login"
      data={{}}
      dispatch={() => undefined}
      onBack={() => void navigate('/welcome')}
    />
  )
}
