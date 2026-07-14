import {
  ArrowRight,
  BedDouble,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  House,
  Import,
  KeyRound,
  Link2,
  ListChecks,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  PartyPopper,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Waves,
  X,
} from "lucide-react";
import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { isDemoMode } from "./auth";
import { demoState, demoWeekend } from "./data/demo";
import { personalPhotos } from "./data/personalPhotos";
import { cyclePhotoIndex, propertyPhotoSets } from "./data/propertyPhotos";
import {
  contiguousStayLength,
  findFirstFallback,
  formatAvailabilityWindow,
  formatDateRange,
  isProfileBlocked,
  nightsBetween,
  propertyAvailabilityError,
  rangesOverlap,
  reservedRoomCount,
  roomConflicts,
  suggestedStayRange,
  validateStayRange,
} from "./lib/bookingRules";
import { apiRequest } from "./lib/api";
import { hostScheduleBookings, stayPhase, type StayTiming } from "./lib/hostSchedule";
import type {
  AppState,
  Booking,
  PartyEvent,
  Profile,
  Property,
  Room,
} from "./types";

type ToastState = { tone: "success" | "error"; message: string } | null;

interface AppContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  currentUser: Profile;
  setCurrentUserId: (id: string) => void;
  toast: ToastState;
  showToast: (message: string, tone?: "success" | "error") => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("App context is unavailable");
  return value;
}

function useSessionResume(destination: string) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) { setChecking(false); return; }
    let cancelled = false;
    apiRequest<{ authenticated: true }>("/auth/session")
      .then(() => { if (!cancelled) navigate(destination, { replace: true }); })
      .catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [destination, navigate]);

  return checking;
}

function AppProvider({ children, initialState = demoState }: { children: ReactNode; initialState?: AppState }) {
  const [state, setState] = useState<AppState>(initialState);
  const [currentUserId, setCurrentUserId] = useState(initialState.profiles[0]?.id ?? "");
  const [toast, setToast] = useState<ToastState>(null);
  const currentUser = state.profiles.find((profile) => profile.id === currentUserId) ?? state.profiles[0];

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <AppContext.Provider value={{ state, setState, currentUser, setCurrentUserId, toast, showToast }}>
      {children}
      {toast && <div className={`toast toast-${toast.tone}`}>{toast.message}</div>}
    </AppContext.Provider>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Harbor and Home">
      <span className="brand-mark"><Waves size={19} strokeWidth={2.1} /></span>
      <span><b>Harbor</b> &amp; Home</span>
    </Link>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  useSessionResume("/book");
  const begin = () => navigate(isDemoMode ? "/book" : "/auth/sign-in");

  return (
    <main className="landing">
      <header className="landing-nav shell-width">
        <Brand />
        <div className="nav-actions">
          <span className="private-pill"><LockKeyhole size={14} /> Private family space</span>
          <button className="button button-ink button-small" onClick={begin}>Sign in with email</button>
        </div>
      </header>

      <section className="hero shell-width">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> ROOMS FOR THE PEOPLE WE LOVE</p>
          <h1>Come stay.<br /><em>We saved you a room.</em></h1>
          <p className="hero-lede">A private, easy place for friends and family to find an open room, plan a visit, and gather together.</p>
          <div className="hero-actions">
            <button className="button button-coral" onClick={begin}>Find a room <ArrowRight size={17} /></button>
            <a className="text-link" href="#how-it-works">How it works <ChevronDown size={16} /></a>
          </div>
          <div className="trust-row">
            <span><Check size={15} /> Always free</span>
            <span><Check size={15} /> Seven nights at a time</span>
            <span><Check size={15} /> Hosts keep it fair</span>
          </div>
        </div>

        <div className="hero-scene" aria-label="A coastal home with available rooms">
          <div className="sun-disc" />
          <div className="shore-line shore-one" />
          <div className="shore-line shore-two" />
          <div className="house-card">
            <div className="house-card-top">
              <span className="mini-label">NEXT OPEN WEEKEND</span>
              <span className="open-dot"><i /> Rooms open</span>
            </div>
            <div className="house-illustration">
              <div className="roof" />
              <div className="home-body"><span /><span /><span /></div>
            </div>
            <div className="house-card-copy">
              <span><MapPin size={14} /> By the beach</span>
              <strong>Choose the spot that fits.</strong>
              <small>Private room, ADU, loft, or an easy couch.</small>
            </div>
          </div>
          <div className="floating-note note-left"><CalendarDays size={18} /><span><b>Pick your dates</b><small>Up to 7 nights</small></span></div>
          <div className="floating-note note-right"><ShieldCheck size={18} /><span><b>Family rules</b><small>Handled gently</small></span></div>
        </div>
      </section>

      <section className="host-welcome shell-width" aria-labelledby="host-welcome-title">
        <div className="host-photo-collage">
          <img className="host-photo-sunset" src={personalPhotos.sunset.src} alt={personalPhotos.sunset.alt} />
          <img className="host-photo-beach" src={personalPhotos.beach.src} alt={personalPhotos.beach.alt} loading="lazy" />
        </div>
        <div className="host-welcome-copy">
          <p className="eyebrow"><Sparkles size={14} /> FROM SAM &amp; LISA</p>
          <h2 id="host-welcome-title">Our favorite places are better with our favorite people in them.</h2>
          <p>We made Harbor &amp; Home so friends and family can skip the group-chat logistics and get to the good part: choosing a room, showing up, and staying awhile.</p>
          <div className="host-signoff">
            <img src={personalPhotos.dog.src} alt={personalPhotos.dog.alt} loading="lazy" />
            <div><strong>Come make yourself at home.</strong><span>With love, Sam &amp; Lisa</span></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div className="shell-width">
          <p className="eyebrow centered">SIMPLE BY DESIGN</p>
          <h2>Less coordinating. More being together.</h2>
          <div className="how-grid">
            <article><span>01</span><CalendarDays /><h3>Choose a weekend</h3><p>Search dates across the homes and see only the spaces that can actually fit your group.</p></article>
            <article><span>02</span><BedDouble /><h3>Pick your room</h3><p>Reserve one room or several. Every sleeping space has clear capacity and bathroom details.</p></article>
            <article><span>03</span><Mail /><h3>Stay in the loop</h3><p>Confirmations, moves, and party updates arrive in the site and by email.</p></article>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get("returnTo");
  const redirectTo = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/book";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkingSession = useSessionResume(redirectTo);
  if (isDemoMode) return <Navigate to="/book" replace />;
  if (checkingSession) return <div className="app-loading"><Brand /><span /><p>Restoring your sign-in…</p></div>;
  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      await apiRequest("/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (signInError) { setError(signInError instanceof Error ? signInError.message : "The sign-in email could not be sent."); }
    finally { setBusy(false); }
  };
  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      await apiRequest("/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) });
      navigate(redirectTo, { replace: true });
    } catch (verifyError) { setError(verifyError instanceof Error ? verifyError.message : "That code could not be verified."); }
    finally { setBusy(false); }
  };
  return (
    <main className="auth-page">
      <Brand />
      <div className="auth-shell"><p className="eyebrow">PRIVATE FAMILY SPACE</p><h1>{sent ? "Check your email" : "Welcome"}</h1><p>{sent ? `We sent a six-digit code to ${email}. It expires in ten minutes.` : "Enter your email and we’ll send a one-time sign-in code. No password or Google account setup required."}</p>{error && <div className="inline-alert"><CircleAlert size={17} /> {error}</div>}{!sent ? <form className="auth-form" onSubmit={requestCode}><label className="field-label"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label><button className="button button-ink button-full" disabled={busy}><Mail size={18} /> {busy ? "Sending code…" : "Email me a sign-in code"}</button></form> : <form className="auth-form" onSubmit={verifyCode}><label className="field-label"><span>Six-digit code</span><input className="code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" pattern="[0-9]{6}" required autoFocus /></label><button className="button button-coral button-full" disabled={busy || code.length !== 6}><KeyRound size={18} /> {busy ? "Checking code…" : "Sign in"}</button><button type="button" className="button button-quiet button-full" onClick={() => { setSent(false); setCode(""); setError(null); }}>Use a different email</button></form>}<small>New guests stay pending until Sam or Lisa approves them.</small></div>
    </main>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { currentUser, state, setCurrentUserId } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = state.notifications.filter((note) => note.userId === currentUser.id && !note.read).length;
  const nav = [
    { to: "/book", label: "Find a room", icon: Search },
    { to: "/stays", label: "My stays", icon: CalendarDays },
    ...(currentUser.role === "admin" ? [{ to: "/admin", label: "Host tools", icon: Settings2 }] : []),
  ];
  const signOut = async () => { await apiRequest("/auth/sign-out", { method: "POST" }).catch(() => undefined); window.location.assign("/"); };

  return (
    <div className="app-layout">
      <header className="app-header">
        <Brand />
        <nav className={menuOpen ? "app-nav nav-open" : "app-nav"}>
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={location.pathname.startsWith(to) ? "active" : ""} onClick={() => setMenuOpen(false)}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="user-cluster">
          {isDemoMode && (
            <label className="demo-user">
              <span>Preview as</span>
              <select value={currentUser.id} onChange={(event) => setCurrentUserId(event.target.value)}>
                {state.profiles.filter((profile) => profile.status === "active").map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
              </select>
            </label>
          )}
          <Link to="/notifications" className="icon-button" aria-label={`${unread} unread notifications`}><Bell size={19} />{unread > 0 && <i>{unread}</i>}</Link>
          <div className="avatar">{currentUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
          {!isDemoMode && <button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>}
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={21} /></button>
        </div>
      </header>
      <div className="app-content">{children}</div>
    </div>
  );
}

function DateSearch({ checkIn, checkOut, minDate, maxDate, onChange }: { checkIn: string; checkOut: string; minDate?: string; maxDate?: string | null; onChange: (field: "checkIn" | "checkOut", value: string) => void }) {
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  return (
    <div className="date-search">
      <label><span>Check in</span><input type="date" value={checkIn} min={minDate} max={maxDate ?? undefined} onChange={(event) => onChange("checkIn", event.target.value)} /></label>
      <div className="date-divider" />
      <label><span>Check out</span><input type="date" value={checkOut} min={checkIn || minDate} max={maxDate ?? undefined} onChange={(event) => onChange("checkOut", event.target.value)} /></label>
      <span className={`night-count ${nights > 7 ? "night-error" : ""}`}><Clock3 size={15} /> {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Choose dates"}</span>
    </div>
  );
}

function RoomCard({ room, property, range, onBook }: { room: Room; property: Property; range: { checkIn: string; checkOut: string }; onBook: (room: Room) => void }) {
  const { state, currentUser } = useApp();
  const conflicts = roomConflicts(room.id, range, state.bookings);
  const eventHeld = state.events.some((event) => event.status === "published" && event.propertyId === property.id && event.roomIds.includes(room.id) && rangesOverlap(event, range));
  const blocked = isProfileBlocked(currentUser, property.id, range, state.blocks);
  const outsideWindow = propertyAvailabilityError(property, range);
  const propertyRanks = state.priorityRules.filter((rule) => rule.propertyId === property.id);
  const highestRank = Math.max(0, ...propertyRanks.map((rule) => rule.rank));
  const userRank = Math.max(0, ...propertyRanks.filter((rule) => currentUser.categoryIds.includes(rule.categoryId)).map((rule) => rule.rank));
  const activeFallbacks = room.fallbackIds.map((id) => state.rooms.find((candidate) => candidate.id === id)).filter((candidate): candidate is Room => Boolean(candidate?.status === "active" && candidate.capacity));
  const canRequestPriority = conflicts.length > 0 && userRank > 0 && userRank === highestRank && activeFallbacks.length >= conflicts.length;
  const unavailable = (conflicts.length > 0 && !canRequestPriority) || eventHeld || Boolean(blocked) || Boolean(outsideWindow);
  const draft = room.status === "draft" || room.capacity === null;
  const status = draft ? "Details needed" : outsideWindow ? "Outside available dates" : blocked ? blocked.reason : eventHeld ? "Private gathering" : canRequestPriority ? "Priority option" : unavailable ? "Booked" : "Available";

  return (
    <article className={`room-card ${draft ? "room-draft" : ""}`}>
      <div className="room-icon"><BedDouble size={22} /></div>
      <div className="room-main">
        <div className="room-title-row"><h3>{room.name}</h3><span className={`status-badge status-${draft ? "draft" : unavailable ? "busy" : "open"}`}>{status}</span></div>
        <p>{room.description}</p>
        <div className="room-facts"><span>{room.bed}</span><span>•</span><span>{room.bathroom}</span>{room.capacity && <><span>•</span><span>Sleeps {room.capacity}</span></>}</div>
      </div>
      <button className="button button-outline" disabled={draft || unavailable} onClick={() => onBook(room)}>{unavailable ? "Unavailable" : draft ? "Draft" : canRequestPriority ? "Request room" : "Choose room"}</button>
    </article>
  );
}

function PropertyPhotoGallery({ property }: { property: Property }) {
  const photoSet = propertyPhotoSets[property.slug];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const galleryOpen = activeIndex !== null;
  const photoCount = photoSet?.photos.length ?? 0;

  useEffect(() => {
    if (!galleryOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(null);
        window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setActiveIndex((current) => current === null ? null : cyclePhotoIndex(current, direction, photoCount));
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryOpen, photoCount]);

  if (!photoSet) return null;
  const activePhoto = activeIndex === null ? null : photoSet.photos[activeIndex];
  const movePhoto = (direction: -1 | 1) => setActiveIndex((current) => current === null ? null : cyclePhotoIndex(current, direction, photoCount));
  const closeGallery = () => {
    setActiveIndex(null);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  };

  return <figure className="property-gallery">
    <div className="property-photo-grid">
      {photoSet.photos.map((photo, index) => <button
        type="button"
        className="property-photo-trigger"
        key={photo.src}
        aria-label={`View photo ${index + 1} of ${photoCount}: ${photo.alt}`}
        aria-haspopup="dialog"
        onClick={(event) => {
          lastTriggerRef.current = event.currentTarget;
          setActiveIndex(index);
        }}
      ><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" /></button>)}
    </div>
    <figcaption><span>Listing photos from {photoSet.sourceName}</span><a href={photoSet.sourceUrl} target="_blank" rel="noreferrer">View original listing <ExternalLink size={12} /></a></figcaption>
    {activePhoto && activeIndex !== null && <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${property.name} photo gallery`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeGallery(); }}
    >
      <button ref={closeButtonRef} type="button" className="photo-lightbox-close" onClick={closeGallery} aria-label="Close photo gallery"><X size={22} /></button>
      <div className="photo-lightbox-main">
        <button type="button" className="photo-lightbox-arrow" onClick={() => movePhoto(-1)} aria-label="Previous photo"><ChevronLeft size={28} /></button>
        <div
          className="photo-lightbox-slide"
          onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (startX === null || endX === undefined || Math.abs(endX - startX) < 45) return;
            movePhoto(endX < startX ? 1 : -1);
          }}
        >
          <img className="photo-lightbox-image" src={activePhoto.src} alt={activePhoto.alt} decoding="async" />
          <div className="photo-lightbox-caption"><span>{activePhoto.alt}</span><strong aria-live="polite">{activeIndex + 1} / {photoCount}</strong></div>
        </div>
        <button type="button" className="photo-lightbox-arrow" onClick={() => movePhoto(1)} aria-label="Next photo"><ChevronRight size={28} /></button>
      </div>
      <div className="photo-lightbox-thumbnails" aria-label="Choose a photo">
        {photoSet.photos.map((photo, index) => <button
          type="button"
          key={photo.src}
          className={index === activeIndex ? "photo-lightbox-thumbnail active" : "photo-lightbox-thumbnail"}
          aria-label={`View photo ${index + 1}: ${photo.alt}`}
          aria-pressed={index === activeIndex}
          onClick={() => setActiveIndex(index)}
        ><img src={photo.src} alt="" decoding="async" /></button>)}
      </div>
    </div>}
  </figure>;
}

function BookingModal({ room, property, range, onClose }: { room: Room; property: Property; range: { checkIn: string; checkOut: string }; onClose: () => void }) {
  const { state, setState, currentUser, showToast } = useApp();
  const [partySize, setPartySize] = useState(1);
  const nights = nightsBetween(range.checkIn, range.checkOut);

  const confirm = async () => {
    const rangeError = validateStayRange(range);
    if (rangeError) return showToast(rangeError, "error");
    const windowError = propertyAvailabilityError(property, range);
    if (windowError) return showToast(windowError, "error");
    if (room.capacity && partySize > room.capacity) return showToast(`This room sleeps up to ${room.capacity}.`, "error");
    if (contiguousStayLength(state.bookings.filter((booking) => booking.userId === currentUser.id), range) > 7) return showToast("That would create a stay longer than seven nights.", "error");
    const block = isProfileBlocked(currentUser, property.id, range, state.blocks);
    if (block) return showToast(`${block.reason} applies to your category for these dates.`, "error");

    if (!isDemoMode) {
      try {
        await apiRequest("/bookings", { method: "POST", body: JSON.stringify({ roomId: room.id, ...range, partySize }) });
        const response = await apiRequest<{ state: AppState }>("/bootstrap");
        setState(response.state);
        showToast(`${room.name} is booked. Check your email for the details.`);
        onClose();
        return;
      } catch (error) {
        return showToast(error instanceof Error ? error.message : "Booking failed.", "error");
      }
    }

    const conflicts = roomConflicts(room.id, range, state.bookings);
    const userRank = Math.max(0, ...state.priorityRules.filter((rule) => rule.propertyId === property.id && currentUser.categoryIds.includes(rule.categoryId)).map((rule) => rule.rank));
    let movedBookings = state.bookings;
    const movedNotes = [...state.notifications];
    const reservedFallbacks: string[] = [];

    for (const conflict of conflicts) {
      const occupant = state.profiles.find((profile) => profile.id === conflict.userId);
      const occupantRank = Math.max(0, ...state.priorityRules.filter((rule) => rule.propertyId === property.id && occupant?.categoryIds.includes(rule.categoryId)).map((rule) => rule.rank));
      if (userRank <= occupantRank) return showToast("This room is already booked.", "error");
      const fallback = findFirstFallback(room, conflict, state.rooms, movedBookings, reservedFallbacks);
      if (!fallback) return showToast("No suitable fallback is open, so nobody was moved. A host has been alerted.", "error");
      reservedFallbacks.push(fallback.id);
      movedBookings = movedBookings.map((booking) => booking.id === conflict.id ? { ...booking, roomId: fallback.id, movedFromRoomId: room.id } : booking);
      movedNotes.push({ id: crypto.randomUUID(), userId: conflict.userId, title: "Your room changed", message: `Your stay was moved to ${fallback.name}. Your dates are unchanged.`, kind: "move", read: false, createdAt: new Date().toISOString() });
    }

    const booking: Booking = {
      id: crypto.randomUUID(), userId: currentUser.id, propertyId: property.id, roomId: room.id,
      checkIn: range.checkIn, checkOut: range.checkOut, partySize, status: "confirmed", createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      bookings: [...movedBookings, booking],
      notifications: [...movedNotes, { id: crypto.randomUUID(), userId: currentUser.id, title: "Stay confirmed", message: `${room.name} is yours for ${formatDateRange(range.checkIn, range.checkOut)}.`, kind: "booking", read: false, createdAt: new Date().toISOString() }],
      audit: [{ id: crypto.randomUUID(), action: conflicts.length ? "Priority booking confirmed" : "Booking confirmed", actorName: currentUser.name, detail: `${room.name} · ${formatDateRange(range.checkIn, range.checkOut)}`, createdAt: new Date().toISOString() }, ...current.audit],
    }));
    showToast(`${room.name} is booked. Check your email for the details.`);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <p className="eyebrow">CONFIRM YOUR STAY</p>
        <h2 id="booking-title">{room.name}</h2>
        <p className="modal-location"><MapPin size={15} /> {property.name} · {property.generalLocation}</p>
        <div className="booking-summary">
          <div><span>Dates</span><strong>{formatDateRange(range.checkIn, range.checkOut)}</strong><small>{nights} night{nights === 1 ? "" : "s"}</small></div>
          <div><span>Sleeping space</span><strong>{room.bed}</strong><small>{room.bathroom}</small></div>
        </div>
        <label className="field-label"><span>How many people?</span><select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>{Array.from({ length: room.capacity ?? 1 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
        <p className="gentle-note"><ShieldCheck size={17} /> It’s free. If a host needs to move this stay, you’ll be notified in the site and by email.</p>
        <button className="button button-coral button-full" onClick={confirm}>Confirm free stay <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function BookingPage() {
  const { state, currentUser } = useApp();
  const [range, setRange] = useState(demoWeekend);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selected, setSelected] = useState<{ room: Room; property: Property } | null>(null);
  const activeProperties = state.properties.filter((property) => property.status === "active");
  const property = activeProperties.find((item) => item.id === selectedPropertyId);
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const selectProperty = (choice: Property) => {
    setSelectedPropertyId(choice.id);
    setRange(suggestedStayRange(choice, today));
    setSelected(null);
  };
  const error = property ? validateStayRange(range) : null;

  const propertyPanel = property ? (() => {
    const photoSet = propertyPhotoSets[property.slug];
    const rooms = state.rooms.filter((room) => property.roomIds.includes(room.id));
    const outsideWindow = propertyAvailabilityError(property, range);
    const availabilityLabel = formatAvailabilityWindow(property);
    const standardBookings = state.bookings.filter((booking) => !booking.eventId);
    const ownRooms = reservedRoomCount(property.id, range, standardBookings.filter((booking) => booking.userId === currentUser.id));
    const otherRooms = reservedRoomCount(property.id, range, standardBookings.filter((booking) => booking.userId !== currentUser.id));
    const gatheringRoomIds = new Set(state.events.filter((event) => event.status === "published" && event.propertyId === property.id && rangesOverlap(event, range)).flatMap((event) => event.roomIds));
    const gatheringRooms = gatheringRoomIds.size;
    const blocked = isProfileBlocked(currentUser, property.id, range, state.blocks);
    const openCount = outsideWindow || blocked ? 0 : rooms.filter((room) => room.status === "active" && room.capacity !== null && roomConflicts(room.id, range, state.bookings).length === 0 && !gatheringRoomIds.has(room.id)).length;
    return <section className="property-panel">
      <div className={`property-cover cover-${property.accent}`}>
        {photoSet && <img className="property-cover-photo" src={photoSet.photos[0].src} alt="" decoding="async" referrerPolicy="no-referrer" />}
        <div className="cover-copy"><span>{property.eyebrow}</span><h2>{property.name}</h2><p>{property.summary}</p>{availabilityLabel && <small><CalendarDays size={13} /> {availabilityLabel}</small>}</div>
        <div className="cover-house"><House size={64} strokeWidth={1.1} /><span><i /> {openCount} open</span></div>
      </div>
      <div className="property-body">
        <div className="property-meta">
          <div><MapPin size={16} /><span><strong>{property.generalLocation}</strong><small>{property.address}</small></span></div>
          {property.sourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={14} /></a>)}
        </div>
        <PropertyPhotoGallery property={property} />
        <div className="occupancy-strip">
          <span className="occupancy-icon"><Users size={17} /></span>
          <div><strong>Who’s around for these dates?</strong><span>{outsideWindow ? "Choose dates inside this property’s availability window." : otherRooms > 0 ? `Other guests already have ${otherRooms} room${otherRooms === 1 ? "" : "s"} reserved.` : "No other guest rooms are reserved yet."}</span></div>
          {!outsideWindow && ownRooms > 0 && <small>You have {ownRooms} room{ownRooms === 1 ? "" : "s"} reserved</small>}
          {!outsideWindow && gatheringRooms > 0 && <small>{gatheringRooms} room{gatheringRooms === 1 ? "" : "s"} held for a private gathering</small>}
        </div>
        <div className="room-list">
          {rooms.map((room) => <RoomCard key={room.id} room={room} property={property} range={range} onBook={(chosen) => setSelected({ room: chosen, property })} />)}
        </div>
      </div>
    </section>;
  })() : null;

  return (
    <AppShell>
      <div className="page-heading booking-heading booking-intro">
        <div><p className="eyebrow">WELCOME BACK, {currentUser.name.split(" ")[0].toUpperCase()}</p><h1>Plan your stay.</h1><p>Choose a home first, then dates and the sleeping space that feels right.</p></div>
      </div>
      <section className="booking-step property-choice-step" aria-labelledby="property-step-title">
        <div className="booking-step-heading"><span>1</span><div><small>First, choose a home</small><h2 id="property-step-title">Where would you like to stay?</h2></div></div>
        <div className="property-choice-grid">{activeProperties.map((choice) => {
          const active = choice.id === selectedPropertyId;
          const photoSet = propertyPhotoSets[choice.slug];
          return <button type="button" key={choice.id} aria-pressed={active} className={`property-choice choice-${choice.accent} ${active ? "selected" : ""}`} onClick={() => selectProperty(choice)}>
            {photoSet ? <span className="property-choice-photo"><img src={photoSet.photos[0].src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /></span> : <span className="property-choice-icon"><House size={24} /></span>}<span className="property-choice-copy"><small>{choice.eyebrow}</small><strong>{choice.name}</strong><span><MapPin size={13} /> {choice.generalLocation}</span><em>{formatAvailabilityWindow(choice) ?? "Dates available year-round"}</em></span><span className="property-choice-action">{active ? <Check size={18} /> : <ArrowRight size={18} />}</span>
          </button>;
        })}</div>
      </section>

      {property && <>
        <section className="booking-step date-choice-step" aria-labelledby="date-step-title">
          <div className="booking-step-heading"><span>2</span><div><small>Next, choose dates</small><h2 id="date-step-title">When are you coming to {property.name}?</h2></div></div>
          <DateSearch checkIn={range.checkIn} checkOut={range.checkOut} minDate={property.availableFrom && property.availableFrom > today ? property.availableFrom : today} maxDate={property.availableUntil} onChange={(field, value) => setRange((current) => ({ ...current, [field]: value }))} />
        </section>
        {error && <div className="inline-alert booking-flow-alert"><CircleAlert size={18} /> {error}</div>}
        <div className="booking-step-heading room-step-heading"><span>3</span><div><small>Finally, choose a room</small><h2>Where would you like to sleep?</h2></div></div>
        <div className="property-stack">{propertyPanel}</div>
      </>}
      {selected && <BookingModal room={selected.room} property={selected.property} range={range} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

function MyStaysPage() {
  const { state, setState, currentUser, showToast } = useApp();
  const stays = state.bookings.filter((booking) => booking.userId === currentUser.id && booking.status === "confirmed");
  const cancel = async (id: string) => {
    if (!isDemoMode) {
      try { await apiRequest(`/bookings/${id}`, { method: "DELETE" }); }
      catch (error) { return showToast(error instanceof Error ? error.message : "Cancellation failed.", "error"); }
    }
    setState((current) => ({ ...current, bookings: current.bookings.map((booking) => booking.id === id ? { ...booking, status: "cancelled" } : booking) }));
    showToast("Stay cancelled. The room is open again.");
  };
  return (
    <AppShell><div className="narrow-page"><div className="page-heading"><div><p className="eyebrow">YOUR PLANS</p><h1>My stays</h1><p>Everything you have booked, all in one place.</p></div></div>
      {stays.length === 0 ? <EmptyState icon={<CalendarDays />} title="No stays yet" copy="When you reserve a room, it will appear here." action={<Link className="button button-coral" to="/book">Find a room</Link>} /> :
        <div className="stay-list">{stays.map((booking) => {
          const room = state.rooms.find((item) => item.id === booking.roomId)!;
          const property = state.properties.find((item) => item.id === booking.propertyId)!;
          return <article className="stay-card" key={booking.id}><div className="stay-date"><span>{new Date(`${booking.checkIn}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span><b>{new Date(`${booking.checkIn}T12:00:00`).getDate()}</b></div><div><span className="status-badge status-open">Confirmed</span><h2>{room.name}</h2><p>{property.name} · {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.partySize} guest{booking.partySize === 1 ? "" : "s"}</p>{booking.movedFromRoomId && <small className="moved-note">Moved from another room; dates unchanged.</small>}</div><button className="button button-quiet" onClick={() => cancel(booking.id)}>Cancel</button></article>;
        })}</div>}
    </div></AppShell>
  );
}

function NotificationsPage() {
  const { state, setState, currentUser } = useApp();
  const notes = state.notifications.filter((note) => note.userId === currentUser.id);
  useEffect(() => { setState((current) => ({ ...current, notifications: current.notifications.map((note) => note.userId === currentUser.id ? { ...note, read: true } : note) })); }, [currentUser.id, setState]);
  return <AppShell><div className="narrow-page"><div className="page-heading"><div><p className="eyebrow">UPDATES</p><h1>Notifications</h1><p>Booking confirmations, changes, and host notes.</p></div></div><div className="notification-list">{notes.map((note) => <article key={note.id}><span className={`notification-icon note-${note.kind}`}><Bell size={17} /></span><div><h3>{note.title}</h3><p>{note.message}</p><small>{new Date(note.createdAt).toLocaleString()}</small></div></article>)}</div></div></AppShell>;
}

function EmptyState({ icon, title, copy, action }: { icon: ReactNode; title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{copy}</p>{action}</div>;
}

function AdminPage() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState("overview");
  if (currentUser.role !== "admin") return <Navigate to="/book" replace />;
  const tabs = [
    { id: "overview", label: "Overview", icon: ListChecks },
    { id: "people", label: "People", icon: Users },
    { id: "properties", label: "Properties", icon: House },
    { id: "rules", label: "Rules", icon: ShieldCheck },
    { id: "stays", label: "Who’s staying", icon: CalendarDays },
    { id: "parties", label: "Parties", icon: PartyPopper },
    { id: "activity", label: "Activity", icon: Clock3 },
  ];
  return (
    <AppShell><div className="admin-page"><div className="admin-header"><div><p className="eyebrow">HOST TOOLS</p><h1>Keep every stay running smoothly.</h1></div><span className="admin-shield"><ShieldCheck size={18} /> Admin-only view</span></div>
      <div className="admin-layout"><aside className="admin-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17} /> {label}</button>)}</aside>
        <section className="admin-workspace">
          {tab === "overview" && <AdminOverview onNavigate={setTab} />}
          {tab === "people" && <AdminPeople />}
          {tab === "properties" && <AdminProperties />}
          {tab === "rules" && <AdminRules />}
          {tab === "stays" && <AdminBookings />}
          {tab === "parties" && <AdminParties />}
          {tab === "activity" && <AdminActivity />}
        </section>
      </div></div></AppShell>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state } = useApp();
  const pending = state.profiles.filter((profile) => profile.status === "pending").length;
  const activeBookings = state.bookings.filter((booking) => booking.status === "confirmed").length;
  const drafts = state.rooms.filter((room) => room.status === "draft").length;
  return <><div className="metric-grid"><article><span className="metric-icon coral"><Users /></span><div><small>Pending access</small><strong>{pending}</strong><button onClick={() => onNavigate("people")}>Review people <ArrowRight size={14} /></button></div></article><article><span className="metric-icon sea"><CalendarDays /></span><div><small>Active bookings</small><strong>{activeBookings}</strong><button onClick={() => onNavigate("stays")}>View schedule <ArrowRight size={14} /></button></div></article><article><span className="metric-icon sand"><House /></span><div><small>Draft room details</small><strong>{drafts}</strong><button onClick={() => onNavigate("properties")}>Complete drafts <ArrowRight size={14} /></button></div></article></div>
    <div className="admin-card"><div className="card-heading"><div><span className="section-icon"><ListChecks size={18} /></span><div><h2>What needs attention</h2><p>Small things to clear before the next visit.</p></div></div></div><div className="attention-list">{pending > 0 && <button onClick={() => onNavigate("people")}><span className="attention-dot coral" /><div><strong>{pending} person waiting for approval</strong><small>Choose their relationship categories before opening access.</small></div><ArrowRight /></button>}<button onClick={() => onNavigate("properties")}><span className="attention-dot sand" /><div><strong>{drafts} sleeping spaces need capacity details</strong><small>Draft rooms stay hidden and cannot be used as fallbacks.</small></div><ArrowRight /></button><button onClick={() => onNavigate("parties")}><span className="attention-dot sea" /><div><strong>{state.events.filter((event) => event.status === "published").length} private gathering published</strong><small>Event rooms are held away from standard booking.</small></div><ArrowRight /></button></div></div></>;
}

function CategoryChips({ ids }: { ids: string[] }) {
  const { state } = useApp();
  return <div className="chip-row">{ids.map((id) => { const category = state.categories.find((item) => item.id === id); return category ? <span className={`category-chip chip-${category.color}`} key={id}>{category.name}</span> : null; })}</div>;
}

function AdminPeople() {
  const { state, setState, showToast } = useApp();
  const approve = async (id: string) => { const existing = state.profiles.find((profile) => profile.id === id)?.categoryIds ?? []; const familyId = state.categories.find((category) => category.name.toLowerCase() === "family")?.id; const categoryIds = existing.length ? existing : familyId ? [familyId] : [state.categories[0].id]; if (!isDemoMode) { try { await apiRequest(`/admin/users/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify({ categoryIds }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Approval failed.", "error"); } } setState((current) => ({ ...current, profiles: current.profiles.map((profile) => profile.id === id ? { ...profile, status: "active", categoryIds } : profile), audit: [{ id: crypto.randomUUID(), action: "Access approved", actorName: "Sam", detail: `${current.profiles.find((profile) => profile.id === id)?.name} approved.`, createdAt: new Date().toISOString() }, ...current.audit] })); showToast("Access approved."); };
  const toggleCategory = async (profileId: string, categoryId: string) => { const profile = state.profiles.find((item) => item.id === profileId); if (!profile) return; const categoryIds = profile.categoryIds.includes(categoryId) ? profile.categoryIds.filter((id) => id !== categoryId) : [...profile.categoryIds, categoryId]; if (!isDemoMode && profile.status === "active") { try { await apiRequest(`/admin/users/${encodeURIComponent(profileId)}/categories`, { method: "PUT", body: JSON.stringify({ categoryIds }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Category change failed.", "error"); } } setState((current) => ({ ...current, profiles: current.profiles.map((item) => item.id === profileId ? { ...item, categoryIds } : item) })); };
  const addCategory = async () => { const name = window.prompt("Category name"); if (!name?.trim()) return; const description = window.prompt("Short description (optional)") ?? ""; let id: string = crypto.randomUUID(); if (!isDemoMode) { try { const response = await apiRequest<{ id: string }>("/admin/categories", { method: "POST", body: JSON.stringify({ name, description, color: "sea" }) }); id = response.id; } catch (error) { return showToast(error instanceof Error ? error.message : "Category creation failed.", "error"); } } setState((current) => ({ ...current, categories: [...current.categories, { id, name: name.trim(), description, color: "sea" }] })); showToast("Category created."); };
  return <div className="admin-card"><div className="card-heading"><div><span className="section-icon"><Users size={18} /></span><div><h2>People &amp; categories</h2><p>People describe the relationship; hosts decide access and category tags.</p></div></div><button className="button button-outline" onClick={addCategory}><Plus size={16} /> Add category</button></div><div className="people-list">{state.profiles.map((profile) => <article key={profile.id}><div className="avatar avatar-large">{profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="person-copy"><div><h3>{profile.name}</h3><span className={`status-badge ${profile.status === "active" ? "status-open" : "status-draft"}`}>{profile.status}</span></div><p>{profile.email} · {profile.relationship}</p><div className="category-picker">{state.categories.map((category) => <button key={category.id} className={profile.categoryIds.includes(category.id) ? "selected" : ""} onClick={() => toggleCategory(profile.id, category.id)}>{profile.categoryIds.includes(category.id) && <Check size={12} />}{category.name}</button>)}</div></div>{profile.status === "pending" ? <button className="button button-coral button-small" onClick={() => approve(profile.id)}>Approve</button> : <CategoryChips ids={profile.categoryIds} />}</article>)}</div></div>;
}

function AdminProperties() {
  const { state, setState, showToast } = useApp();
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<string | null>(null);
  const importUrl = async (event: FormEvent) => {
    event.preventDefault(); if (!url.startsWith("http")) return showToast("Paste a full Zillow or Airbnb URL.", "error");
    if (!isDemoMode) {
      try {
        const response = await apiRequest<{ propertyId: string; draft: { name: string; description: string; sourceUrl: string; sourceType: "zillow" | "airbnb" | "other" } }>("/admin/properties/import", { method: "POST", body: JSON.stringify({ url }) });
        const property: Property = { id: response.propertyId, slug: `imported-${response.propertyId.slice(0, 8)}`, name: response.draft.name || "Imported property", eyebrow: "REVIEW NEEDED", generalLocation: "Location pending", address: "", timezone: "America/New_York", availableFrom: null, availableUntil: null, summary: response.draft.description || "Complete the imported details before publishing.", sourceLinks: [{ label: "Imported listing", url: response.draft.sourceUrl, type: response.draft.sourceType }], roomIds: [], status: "draft", accent: "dune" };
        setState((current) => ({ ...current, properties: [...current.properties, property] }));
      } catch (error) { return showToast(error instanceof Error ? error.message : "Import failed.", "error"); }
    }
    setImported(url.includes("airbnb.com/l/") ? "That Airbnb link is private, so a draft was created for manual details." : "Public listing details found. Review every field before publishing."); showToast("Property draft created.");
  };
  const completeRoom = async (id: string) => { const room = state.rooms.find((item) => item.id === id); if (!room) return; const answer = window.prompt(`Confirmed sleeping capacity for ${room.name}?`); const capacity = Number(answer); if (!Number.isInteger(capacity) || capacity < 1) return showToast("Enter a confirmed whole-number capacity before publishing.", "error"); if (!isDemoMode) { try { await apiRequest(`/admin/rooms/${id}`, { method: "PATCH", body: JSON.stringify({ capacity, status: "active" }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Room update failed.", "error"); } } setState((current) => ({ ...current, rooms: current.rooms.map((item) => item.id === id ? { ...item, capacity, status: "active" } : item) })); showToast("Room published with the confirmed capacity."); };
  const newProperty = async () => {
    const name = window.prompt("Property name"); if (!name?.trim()) return;
    const generalLocation = window.prompt("General location (shown to approved guests)") ?? "";
    let id: string = crypto.randomUUID(); let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!isDemoMode) { try { const response = await apiRequest<{ id: string; slug: string }>("/admin/properties", { method: "POST", body: JSON.stringify({ name, generalLocation, address: "", timezone: "America/New_York", summary: "" }) }); id = response.id; slug = response.slug; } catch (error) { return showToast(error instanceof Error ? error.message : "Property creation failed.", "error"); } }
    setState((current) => ({ ...current, properties: [...current.properties, { id, slug, name: name.trim(), eyebrow: "DETAILS NEEDED", generalLocation, address: "", timezone: "America/New_York", availableFrom: null, availableUntil: null, summary: "Complete the property details before publishing.", sourceLinks: [], roomIds: [], status: "draft", accent: "dune" }] }));
    showToast("Draft property created.");
  };
  const addRoom = async (propertyId: string) => {
    const name = window.prompt("Room or sleeping-space name"); if (!name?.trim()) return;
    let id: string = crypto.randomUUID();
    if (!isDemoMode) { try { const response = await apiRequest<{ id: string }>(`/admin/properties/${propertyId}/rooms`, { method: "POST", body: JSON.stringify({ name, capacity: null }) }); id = response.id; } catch (error) { return showToast(error instanceof Error ? error.message : "Room creation failed.", "error"); } }
    const room: Room = { id, propertyId, name: name.trim(), description: "Details needed", bed: "Details needed", capacity: null, bathroom: "Details needed", amenities: [], fallbackIds: [], status: "draft" };
    setState((current) => ({ ...current, rooms: [...current.rooms, room], properties: current.properties.map((property) => property.id === propertyId ? { ...property, roomIds: [...property.roomIds, id] } : property) }));
    showToast("Draft sleeping space created.");
  };
  const editProperty = async (property: Property) => {
    const generalLocation = window.prompt("General location", property.generalLocation); if (generalLocation === null) return;
    const summary = window.prompt("Short description", property.summary); if (summary === null) return;
    const availableFromInput = window.prompt("First available check-in (YYYY-MM-DD; blank for no start limit)", property.availableFrom ?? ""); if (availableFromInput === null) return;
    const availableUntilInput = window.prompt("Last allowed checkout (YYYY-MM-DD; blank for no end limit)", property.availableUntil ?? ""); if (availableUntilInput === null) return;
    const availableFrom = availableFromInput.trim() || null; const availableUntil = availableUntilInput.trim() || null;
    if ((availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) || (availableUntil && !/^\d{4}-\d{2}-\d{2}$/.test(availableUntil))) return showToast("Use YYYY-MM-DD for availability dates.", "error");
    if (availableFrom && availableUntil && availableUntil <= availableFrom) return showToast("The final checkout must be after the first check-in.", "error");
    if (!isDemoMode) { try { await apiRequest(`/admin/properties/${property.id}`, { method: "PATCH", body: JSON.stringify({ generalLocation, summary, availableFrom, availableUntil }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Property update failed.", "error"); } }
    setState((current) => ({ ...current, properties: current.properties.map((item) => item.id === property.id ? { ...item, generalLocation, summary, availableFrom, availableUntil } : item) }));
    showToast("Property details updated.");
  };
  return <>
    <div className="admin-card import-card"><div className="card-heading"><div><span className="section-icon"><Import size={18} /></span><div><h2>Add from a listing link</h2><p>We’ll gather public details into a draft. Nothing publishes until you review it.</p></div></div></div><form className="import-form" onSubmit={importUrl}><Link2 size={18} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a Zillow or public Airbnb URL" aria-label="Property listing URL" /><button className="button button-ink">Import draft</button></form>{imported && <p className="import-result"><CircleAlert size={16} /> {imported}</p>}</div>
    <div className="admin-card"><div className="card-heading"><div><span className="section-icon"><House size={18} /></span><div><h2>Properties &amp; rooms</h2><p>Draft spaces stay private and never receive fallback moves.</p></div></div><button className="button button-outline" onClick={newProperty}><Plus size={16} /> New property</button></div><div className="property-admin-list">{state.properties.map((property) => <article key={property.id}><div className={`mini-cover cover-${property.accent}`}><House size={28} /></div><div className="property-admin-copy"><div><h3>{property.name}</h3><span className={`status-badge ${property.status === "active" ? "status-open" : "status-draft"}`}>{property.status}</span></div><p>{property.generalLocation} · {state.rooms.filter((room) => room.propertyId === property.id && room.status === "active").length} live rooms{formatAvailabilityWindow(property) ? ` · ${formatAvailabilityWindow(property)}` : ""}</p><div className="draft-room-list">{state.rooms.filter((room) => room.propertyId === property.id).map((room) => <span key={room.id}>{room.name}<i className={room.status === "active" ? "ready" : ""}>{room.status}</i>{room.status === "draft" && <button onClick={() => completeRoom(room.id)}>Complete</button>}</span>)}<button className="inline-add" onClick={() => addRoom(property.id)}><Plus size={13} /> Add sleeping space</button></div></div><button className="icon-button" onClick={() => editProperty(property)} aria-label={`Edit ${property.name}`}><Settings2 size={18} /></button></article>)}</div></div>
  </>;
}

function AdminRules() {
  const { state, setState, showToast } = useApp();
  const [checkIn, setCheckIn] = useState(""); const [checkOut, setCheckOut] = useState(""); const [categoryId, setCategoryId] = useState(state.categories.find((category) => category.name === "Parent")?.id ?? state.categories[0]?.id ?? ""); const [reason, setReason] = useState("No parents week");
  const addBlock = async (event: FormEvent) => { event.preventDefault(); const error = validateStayRange({ checkIn, checkOut }); if (error && nightsBetween(checkIn, checkOut) <= 0) return showToast(error, "error"); const propertyId = state.properties.find((property) => property.slug === "rockaway-house")?.id ?? state.properties[0]?.id; if (!propertyId) return showToast("Add a property first.", "error"); let id: string = crypto.randomUUID(); if (!isDemoMode) { try { const response = await apiRequest<{ id: string }>("/admin/blocks", { method: "POST", body: JSON.stringify({ propertyId, checkIn, checkOut, categoryIds: [categoryId], reason }) }); id = response.id; } catch (apiError) { return showToast(apiError instanceof Error ? apiError.message : "Blackout failed.", "error"); } } setState((current) => ({ ...current, blocks: [...current.blocks, { id, propertyId, checkIn, checkOut, categoryIds: [categoryId], reason }] })); showToast("Blackout added. Existing conflicts must be resolved before publishing."); };
  const rockaway = state.properties.find((property) => property.slug === "rockaway-house"); const adu = state.rooms.find((room) => room.propertyId === rockaway?.id && room.name.includes("ADU")); const momCategory = state.categories.find((category) => category.name.toLowerCase() === "mom"); const momRule = state.priorityRules.find((rule) => rule.propertyId === rockaway?.id && rule.categoryId === momCategory?.id);
  const changeMomRank = async () => { if (!rockaway || !momCategory) return; const rank = Number(window.prompt("Mom priority rank at Rockaway", String(momRule?.rank ?? 100))); if (!Number.isInteger(rank) || rank < 0) return showToast("Enter a whole-number rank of zero or more.", "error"); if (!isDemoMode) { try { await apiRequest("/admin/priorities", { method: "PUT", body: JSON.stringify({ propertyId: rockaway.id, categoryId: momCategory.id, rank }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Priority update failed.", "error"); } } setState((current) => ({ ...current, priorityRules: [...current.priorityRules.filter((rule) => !(rule.propertyId === rockaway.id && rule.categoryId === momCategory.id)), { id: `${rockaway.id}:${momCategory.id}`, propertyId: rockaway.id, categoryId: momCategory.id, rank }] })); showToast("Priority rank updated."); };
  const configureFallbacks = async () => { if (!adu || !rockaway) return; const candidates = state.rooms.filter((room) => room.propertyId === rockaway.id && room.id !== adu.id && !room.name.toLowerCase().includes("couch")); const answer = window.prompt(`Ordered ADU fallbacks (comma-separated room numbers):\n${candidates.map((room, index) => `${index + 1}. ${room.name}`).join("\n")}`, candidates.map((_, index) => index + 1).join(",")); if (answer === null) return; const fallbackIds = answer.split(",").map((value) => candidates[Number(value.trim()) - 1]?.id).filter((id): id is string => Boolean(id)); if (fallbackIds.length !== new Set(fallbackIds).size) return showToast("Choose each fallback at most once.", "error"); if (!isDemoMode) { try { await apiRequest(`/admin/rooms/${adu.id}/fallbacks`, { method: "PUT", body: JSON.stringify({ fallbackIds }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "Fallback update failed.", "error"); } } setState((current) => ({ ...current, rooms: current.rooms.map((room) => room.id === adu.id ? { ...room, fallbackIds } : room) })); showToast("Fallback order updated. The couch remains excluded."); };
  return <><div className="admin-card"><div className="card-heading"><div><span className="section-icon"><LockKeyhole size={18} /></span><div><h2>Category blackouts</h2><p>Blackouts override every priority level, including moms.</p></div></div></div><form className="rules-form" onSubmit={addBlock}><label><span>From</span><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required /></label><label><span>To</span><input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required /></label><label><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{state.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="reason-field"><span>Label</span><input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="button button-coral"><Plus size={16} /> Add blackout</button></form><div className="rule-list">{state.blocks.map((block) => <article key={block.id}><span className="rule-icon"><LockKeyhole size={17} /></span><div><strong>{block.reason}</strong><small>{formatDateRange(block.checkIn, block.checkOut)} · Rockaway House</small></div><CategoryChips ids={block.categoryIds} /></article>)}</div></div>
    <div className="admin-card"><div className="card-heading"><div><span className="section-icon"><Sparkles size={18} /></span><div><h2>Priority &amp; fallbacks</h2><p>Higher ranks can move lower ranks only when every guest has a suitable fallback.</p></div></div></div><div className="priority-map"><div className="priority-source"><CategoryChips ids={momCategory ? [momCategory.id] : []} /><strong>Rank {momRule?.rank ?? 100} at Rockaway</strong><small>Can request an occupied priority room</small><button onClick={changeMomRank}>Edit rank</button></div><ArrowRight /><div className="priority-room"><BedDouble size={19} /><strong>Rockaway ADU</strong><small>Priority room</small></div><ArrowRight /><div className="fallback-stack">{adu?.fallbackIds.map((id, index) => <span key={id}>{index + 1}. {state.rooms.find((room) => room.id === id)?.name}</span>)}<small>Couch is never a fallback</small><button onClick={configureFallbacks}>Edit order</button></div></div></div></>;
}

function AdminParties() {
  const { state, setState, showToast } = useApp();
  const [title, setTitle] = useState(""); const [checkIn, setCheckIn] = useState(""); const [checkOut, setCheckOut] = useState("");
  const create = async (event: FormEvent) => { event.preventDefault(); const propertyId = state.properties.find((property) => property.slug === "rockaway-house")?.id ?? state.properties[0].id; const roomId = state.rooms.find((room) => room.propertyId === propertyId && room.status === "active")?.id; if (!roomId) return showToast("Publish at least one room before creating a party.", "error"); let party: PartyEvent = { id: crypto.randomUUID(), slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), propertyId, title, description: "A private gathering at Rockaway House.", checkIn, checkOut, roomIds: [roomId], status: "draft", inviteToken: crypto.randomUUID(), rsvps: [] }; if (!isDemoMode) { try { const response = await apiRequest<{ id: string; slug: string; inviteToken: string }>("/admin/events", { method: "POST", body: JSON.stringify({ title, description: party.description, propertyId, roomIds: [roomId], checkIn, checkOut, publish: false }) }); party = { ...party, ...response }; } catch (error) { return showToast(error instanceof Error ? error.message : "Party creation failed.", "error"); } } setState((current) => ({ ...current, events: [...current.events, party] })); setTitle(""); showToast("Party draft created. Resolve any room conflicts before publishing."); };
  const copyLink = async (party: PartyEvent) => { let token = party.inviteToken; if (!isDemoMode) { try { const response = await apiRequest<{ inviteToken: string }>(`/admin/events/${party.id}/rotate-invite`, { method: "POST" }); token = response.inviteToken; setState((current) => ({ ...current, events: current.events.map((item) => item.id === party.id ? { ...item, inviteToken: token } : item) })); } catch (error) { return showToast(error instanceof Error ? error.message : "Invitation rotation failed.", "error"); } } await navigator.clipboard.writeText(`${window.location.origin}/party/${party.slug}?invite=${token}`); showToast(isDemoMode ? "Private party link copied." : "Previous link revoked; a new private link was copied."); };
  const publishParty = async (party: PartyEvent) => { if (!isDemoMode) { try { await apiRequest(`/admin/events/${party.id}/publish`, { method: "POST" }); } catch (error) { return showToast(error instanceof Error ? error.message : "Publication failed.", "error"); } } const hasConflict = state.bookings.some((booking) => booking.status === "confirmed" && party.roomIds.includes(booking.roomId) && rangesOverlap(booking, party)); if (hasConflict) return showToast("Resolve the selected room conflicts before publishing.", "error"); setState((current) => ({ ...current, events: current.events.map((item) => item.id === party.id ? { ...item, status: "published" } : item) })); showToast("Party published. Its rooms are now held from normal booking."); };
  return <><div className="admin-card"><div className="card-heading"><div><span className="section-icon"><PartyPopper size={18} /></span><div><h2>Create a private party</h2><p>Choose dates and rooms; published events hold those rooms from normal booking.</p></div></div></div><form className="party-form" onSubmit={create}><label><span>Party name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Rockaway birthday weekend" required /></label><label><span>Starts</span><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required /></label><label><span>Ends</span><input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required /></label><button className="button button-coral"><Plus size={16} /> Create draft</button></form></div><div className="party-list">{state.events.map((party) => <article className="admin-card" key={party.id}><div className="party-badge"><PartyPopper /></div><div className="party-copy"><div><span className={`status-badge ${party.status === "published" ? "status-open" : "status-draft"}`}>{party.status}</span><small>{formatDateRange(party.checkIn, party.checkOut)}</small></div><h3>{party.title}</h3><p>{party.description}</p><span>{party.rsvps.length} RSVPs · {party.roomIds.length} room{party.roomIds.length === 1 ? "" : "s"} {party.status === "published" ? "held" : "selected"}</span></div><div className="party-actions">{party.status === "draft" ? <button className="button button-coral" onClick={() => publishParty(party)}>Publish &amp; hold rooms</button> : <><button className="button button-outline" onClick={() => copyLink(party)}><Link2 size={15} /> Copy private link</button><Link className="button button-quiet" to={`/party/${party.slug}?invite=${party.inviteToken}`}>Open page</Link></>}</div></article>)}</div></>;
}

function AdminBookings() {
  const { state } = useApp();
  const [propertyId, setPropertyId] = useState("all");
  const [timing, setTiming] = useState<StayTiming>("upcoming");
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const visible = hostScheduleBookings(state.bookings, { propertyId, timing, today });
  const propertyCount = new Set(visible.map((booking) => booking.propertyId)).size;
  const inHouseCount = visible.filter((booking) => stayPhase(booking, today) === "in-house").length;
  const formatScheduleDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return <div className="admin-card host-schedule-card">
    <div className="card-heading"><div><span className="section-icon"><CalendarDays size={18} /></span><div><h2>Who’s staying where</h2><p>Every confirmed room assignment, guest, and date—visible only to Sam and Lisa.</p></div></div></div>
    <div className="host-schedule-toolbar">
      <label><span>Property</span><select aria-label="Filter stays by property" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="all">All properties</option>{state.properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
      <label><span>Dates</span><select aria-label="Filter stays by timing" value={timing} onChange={(event) => setTiming(event.target.value as StayTiming)}><option value="upcoming">Upcoming &amp; in-house</option><option value="past">Past stays</option><option value="all">All stays</option></select></label>
      <div className="schedule-summary" aria-live="polite"><span><strong>{visible.length}</strong> room stay{visible.length === 1 ? "" : "s"}</span><span><strong>{propertyCount}</strong> propert{propertyCount === 1 ? "y" : "ies"}</span><span><strong>{inHouseCount}</strong> in-house now</span></div>
    </div>
    {visible.length === 0 ? <EmptyState icon={<CalendarDays />} title="No matching stays" copy="Confirmed room reservations will appear here as soon as someone books." /> : <div className="schedule-table" role="table" aria-label="Host occupancy schedule">
      <div className="schedule-row schedule-head" role="row"><span role="columnheader">When</span><span role="columnheader">Who</span><span role="columnheader">Where</span><span role="columnheader">Stay details</span></div>
      {visible.map((booking) => {
        const guest = state.profiles.find((profile) => profile.id === booking.userId);
        const room = state.rooms.find((item) => item.id === booking.roomId);
        const property = state.properties.find((item) => item.id === booking.propertyId);
        const event = booking.eventId ? state.events.find((item) => item.id === booking.eventId) : undefined;
        const movedFrom = booking.movedFromRoomId ? state.rooms.find((item) => item.id === booking.movedFromRoomId) : undefined;
        const phase = stayPhase(booking, today);
        return <article className="schedule-row schedule-stay" role="row" key={booking.id}>
          <div className="schedule-when" role="cell"><span className={`stay-phase phase-${phase}`}>{phase === "in-house" ? "In house" : phase}</span><div><time dateTime={booking.checkIn}>{formatScheduleDate(booking.checkIn)}</time><span>to</span><time dateTime={booking.checkOut}>{formatScheduleDate(booking.checkOut)}</time></div></div>
          <div className="schedule-who" role="cell"><div className="avatar avatar-large">{guest?.name.split(" ").map((part) => part[0]).slice(0, 2).join("") ?? "?"}</div><div><strong>{guest?.name ?? "Unknown guest"}</strong><small>{guest?.relationship || "Approved guest"}</small></div></div>
          <div className="schedule-where" role="cell"><span className={`schedule-property-dot dot-${property?.accent ?? "ocean"}`} /><div><strong>{room?.name ?? "Unknown room"}</strong><small>{property?.name ?? "Unknown property"} · {property?.generalLocation}</small></div></div>
          <div className="schedule-details" role="cell"><span><Users size={14} /> {booking.partySize} guest{booking.partySize === 1 ? "" : "s"}</span>{event && <span><PartyPopper size={14} /> {event.title}</span>}{movedFrom && <small>Moved from {movedFrom.name}</small>}</div>
        </article>;
      })}
    </div>}
  </div>;
}

function AdminActivity() {
  const { state } = useApp();
  return <div className="admin-card"><div className="card-heading"><div><span className="section-icon"><Clock3 size={18} /></span><div><h2>Activity &amp; audit trail</h2><p>Every important approval, booking, move, and policy change is recorded.</p></div></div></div><div className="activity-list">{state.audit.map((entry) => <article key={entry.id}><span /><div><strong>{entry.action}</strong><p>{entry.detail}</p><small>{entry.actorName} · {new Date(entry.createdAt).toLocaleString()}</small></div></article>)}</div></div>;
}

function PartyPage() {
  const { slug } = useParams(); const { state, setState, currentUser, showToast } = useApp(); const party = state.events.find((event) => event.slug === slug); const [partySize, setPartySize] = useState(1); const [roomIds, setRoomIds] = useState<string[]>([]);
  if (!party) return <Navigate to="/" replace />;
  const property = state.properties.find((item) => item.id === party.propertyId)!; const eventRooms = state.rooms.filter((room) => party.roomIds.includes(room.id));
  const respond = async (status: "attending" | "not-attending") => { if (!isDemoMode) { try { await apiRequest(`/events/${party.id}/rsvp`, { method: "POST", body: JSON.stringify({ status, partySize, roomIds: status === "attending" ? roomIds : [] }) }); } catch (error) { return showToast(error instanceof Error ? error.message : "RSVP failed.", "error"); } } setState((current) => ({ ...current, events: current.events.map((event) => event.id === party.id ? { ...event, rsvps: [...event.rsvps.filter((rsvp) => rsvp.userId !== currentUser.id), { userId: currentUser.id, status, partySize, roomIds: status === "attending" ? roomIds : [] }] } : event) })); showToast(status === "attending" ? "You’re on the list. Party details are saved here." : "Response saved. We’ll miss you!"); };
  return <main className="party-page"><header><Brand light /><span><LockKeyhole size={14} /> Private invitation</span></header><section className="party-hero"><div className="party-kicker"><PartyPopper size={18} /> YOU’RE INVITED</div><h1>{party.title}</h1><p>{party.description}</p><div className="party-details"><span><CalendarDays /> <b>{formatDateRange(party.checkIn, party.checkOut)}</b></span><span><MapPin /> <b>{property.generalLocation}</b></span></div></section><section className="rsvp-card"><div><p className="eyebrow">YOUR RSVP</p><h2>Will you join us?</h2><p>Sign in keeps the guest list tidy. This invitation only unlocks this party—not the normal booking calendar.</p></div><label className="field-label"><span>People in your group</span><select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>{[1,2,3,4,5,6].map((number) => <option key={number}>{number}</option>)}</select></label><div className="event-room-choice"><span>Need a room? <small>Optional</small></span>{eventRooms.map((room) => <label key={room.id}><input type="checkbox" checked={roomIds.includes(room.id)} onChange={(event) => setRoomIds((current) => event.target.checked ? [...current, room.id] : current.filter((id) => id !== room.id))} /><span><BedDouble size={18} /><b>{room.name}</b><small>{room.bed}</small></span></label>)}</div><div className="rsvp-actions"><button className="button button-coral" onClick={() => respond("attending")}><Check size={17} /> I’m coming</button><button className="button button-quiet" onClick={() => respond("not-attending")}>Can’t make it</button></div></section></main>;
}

function OnboardingPage() {
  const navigate = useNavigate(); const { currentUser, setState, showToast } = useApp(); const [name, setName] = useState(currentUser.name); const [relationship, setRelationship] = useState(currentUser.relationship); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); if (!isDemoMode) { try { await apiRequest("/profile/onboarding", { method: "POST", body: JSON.stringify({ name, relationship }) }); } catch (error) { setBusy(false); return showToast(error instanceof Error ? error.message : "Request failed.", "error"); } } setState((current) => ({ ...current, profiles: current.profiles.map((profile) => profile.id === currentUser.id ? { ...profile, name, relationship, status: "pending" } : profile) })); showToast("Thanks—Sam or Lisa will review your request."); navigate("/pending"); };
  return <main className="onboarding-page"><Brand /><form onSubmit={submit}><p className="eyebrow">ONE QUICK INTRODUCTION</p><h1>How do you know Sam or Lisa?</h1><p>This helps the hosts put you in the right booking categories. You can’t assign yourself special access.</p><label className="field-label"><span>Your full name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" minLength={2} maxLength={120} required /></label><label className="field-label"><span>Your relationship</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Lisa’s cousin, Sam’s college friend…" minLength={2} maxLength={300} required /></label><button className="button button-coral button-full" disabled={busy}>{busy ? "Sending request…" : <>Request access <ArrowRight size={17} /></>}</button></form></main>;
}

function PendingPage() { return <main className="pending-page"><Brand /><div><span><Mail size={26} /></span><p className="eyebrow">REQUEST RECEIVED</p><h1>You’re on the list.</h1><p>Sam or Lisa will choose your booking categories. We’ll email you when the private room calendar opens.</p><Link to="/">Back home</Link></div></main>; }

function ActiveRoute({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { currentUser } = useApp();
  if (!currentUser.relationship && currentUser.role !== "admin") return <Navigate to="/onboarding" replace />;
  if (currentUser.status !== "active") return <Navigate to="/pending" replace />;
  if (admin && currentUser.role !== "admin") return <Navigate to="/book" replace />;
  return children;
}

function AppRoutes() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/auth/:pathname" element={<AuthPage />} /><Route path="/book" element={<ActiveRoute><BookingPage /></ActiveRoute>} /><Route path="/stays" element={<ActiveRoute><MyStaysPage /></ActiveRoute>} /><Route path="/notifications" element={<ActiveRoute><NotificationsPage /></ActiveRoute>} /><Route path="/admin" element={<ActiveRoute admin><AdminPage /></ActiveRoute>} /><Route path="/party/:slug" element={<PartyPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route path="/pending" element={<PendingPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}

export default function App() {
  const location = useLocation();
  const redeemedInvite = useRef<string | null>(null);
  const [serverState, setServerState] = useState<AppState | null>(null);
  const publicPage = location.pathname === "/" || location.pathname.startsWith("/auth/");
  const [loading, setLoading] = useState(!isDemoMode && !publicPage);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode || publicPage) { setLoading(false); return; }
    const inviteInUrl = location.pathname.startsWith("/party/") ? new URLSearchParams(location.search).get("invite") : null;
    const needsInvite = Boolean(inviteInUrl && redeemedInvite.current !== inviteInUrl);
    if (serverState && !needsInvite) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setLoadError(null);
      try {
        const invite = inviteInUrl;
        const slug = location.pathname.startsWith("/party/") ? location.pathname.split("/")[2] : "";
        if (invite && slug && needsInvite) { await apiRequest("/events/redeem", { method: "POST", body: JSON.stringify({ token: invite, slug }) }); redeemedInvite.current = invite; }
        const response = await apiRequest<{ state: AppState }>("/bootstrap");
        if (!cancelled) setServerState(response.state);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load your account.");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [location.pathname, location.search, publicPage, serverState]);

  if (loading) return <div className="app-loading"><Brand /><span /><p>Opening the family calendar…</p></div>;
  if (loadError) { const returnTo = `${location.pathname}${location.search}`; return <div className="app-loading error"><CircleAlert /><h1>We couldn’t open the calendar.</h1><p>{loadError}</p><Link className="button button-ink" to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in with email</Link><Link to="/">Back home</Link></div>; }
  return <AppProvider key={serverState?.profiles[0]?.id ?? "demo"} initialState={serverState ?? demoState}><AppRoutes /></AppProvider>;
}
