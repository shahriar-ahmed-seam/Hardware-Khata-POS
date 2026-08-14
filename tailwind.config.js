/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
          hover: 'hsl(var(--sidebar-hover))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // No webfonts are downloaded (see index.html). Everything after the
        // first entry ships with Windows, so the app looks the same offline.
        sans: ['Inter', 'Hind Siliguri', 'Noto Sans Bengali', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      /**
       * LEGIBILITY SCALE — the shop owner is elderly, so every step is bumped
       * roughly 2px over the Tailwind default and expressed in rem so the
       * Settings → Appearance font-scale slider still multiplies it.
       * (Tailwind default for reference: xs 12 · sm 14 · base 16 · lg 18 · xl 20)
       */
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.05rem' }], //  12px (was ~10px)
        xs: ['0.875rem', { lineHeight: '1.25rem' }], //   14px (was 12px)
        sm: ['1rem', { lineHeight: '1.45rem' }], //       16px (was 14px)
        base: ['1.0625rem', { lineHeight: '1.6rem' }], // 17px (was 16px)
        lg: ['1.1875rem', { lineHeight: '1.75rem' }], //  19px (was 18px)
        xl: ['1.3125rem', { lineHeight: '1.9rem' }], //   21px (was 20px)
        '2xl': ['1.5625rem', { lineHeight: '2.1rem' }], //25px (was 24px)
        '3xl': ['1.875rem', { lineHeight: '2.35rem' }], //30px
        '4xl': ['2.25rem', { lineHeight: '2.6rem' }], //  36px
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'toast-in': {
          '0%': { transform: 'translateX(100%) scale(0.98)', opacity: '0' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 250ms ease-out',
        'slide-in-bottom': 'slide-in-bottom 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'toast-in': 'toast-in 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
