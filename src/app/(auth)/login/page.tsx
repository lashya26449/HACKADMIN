'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email is required'); return; }
    if (!password) { setError('Password is required'); return; }

    try {
      setLoading(true);
      await signIn(email, password);
      toast.success('Signed in successfully');
      const redirect = searchParams.get('redirect') ?? '/admin/check-in';
      router.push(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-xl mb-3">
          <ShieldCheck className="h-5 w-5 text-[#F0F0F0]" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-[#F0F0F0]">HackAdmin</h1>
        <p className="text-xs text-[#808080] mt-0.5">Event Attendance Management</p>
      </div>

      <Card className="border-white/10 bg-white/[0.045] backdrop-blur-2xl shadow-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-[#F0F0F0]">Sign In</CardTitle>
          <CardDescription className="text-xs text-[#808080]">
            Enter your credentials to access the attendance desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-800/40 bg-red-950/40 p-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-[#B5B5B5]">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="organizer@example.com"
                autoComplete="email"
                disabled={loading}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs text-[#B5B5B5]">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="pr-9 h-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#808080] hover:text-[#F0F0F0] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-9 text-xs font-semibold mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#808080]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
