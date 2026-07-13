import { Link, useLocation } from "wouter";
import { FileText, Settings, Activity } from "lucide-react";
import { cn } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex h-14 items-center px-6 gap-8">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="w-5 h-5 font-bold" />
            <span className="font-bold tracking-widest uppercase text-lg hidden sm:inline-block">Translator Studio</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-mono font-bold uppercase tracking-wide h-full">
            <Link 
              href="/" 
              className={cn("flex items-center gap-2 hover:text-primary transition-colors h-full border-b-2", location === "/" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            >
              <FileText className="w-4 h-4" />
              <span>Registry</span>
            </Link>
            <Link 
              href="/settings" 
              className={cn("flex items-center gap-2 hover:text-primary transition-colors h-full border-b-2", location === "/settings" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            >
              <Settings className="w-4 h-4" />
              <span>Config</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
