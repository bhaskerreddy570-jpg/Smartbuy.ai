# Customer-facing UI assets

This document records the source and licensing basis for visual assets used on CloudStoreNow customer-facing pages (landing, auth, dashboard shell). It supports copyright, trademark, and image-licensing review.

**Audit scope:** assets introduced or referenced by the customer landing redesign (`bcc9224` and follow-ups).

**Policy:** customer marketing UI uses original SVG/CSS illustrations and product mockups. No random web photographs, celebrity imagery, competing-product screenshots, or stock assets without documented licenses.

## Landing page illustrations (`public/landing/`)

All four files are **original vector artwork** created for CloudStoreNow. They are abstract category representations (landscape shapes, play button, stacked papers, folder) with no photographs, identifiable people, third-party logos, or embedded raster images.

| Asset | Used for | Source | License / usage basis | Attribution required |
| --- | --- | --- | --- | --- |
| `public/landing/photos.svg` | Hero gallery, Photos card | Original artwork authored in-repo for CloudStoreNow | Project-owned original work; no third-party content | No |
| `public/landing/videos.svg` | Hero gallery, Videos card | Original artwork authored in-repo for CloudStoreNow | Project-owned original work; no third-party content | No |
| `public/landing/documents.svg` | Hero gallery, Documents card | Original artwork authored in-repo for CloudStoreNow | Project-owned original work; no third-party content | No |
| `public/landing/files.svg` | Hero gallery, Everything else card | Original artwork authored in-repo for CloudStoreNow | Project-owned original work; no third-party content | No |

Each SVG includes an XML comment with the same provenance. Verify with:

```bash
rg -l "CloudStoreNow original artwork" public/landing/
```

## Landing page non-raster visuals

These elements are generated in React/Tailwind/CSS and contain no third-party image files:

| Element | Implementation | Source | License / usage basis | Attribution required |
| --- | --- | --- | --- | --- |
| Hero background gradients | Tailwind/CSS radial gradients in `landing-page.tsx` | Original UI styling in-repo | Project-owned original work | No |
| Storage preview panel | JSX mock data (“12.4 GB used of 50 GB”, labeled “Demo”) | Original product UI mockup in-repo | Project-owned original work; not real customer data | No |
| Security feature cards | Text + CSS in `landing-page.tsx` | Original UI copy and layout in-repo | Project-owned original work | No |
| Category progress bars | CSS/Tailwind color utilities | Original UI styling in-repo | Project-owned original work | No |

## Typography (customer-facing shell)

| Asset | Used for | Source | License / usage basis | Attribution required |
| --- | --- | --- | --- | --- |
| Geist Sans | Primary UI type (`next/font/google` in `layout.tsx`) | [Vercel Geist font family](https://vercel.com/font) via Next.js font loader | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) (see Vercel font repository for current license text) | Not required for typical web use under OFL; retain license notice if redistributing font files |
| Geist Mono | Monospace accents (`layout.tsx`) | Same as Geist Sans | SIL Open Font License 1.1 | Same as Geist Sans |
| Arial / Helvetica (fallback) | System fallback in `globals.css` | End-user system fonts | Standard system-font fallback stack | No |

Fonts are self-hosted through Next.js font optimization; no runtime requests to Google Fonts CDN on customer pages.

## Icons and images not used on customer landing

The repository still contains default Next.js starter files under `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`). **These are not referenced** by the customer landing page or other customer routes audited here. They may be removed in a separate cleanup if desired.

## External image URLs

Customer landing components (`src/components/landing/landing-page.tsx`, `src/app/page.tsx`) contain **no** `http://` or `https://` image sources, stock-photo integrations, or remote `<Image>` URLs.

## Maintenance checklist

Before adding customer-facing imagery:

1. Prefer original SVG/CSS or in-app UI mockups.
2. If using third-party stock or generated assets, add a row to the tables above with exact source URL, license name, and attribution requirements.
3. Do not add photographs of identifiable people unless license terms explicitly permit the intended commercial web use.
4. Do not add provider, competitor, or social-media sourced images without verified commercial rights.
5. Re-run `npm run lint` and `npm run build` after asset changes.
