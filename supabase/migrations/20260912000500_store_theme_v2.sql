-- Store theme v2.
--
-- The storefront redesign turns `stores.theme` from a short colour/font record
-- into the full visual contract: mode, secondary and computed on-primary inks,
-- gradient and pattern, heading treatment, density, card style, image ratio and
-- shape, menu and category layout, badges, hero, featured, story, social,
-- footer, motion and sanitised custom CSS. `lib/theme.ts#normalizeTheme` fills
-- every missing key at read time, so this migration is not required for the app
-- to work; it exists so the stored rows match what the editor writes back and
-- so new stores start from the complete shape.
--
-- Two statements:
--   1. the column default becomes the complete v2 theme;
--   2. existing rows gain the new keys and keep every value they already set.
--
-- `||` is a shallow merge, so `default || theme` would replace a whole nested
-- object with the stored partial one. Each nested group is therefore merged
-- explicitly, and `jsonb_typeof(...) = 'object'` guards a stored `null` or a
-- scalar written by an older client, which `||` would otherwise reject.

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
    "sectionOrder": ["hero", "featured", "menu", "info"],
    "featured": { "title": "Destacados", "productIds": [], "layout": "carousel" },
    "story": { "enabled": false, "title": "Nuestra historia", "text": "", "imageUrl": null },
    "social": { "instagram": null, "tiktok": null, "facebook": null, "whatsapp": false },
    "footer": { "text": null, "showMap": true, "showSchedule": true },
    "motion": "full",
    "customCss": null
  }'::jsonb;

update public.stores as s
set theme =
  (
    d.v2
    || (case when jsonb_typeof(s.theme) = 'object' then s.theme else '{}'::jsonb end)
  )
  || jsonb_build_object(
       'banner',
       (d.v2 -> 'banner')
         || (case when jsonb_typeof(s.theme -> 'banner') = 'object' then s.theme -> 'banner' else '{}'::jsonb end),
       'gradient',
       (d.v2 -> 'gradient')
         || (case when jsonb_typeof(s.theme -> 'gradient') = 'object' then s.theme -> 'gradient' else '{}'::jsonb end),
       'badges',
       (d.v2 -> 'badges')
         || (case when jsonb_typeof(s.theme -> 'badges') = 'object' then s.theme -> 'badges' else '{}'::jsonb end),
       'hero',
       (d.v2 -> 'hero')
         || (case when jsonb_typeof(s.theme -> 'hero') = 'object' then s.theme -> 'hero' else '{}'::jsonb end),
       'featured',
       (d.v2 -> 'featured')
         || (case when jsonb_typeof(s.theme -> 'featured') = 'object' then s.theme -> 'featured' else '{}'::jsonb end),
       'story',
       (d.v2 -> 'story')
         || (case when jsonb_typeof(s.theme -> 'story') = 'object' then s.theme -> 'story' else '{}'::jsonb end),
       'social',
       (d.v2 -> 'social')
         || (case when jsonb_typeof(s.theme -> 'social') = 'object' then s.theme -> 'social' else '{}'::jsonb end),
       'footer',
       (d.v2 -> 'footer')
         || (case when jsonb_typeof(s.theme -> 'footer') = 'object' then s.theme -> 'footer' else '{}'::jsonb end)
     )
from (
  select '{
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
    "sectionOrder": ["hero", "featured", "menu", "info"],
    "featured": { "title": "Destacados", "productIds": [], "layout": "carousel" },
    "story": { "enabled": false, "title": "Nuestra historia", "text": "", "imageUrl": null },
    "social": { "instagram": null, "tiktok": null, "facebook": null, "whatsapp": false },
    "footer": { "text": null, "showMap": true, "showSchedule": true },
    "motion": "full",
    "customCss": null
  }'::jsonb as v2
) as d;
