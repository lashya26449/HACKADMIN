'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SECONDARY_MASTER_PASSWORD = 'Anu2006';
const STORAGE_KEY = 'hackadmin_secondary_unlocked';

interface SecondaryAuthGateProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function SecondaryAuthGate({ children, pageTitle }: SecondaryAuthGateProps) {
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unlocked = sessionStorage.getItem(STORAGE_KEY);
      if (unlocked === 'true') {
        setIsUnlocked(true);
      }
    } catch {
      // sessionStorage unavailable
    } finally {
      setChecking(false);
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (password === SECONDARY_MASTER_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setIsUnlocked(true);
      toast.success('Secondary authorization verified. Access granted.');
    } else {
      setError('Incorrect authorization password. Please try again.');
      toast.error('Invalid secondary password');
    }
  };

  if (checking) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-xs text-[#808080]">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-laminated border-white/10 bg-[#101010] shadow-2xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Header Icon & Title */}
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                <Lock className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight pt-1">
                Secondary Authorization Required
              </h2>
              <p className="text-xs text-[#888888] leading-relaxed">
                <strong className="text-emerald-400 font-semibold">{pageTitle}</strong> contains protected event data. Enter the secondary master password to proceed.
              </p>
            </div>

            {/* Password Form */}
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#909090] flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3 text-emerald-400" />
                  Master Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter secondary authorization password..."
                    autoFocus
                    className="pr-10 h-10 text-xs bg-white/[0.04] border-white/10 focus:border-emerald-500/50 text-white placeholder:text-[#606060] rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] hover:text-white transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && (
                  <p className="text-[11px] text-red-400 font-medium pt-1 animate-in fade-in-0">
                    {error}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/40 gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Unlock {pageTitle}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/admin/check-in')}
                  className="w-full h-9 text-xs text-[#808080] hover:text-[#D0D0D0] hover:bg-white/[0.04] rounded-xl gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to Check-in Desk
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
