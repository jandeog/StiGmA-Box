'use client';

import React, { useState, useCallback } from 'react';

type Track = {
  id: string;
  name: string;
  artists: string;
  durationMs: number;
  spotifyUrl: string;
};

type AnnouncementEvent = {
  atSeconds: number;
  text: string;
};

type MixPlan = {
  totalDurationSeconds: number;
  tracks: Track[];
  announcements: AnnouncementEvent[];
};

type AnnouncementStyle = 'hype' | 'calm' | 'serious' | 'drill';
type AnnouncementLanguage = 'en' | 'el' | 'en+el';

// Placeholder: in a real app you’d call your backend, which calls Spotify Web API
async function fetchTracksFromPlaylistOrLinks(
  playlistUrl: string,
  trackLinksRaw: string
): Promise<Track[]> {
  // TODO: Implement real Spotify integration:
  // - If playlistUrl is provided:
  //     Call your backend: GET /api/spotify/playlist?url=...
  // - If trackLinksRaw is provided:
  //     Split lines, resolve each Spotify track URL via backend.
  //
  // For now, return a mocked set of tracks with approximate duration.
  const mockTracks: Track[] = [
    {
      id: 'mock1',
      name: 'Warmup Beat',
      artists: 'DJ Placeholder',
      durationMs: 3 * 60 * 1000,
      spotifyUrl: 'https://open.spotify.com/track/mock1',
    },
    {
      id: 'mock2',
      name: 'Main Engine',
      artists: 'DJ Placeholder',
      durationMs: 4 * 60 * 1000,
      spotifyUrl: 'https://open.spotify.com/track/mock2',
    },
    {
      id: 'mock3',
      name: 'Final Push',
      artists: 'DJ Placeholder',
      durationMs: 5 * 60 * 1000,
      spotifyUrl: 'https://open.spotify.com/track/mock3',
    },
  ];

  return mockTracks;
}

// Choose enough tracks (in order) to cover at least totalSeconds
function buildTrackSelection(tracks: Track[], totalSeconds: number): Track[] {
  const selection: Track[] = [];
  let accMs = 0;

  for (const track of tracks) {
    selection.push(track);
    accMs += track.durationMs;
    if (accMs / 1000 >= totalSeconds) break;
  }

  // If still not enough duration (few tracks), just loop them
  let idx = 0;
  while (accMs / 1000 < totalSeconds && tracks.length > 0 && idx < 20) {
    const t = tracks[idx % tracks.length];
    selection.push(t);
    accMs += t.durationMs;
    idx++;
  }

  return selection;
}

// Call AI WOD planner (Gemini) to infer duration + announcements
async function fetchWodPlan(
  wodDescription: string,
  style: AnnouncementStyle,
  language: AnnouncementLanguage,
  options: {
    includeCountdownStart: boolean;
    includeMidCues: boolean;
    includeOneMinute: boolean;
    includeFinalCountdown: boolean;
  }
): Promise<{ totalDurationSeconds: number; announcements: AnnouncementEvent[] }> {
  const res = await fetch('/api/wod-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wodDescription,
      announcementStyle: style,
      language,
      options,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to generate WOD plan');
  }

  const data = await res.json();
  return {
    totalDurationSeconds: data.totalDurationSeconds,
    announcements: data.announcements as AnnouncementEvent[],
  };
}

// Use browser SpeechSynthesis to play announcements with style/language flavor
function speak(
  text: string,
  style: AnnouncementStyle,
  language: AnnouncementLanguage
) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) {
    console.log('Announcement:', text);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Language hint
  if (language === 'el') {
    utterance.lang = 'el-GR';
  } else if (language === 'en') {
    utterance.lang = 'en-US';
  } else {
    // en+el: let browser decide, but we default to English
    utterance.lang = 'en-US';
  }

  // Voice style tweaks
  switch (style) {
    case 'hype':
      utterance.rate = 1.12;
      utterance.pitch = 1.05;
      break;
    case 'calm':
      utterance.rate = 0.95;
      utterance.pitch = 0.95;
      break;
    case 'serious':
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      break;
    case 'drill':
      utterance.rate = 1.15;
      utterance.pitch = 0.8;
      break;
  }

  // Try to choose a matching voice by language if available
  const voices = window.speechSynthesis.getVoices();
  const targetLang = language === 'el' ? 'el' : 'en';
  const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.speak(utterance);
}

const WodDjPage: React.FC = () => {
  const [wodDescription, setWodDescription] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [trackLinks, setTrackLinks] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [mixPlan, setMixPlan] = useState<MixPlan | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [announcementStyle, setAnnouncementStyle] =
    useState<AnnouncementStyle>('hype');
  const [announcementLanguage, setAnnouncementLanguage] =
    useState<AnnouncementLanguage>('en');
  const [includeCountdownStart, setIncludeCountdownStart] = useState(true);
  const [includeMidCues, setIncludeMidCues] = useState(true);
  const [includeOneMinute, setIncludeOneMinute] = useState(true);
  const [includeFinalCountdown, setIncludeFinalCountdown] = useState(true);

  // Stub: in real app, call backend to search Spotify
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    // TODO: call /api/spotify/search?query=...
    const mock: Track = {
      id: `search-${Date.now()}`,
      name: `Result for "${searchQuery}"`,
      artists: 'Mock Artist',
      durationMs: 3 * 60 * 1000,
      spotifyUrl: 'https://open.spotify.com/track/mock-search',
    };
    setSearchResults([mock]);
  };

  const toggleSelectTrack = (track: Track) => {
    setSelectedTracks((prev) => {
      const exists = prev.find((t) => t.id === track.id);
      if (exists) {
        return prev.filter((t) => t.id !== track.id);
      }
      return [...prev, track];
    });
  };

  const handleCompute = useCallback(async () => {
    if (!wodDescription.trim()) {
      alert('Please enter a WOD description.');
      return;
    }

    setIsComputing(true);
    try {
      // 1) Ask AI to infer time cap + announcements
      const { totalDurationSeconds, announcements } = await fetchWodPlan(
        wodDescription,
        announcementStyle,
        announcementLanguage,
        {
          includeCountdownStart,
          includeMidCues,
          includeOneMinute,
          includeFinalCountdown,
        }
      );

      // 2) Fetch tracks (still mocked for now)
      const baseTracks = await fetchTracksFromPlaylistOrLinks(
        playlistUrl,
        trackLinks
      );

      // 3) Combine tracks from search + playlist/links
      const mergedTracks: Track[] = [
        ...selectedTracks,
        ...baseTracks.filter((t) => !selectedTracks.some((s) => s.id === t.id)),
      ];

      if (mergedTracks.length === 0) {
        alert(
          'No tracks available. Add a playlist URL, track links, or select search results.'
        );
        return;
      }

      // 4) Decide which tracks to use to cover the inferred time cap
      const selectedForMix = buildTrackSelection(
        mergedTracks,
        totalDurationSeconds
      );

      const plan: MixPlan = {
        totalDurationSeconds,
        tracks: selectedForMix,
        announcements,
      };

      setMixPlan(plan);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error while computing mix');
    } finally {
      setIsComputing(false);
    }
  }, [
    wodDescription,
    playlistUrl,
    trackLinks,
    selectedTracks,
    announcementStyle,
    announcementLanguage,
    includeCountdownStart,
    includeMidCues,
    includeOneMinute,
    includeFinalCountdown,
  ]);

  const handlePlay = () => {
    if (!mixPlan) {
      alert('Compute the mix first.');
      return;
    }
    if (typeof window === 'undefined') return;

    setIsPlaying(true);

    // Clear any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Schedule announcements
    mixPlan.announcements.forEach((event) => {
      const delayMs = event.atSeconds * 1000;
      setTimeout(() => {
        speak(event.text, announcementStyle, announcementLanguage);
      }, delayMs);
    });

    // TODO: integrate Spotify Web Playback SDK here.
    console.log('Starting WOD DJ mix...');
    console.log('Tracks in mix order:', mixPlan.tracks);
    console.log('Total duration (s):', mixPlan.totalDurationSeconds);

    setTimeout(() => {
      setIsPlaying(false);
    }, mixPlan.totalDurationSeconds * 1000 + 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center p-6">
      <div className="w-full max-w-5xl space-y-6">
        <header className="border-b border-slate-800 pb-4 mb-4">
          <h1 className="text-3xl font-bold tracking-tight">
            WOD DJ Coach 🎧
          </h1>
          <p className="text-slate-400 mt-1">
            Paste your WOD, choose voice & language, connect Spotify, and let the AI coach the class.
          </p>
        </header>

        {/* WOD configuration */}
        <section className="rounded-2xl border border-slate-800 p-4 space-y-4 bg-slate-900/40">
          <h2 className="text-xl font-semibold">1. WOD Setup</h2>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              WOD description
            </label>
            <textarea
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={4}
              placeholder="E.g. 20 min AMRAP: 10 burpees, 15 kettlebell swings, 200m run...&#10;Or: For time, with a 15 minute cap: 21-15-9 thrusters & pull-ups..."
              value={wodDescription}
              onChange={(e) => setWodDescription(e.target.value)}
            />
          </div>

          {/* Announcement settings */}
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Coach voice & language
              </h3>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Style</label>
                <div className="flex flex-wrap gap-2">
                  {(['hype', 'calm', 'serious', 'drill'] as AnnouncementStyle[]).map(
                    (style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setAnnouncementStyle(style)}
                        className={`text-xs rounded-full px-3 py-1 border ${
                          announcementStyle === style
                            ? 'bg-emerald-500 border-emerald-400 text-slate-900'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        {style === 'hype' && 'Hype'}
                        {style === 'calm' && 'Calm'}
                        {style === 'serious' && 'Serious'}
                        {style === 'drill' && 'Drill'}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Language</label>
                <div className="flex flex-wrap gap-2">
                  {(['en', 'el', 'en+el'] as AnnouncementLanguage[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setAnnouncementLanguage(lang)}
                      className={`text-xs rounded-full px-3 py-1 border ${
                        announcementLanguage === lang
                          ? 'bg-sky-500 border-sky-400 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-slate-200'
                      }`}
                    >
                      {lang === 'en' && 'English'}
                      {lang === 'el' && 'Greek'}
                      {lang === 'en+el' && 'EN + GR'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Announcement types
              </h3>
              <div className="space-y-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={includeCountdownStart}
                    onChange={(e) => setIncludeCountdownStart(e.target.checked)}
                  />
                  <span>Intro countdown & “3, 2, 1, GO!”</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={includeMidCues}
                    onChange={(e) => setIncludeMidCues(e.target.checked)}
                  />
                  <span>Mid-workout coaching & encouragement</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={includeOneMinute}
                    onChange={(e) => setIncludeOneMinute(e.target.checked)}
                  />
                  <span>“1 minute to go” reminder</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={includeFinalCountdown}
                    onChange={(e) => setIncludeFinalCountdown(e.target.checked)}
                  />
                  <span>Final 10 second countdown & TIME!</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Spotify input */}
        <section className="rounded-2xl border border-slate-800 p-4 space-y-4 bg-slate-900/40">
          <h2 className="text-xl font-semibold">2. Music Sources (Spotify)</h2>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Spotify playlist URL (optional)
            </label>
            <input
              type="text"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://open.spotify.com/playlist/..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Individual Spotify track URLs, one per line (optional)
            </label>
            <textarea
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="https://open.spotify.com/track/...\nhttps://open.spotify.com/track/..."
              value={trackLinks}
              onChange={(e) => setTrackLinks(e.target.value)}
            />
          </div>

          {/* Spotify search stub */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Search Spotify (stubbed – wire to backend)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Song / artist / mood..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={handleSearch}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium hover:bg-emerald-400 transition"
              >
                Search
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-800 rounded-xl p-2 max-h-40 overflow-auto text-sm">
                {searchResults.map((track) => {
                  const selected = selectedTracks.some((t) => t.id === track.id);
                  return (
                    <button
                      key={track.id}
                      onClick={() => toggleSelectTrack(track)}
                      className={`w-full text-left px-2 py-1 rounded-lg mb-1 ${
                        selected ? 'bg-emerald-600/40' : 'bg-slate-900/40'
                      } hover:bg-slate-800`}
                    >
                      <div className="font-medium">{track.name}</div>
                      <div className="text-xs text-slate-400">
                        {track.artists}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Controls */}
        <section className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleCompute}
            disabled={isComputing}
            className="rounded-2xl bg-emerald-500 px-6 py-2 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isComputing ? 'Computing…' : 'Compute WOD Mix'}
          </button>
          <button
            onClick={handlePlay}
            disabled={!mixPlan || isPlaying}
            className="rounded-2xl bg-sky-500 px-6 py-2 text-sm font-semibold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPlaying ? 'Playing…' : 'Play Coach + Music'}
          </button>
        </section>

        {/* Mix summary */}
        {mixPlan && (
          <section className="rounded-2xl border border-slate-800 p-4 space-y-3 bg-slate-900/40">
            <h2 className="text-xl font-semibold">3. Mix Plan Overview</h2>
            <p className="text-sm text-slate-300">
              Inferred workout time:{' '}
              <span className="font-semibold">
                {Math.round(mixPlan.totalDurationSeconds / 60)} min
              </span>
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-1 text-sm uppercase tracking-wide text-slate-400">
                  Tracks (planned order)
                </h3>
                <ol className="text-sm space-y-1">
                  {mixPlan.tracks.map((t, idx) => (
                    <li key={`${t.id}-${idx}`} className="flex items-center gap-2">
                      <span className="text-slate-500 w-5">{idx + 1}.</span>
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-slate-400">
                          {t.artists} · ~{Math.round(t.durationMs / 60000)} min
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="font-medium mb-1 text-sm uppercase tracking-wide text-slate-400">
                  Announcements timeline
                </h3>
                <ul className="text-sm space-y-1 max-h-64 overflow-auto">
                  {mixPlan.announcements.map((a, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-slate-500 w-16">
                        {Math.floor(a.atSeconds / 60)
                          .toString()
                          .padStart(2, '0')}
                        :
                        {(a.atSeconds % 60).toString().padStart(2, '0')}
                      </span>
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default WodDjPage;
