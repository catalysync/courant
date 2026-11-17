"use client";

import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/constants";
import { trpc } from "@/trpc/client";
import { ClockIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const RECENT_SEARCHES_KEY = "courant-recent-searches";
const MAX_RECENT_SEARCHES = 8;

const loadRecentSearches = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

export const SearchInput = () => {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Recent searches live in localStorage, so load them on the client only.
  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  // Debounce the query used for suggestions.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 200);

    return () => clearTimeout(timer);
  }, [value]);

  // Close the dropdown when clicking outside the form.
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const suggestionsQuery = trpc.search.suggest.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );
  const suggestions = suggestionsQuery.data ?? [];

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      const next = [
        trimmed,
        ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);

      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private browsing, quota, etc.).
      }

      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);

    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  const goToSearch = (query: string) => {
    const trimmed = query.trim();

    setValue(trimmed);
    setOpen(false);

    if (trimmed) {
      saveRecentSearch(trimmed);
      router.push(`/search?query=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const url = new URL("/search", `https://${APP_URL}`);
    const newQuery = value.trim();

    url.searchParams.set("query", newQuery);

    if (newQuery === "") {
      url.searchParams.delete("query");
    }

    saveRecentSearch(newQuery);
    setValue(newQuery);
    setOpen(false);
    router.push(url.toString());
  };

  const trimmedValue = value.trim();
  const showRecents = open && trimmedValue === "" && recentSearches.length > 0;
  const showSuggestions = open && trimmedValue !== "";
  const showDropdown = showRecents || showSuggestions;

  return (
    <form
      ref={formRef}
      className="relative flex w-full max-w-[600px]"
      onSubmit={handleSearch}
    >
      <div className="relative w-full">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          type="text"
          placeholder="Search"
          className="w-full pl-4 py-2 pr-12 rounded-l-full border border-input bg-muted/50
             text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal-500"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
          >
            <XIcon className="text-muted-foreground" />
          </Button>
        )}
      </div>

      <button
        disabled={!value.trim()}
        type="submit"
        className="px-5 py-2.5 bg-muted border border-l-0 rounded-r-full
             hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <SearchIcon className="size-5 text-teal-500" />
      </button>

      {showDropdown && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg
             border bg-popover text-popover-foreground shadow-lg"
        >
          {showRecents ? (
            <>
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent searches
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <ul className="py-1">
                {recentSearches.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => goToSearch(item)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent"
                    >
                      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="border-b px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Search suggestions
                </span>
              </div>
              {trimmedValue.length < 2 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Keep typing to see suggestions.
                </p>
              ) : suggestionsQuery.isFetching ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Searching…
                </p>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No matching videos.
                </p>
              ) : (
                <ul className="py-1">
                  {suggestions.map((video) => (
                    <li key={video.id}>
                      <button
                        type="button"
                        onClick={() => goToSearch(video.title)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent"
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {video.title}
                        </span>
                        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
};