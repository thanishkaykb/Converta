import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, History, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-cta shadow-[var(--shadow-glow-violet)] transition-transform group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Pixel<span className="text-gradient">Forge</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link to="/" hash="pdf" className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition">PDF Tools</Link>
          <Link to="/" hash="image" className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition">Image Tools</Link>
          <Link to="/" hash="ai" className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition">AI Tools</Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-cta text-xs font-semibold text-white">
                    {(user.email ?? "?")[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline max-w-[140px] truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/history" className="cursor-pointer">
                    <History className="mr-2 h-4 w-4" /> My history
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => supabase.auth.signOut()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Login</Link>
              </Button>
              <Button size="sm" className="bg-cta hover:opacity-90 text-white border-0" asChild>
                <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
