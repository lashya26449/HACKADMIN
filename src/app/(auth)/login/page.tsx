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
    <div className="w-full max-w-sm relative">
      {/* Ambient background glow */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center mb-6 text-center relative z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-2xl mb-3 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#F0F0F0]">HackAdmin</h1>
        <p className="text-xs text-[#808080] mt-0.5">Event Attendance Desk &middot; LAKSHYA 2026</p>
      </div>

      <div className="card-laminated relative z-10 p-6 shadow-2xl border-t-white/20">
        <div className="pb-4 border-b border-white/5 mb-4">
          <h2 className="text-sm font-semibold text-[#F0F0F0]">Sign In</h2>
          <p className="text-xs text-[#808080] mt-0.5">
            Enter authorized organizer credentials to access the desk.
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/50 p-2.5 text-xs text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
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
              placeholder="organizer@hackadmin.dev"
              autoComplete="email"
              disabled={loading}
              className="h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
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
                className="pr-9 h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] hover:text-[#F0F0F0] cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="emerald"
            className="w-full h-10 text-xs font-semibold mt-2 glow-emerald transition-all duration-200"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Authenticating...
              </>
            ) : (
              'Sign In to Desk'
            )}
          </Button>
        </form>
      </div>
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
