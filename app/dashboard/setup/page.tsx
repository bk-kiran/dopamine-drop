'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/canvas/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to connect Canvas account')
        setLoading(false)
        return
      }

      // Success - redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Connect Your Canvas Account</CardTitle>
          <CardDescription>
            To get started, we need to connect your Canvas account using an access token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">How to Generate Your Canvas Token</h3>
            <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
              <li>
                Go to{' '}
                <a
                  href="https://umass.instructure.com/profile/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Canvas Profile Settings
                </a>
              </li>
              <li>
                Scroll down to the <strong>Approved Integrations</strong> section
              </li>
              <li>
                Click <strong>+ New Access Token</strong>
              </li>
              <li>
                Enter a purpose (e.g., &quot;Reward Bot&quot;) and set an expiry date (optional)
              </li>
              <li>
                Click <strong>Generate Token</strong>
              </li>
              <li>
                Copy the token that appears{' '}
                <span className="text-destructive font-medium">
                  (you won&apos;t be able to see it again!)
                </span>
              </li>
              <li>
                Paste the token in the field below
              </li>
            </ol>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Canvas Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Paste your Canvas token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={loading}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Your token will be encrypted and stored securely.
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? 'Validating token...' : 'Connect Canvas Account'}
            </Button>
          </form>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Why do we need this?</p>
            <p className="text-muted-foreground">
              This token allows us to access your Canvas courses and assignments on your behalf.
              We use it to track your progress and provide personalized rewards for completing
              your coursework.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
