"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Dark/light theme toggle (dark is the default). */
export const ThemeToggle = () => {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </Button>
  );
};