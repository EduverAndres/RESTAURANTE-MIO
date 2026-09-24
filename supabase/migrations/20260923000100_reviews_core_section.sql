-- Reviews become a core storefront section.
--
-- `THEME_CORE_SECTIONS` now includes `reviews`, so every storefront shows
-- the opinions its customers wrote instead of hiding them behind an opt-in
-- nobody switched on. Existing stores are not backfilled: `lib/theme.ts`
-- (`normalizeTheme`) appends the missing core section at the END of their
-- saved order at read time, so they get `reviews` after `info` until the
-- merchant reorders it, and the editor writes the completed order back on
-- the next save. Only new stores start with `reviews` after `menu`, which is
-- what this migration does by keeping the column default in step with
-- `DEFAULT_STORE_THEME`.

alter table public.stores
  alter column theme set default '{
    "mode": "light",
    "logoUrl": null,
    "primary": "#C2410C",
    "onPrimary": "#FFFFFF",
    "secondary": "#7C2D12",
    "accent": "#F59E0B",
    "background": "#FBF8F3",
    "surface": "#FFFFFF",
    "text": "#1C1917",
    "gradient": { "enabled": false, "from": "#C2410C", "to": "#F59E0B", "angle": 135 },
    "pattern": "none",
    "patternOpacity": 0.06,
    "fontDisplay": "Fraunces",
    "fontBody": "Inter",
    "headingWeight": 700,
    "headingCase": "normal",
    "letterSpacing": "normal",
    "radius": 20,
    "buttonStyle": "pill",
    "density": "comfortable",
    "cardStyle": "elevated",
    "imageRatio": "4:3",
    "imageShape": "rounded",
    "banner": { "imageUrl": null, "overlayOpacity": 0.35, "layout": "full" },
    "hero": {
      "align": "left",
      "showLogo": true,
      "logoSize": "md",
      "tagline": null,
      "showRating": true,
      "showEta": true,
      "showSchedule": true,
      "ctaLabel": null,
      "videoUrl": null
    },
    "menuLayout": "grid",
    "categoryNav": "chips",
    "productHover": "lift",
    "showPrices": "always",
    "badges": { "newDays": 14, "popularEnabled": true, "style": "soft" },
    "sectionOrder": ["hero", "featured", "menu", "reviews", "info"],
    "featured": { "title": "Destacados", "productIds": [], "layout": "carousel" },
    "story": { "enabled": false, "title": "Nuestra historia", "text": "", "imageUrl": null },
    "social": { "instagram": null, "tiktok": null, "facebook": null, "whatsapp": false },
    "footer": { "text": null, "showMap": true, "showSchedule": true },
    "motion": "full",
    "customCss": null
  }'::jsonb;
