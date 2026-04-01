import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, LogIn, MapPin, Plus, Search, Users, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LandingEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  category: string;
  emoji: string;
  source_url: string | null;
  description: string | null;
}

const normalizeInviteCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const buildInviteCode = (name: string) => {
  const base = normalizeInviteCode(name).slice(0, 12);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return base ? `${base}${suffix}` : "";
};

const Landing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [city, setCity] = useState("");
  const [submittedCity, setSubmittedCity] = useState("");
  const [events, setEvents] = useState<LandingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LandingEvent | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [squadName, setSquadName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const sessionCode = normalizeInviteCode(sessionStorage.getItem("join_squad_code") ?? "");
    if (sessionCode) {
      setJoinCode(sessionCode);
    }

    const params = new URLSearchParams(location.search);
    const inviteCode = normalizeInviteCode(params.get("invite") ?? params.get("code") ?? "");

    if (inviteCode) {
      sessionStorage.setItem("join_squad_code", inviteCode);
      setJoinCode(inviteCode);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [location.search]);

  const loadEventsForCity = async (nextCity: string) => {
    setLoading(true);
    setHasSearched(true);
    setSubmittedCity(nextCity);

    try {
      const { error: scrapeError } = await supabase.functions.invoke("scrape-events", {
        body: { location: nextCity },
      });

      if (scrapeError) {
        console.error("Failed to refresh public events:", scrapeError);
      }

      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, location, category, emoji, source_url, description")
        .is("created_by", null)
        .is("squad_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setEvents((data ?? []) as LandingEvent[]);
    } catch (error) {
      console.error("Failed to load events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCity = city.trim();
    if (!nextCity) return;
    await loadEventsForCity(nextCity);
  };

  const handleEventClick = (event: LandingEvent) => {
    setSelectedEvent(event);
    setShowActionModal(true);
    setCodeError("");
    setSquadName("");
  };

  const handleCreateSquad = () => {
    const trimmedName = squadName.trim();
    if (!trimmedName) return;

    sessionStorage.setItem(
      "pending_squad",
      JSON.stringify({ name: trimmedName, invite_code: buildInviteCode(trimmedName) })
    );
    navigate("/auth");
  };

  const handleJoinSquad = () => {
    const normalizedCode = normalizeInviteCode(joinCode);

    if (normalizedCode.length < 4) {
      setCodeError("Code must be at least 4 characters");
      return;
    }

    sessionStorage.setItem("join_squad_code", normalizedCode);
    navigate("/auth");
  };

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-primary px-4 pb-12 pt-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <h1
            className="mb-3 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Let&apos;s Hang IRL
          </h1>
          <p className="mb-8 text-sm text-primary-foreground/80 md:text-base">
            Enter your location to discover public events nearby, then start or join a squad to make plans.
          </p>

          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter your city (e.g. San Jose, CA)"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !city.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-5 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find Events
            </button>
          </form>
        </motion.div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Finding events near {submittedCity}...</p>
          </div>
        )}

        {!loading && hasSearched && events.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">No events found. Try a different city.</p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {submittedCity ? `Events near ${submittedCity}` : "Upcoming events"} — tap any event to get started.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  date={event.date}
                  location={event.location}
                  category={event.category}
                  emoji={event.emoji}
                  source_url={event.source_url}
                  description={event.description}
                  friends={[]}
                  index={index}
                  onClick={() => handleEventClick(event)}
                />
              ))}
            </div>
          </>
        )}

        {!hasSearched && !loading && (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">Enter your city above to discover public events near you.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showActionModal && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
            onClick={() => setShowActionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-5 pr-8">
                <span className="text-3xl">{selectedEvent.emoji}</span>
                <h2
                  className="mt-2 text-xl font-semibold text-card-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {selectedEvent.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedEvent.date} · {selectedEvent.location}
                </p>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                Start a squad, join one with an invite code, or sign in to make plans around this event.
              </p>

              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Start a new squad</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={squadName}
                      onChange={(e) => setSquadName(e.target.value)}
                      placeholder="Squad name"
                      maxLength={50}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={handleCreateSquad}
                      disabled={!squadName.trim()}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Join a squad</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value);
                        if (codeError) setCodeError("");
                      }}
                      placeholder="Invite code"
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={handleJoinSquad}
                      className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    >
                      Join
                    </button>
                  </div>
                  {codeError && <p className="mt-2 text-xs text-destructive">{codeError}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Landing;
