export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] flex items-center justify-center p-4" dir="rtl">
      {children}
    </div>
  )
}
