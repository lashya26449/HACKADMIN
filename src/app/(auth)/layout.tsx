export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080808] text-[#F0F0F0] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
