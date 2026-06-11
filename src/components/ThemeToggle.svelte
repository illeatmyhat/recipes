<script lang="ts">
  // A two-position sliding switch for the colour theme. The inline <head>
  // script in RecipeLayout has already resolved and applied the theme before
  // paint; this island just mirrors that state and lets the user override it.
  //
  // Default is the OS preference; an explicit click is remembered in
  // localStorage. While no explicit choice exists, the switch keeps following
  // the OS live (the `change` listener below).
  import { onMount } from 'svelte';
  import { locale } from './LocaleStore';
  import { t } from '../lib/i18n';
  import type { Theme } from '../lib/types';

  let theme = $state<Theme>('light');
  let mounted = $state(false);

  /** Apply a theme to <html>; `persist` records it as the user's explicit choice. */
  function apply(next: Theme, persist: boolean): void {
    theme = next;
    document.documentElement.dataset.theme = next;
    if (persist) {
      try {
        localStorage.setItem('theme', next);
      } catch {
        // Storage blocked — the choice still applies for this page view.
      }
    }
  }

  onMount(() => {
    const current = document.documentElement.dataset.theme;
    theme = current === 'dark' ? 'dark' : 'light';
    mounted = true;

    // Until the user makes an explicit choice, track the OS preference live.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem('theme');
      } catch {
        // ignore
      }
      if (stored !== 'light' && stored !== 'dark') {
        apply(e.matches ? 'dark' : 'light', false);
      }
    };
    mq.addEventListener('change', onChange);

    // Mirror a theme change made in another tab of this origin. `storage`
    // fires only in the *other* tabs, so this never echoes our own write.
    const onStorage = (e: StorageEvent): void => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        apply(e.newValue, false);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  });

  // Before hydration SSR renders the light default; suppress the slide
  // animation until mounted so it doesn't visibly jump on a dark page load.
  const isDark = $derived(theme === 'dark');
</script>

<div class="theme" role="group" aria-label={t('themeToggle', $locale)}>
  <span class="thumb" class:dark={isDark} class:still={!mounted} aria-hidden="true"></span>
  <button
    type="button"
    class="opt"
    class:active={!isDark}
    aria-pressed={!isDark}
    aria-label={t('light', $locale)}
    onclick={() => apply('light', true)}
  >
    <span aria-hidden="true">☀</span>
  </button>
  <button
    type="button"
    class="opt"
    class:active={isDark}
    aria-pressed={isDark}
    aria-label={t('dark', $locale)}
    onclick={() => apply('dark', true)}
  >
    <span aria-hidden="true">🌙</span>
  </button>
</div>

<style>
  .theme {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0.2rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
  }
  /* The accent "thumb" slides under the active option — same pattern as the
     nutrition panel's per-serving / whole-recipe switch. */
  .thumb {
    position: absolute;
    top: 0.2rem;
    bottom: 0.2rem;
    left: 0.2rem;
    width: calc(50% - 0.2rem);
    border-radius: 999px;
    background: var(--accent);
    transition: transform 0.18s ease;
  }
  .thumb.dark {
    transform: translateX(100%);
  }
  .thumb.still {
    transition: none;
  }
  .opt {
    position: relative;
    z-index: 1;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.95rem;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.18s ease;
  }
  .opt.active {
    opacity: 1;
  }
</style>
