-- Tienda seed data. Safe to re-run: every insert uses fixed UUIDs and
-- "on conflict do nothing". Password for every seeded user: Tienda123!
--
-- UUID namespaces (first group):
--   1... auth users / profiles   2... stores          3... menu categories
--   4... products                5... product options 6... option values
--   7... addresses               8... orders          9... order items
--   a... store tables            b... reviews         c... payouts

-- ---------------------------------------------------------------------------
-- Auth users (profiles are created by the handle_new_user trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, is_sso_user
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id::uuid,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Tienda123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', u.role, 'full_name', u.full_name, 'phone', u.phone),
  now(),
  now(),
  '', '', '', '', '', '', '', '',
  false
from (
  values
    ('10000000-0000-4000-8000-000000000001', 'admin@tienda.app',    'admin',    'Administrador Tienda', '+573000000001'),
    ('10000000-0000-4000-8000-000000000011', 'owner1@tienda.app',   'merchant', 'Mauricio Restrepo',    '+573100000011'),
    ('10000000-0000-4000-8000-000000000012', 'owner2@tienda.app',   'merchant', 'Daniela Torres',       '+573100000012'),
    ('10000000-0000-4000-8000-000000000013', 'owner3@tienda.app',   'merchant', 'Camila Herrera',       '+573100000013'),
    ('10000000-0000-4000-8000-000000000014', 'owner4@tienda.app',   'merchant', 'Kenji Morales',        '+573100000014'),
    ('10000000-0000-4000-8000-000000000015', 'owner5@tienda.app',   'merchant', 'Giulia Rossi',         '+573100000015'),
    ('10000000-0000-4000-8000-000000000016', 'owner6@tienda.app',   'merchant', 'Andrés Cardona',       '+573100000016'),
    ('10000000-0000-4000-8000-000000000021', 'cliente1@tienda.app', 'customer', 'Laura Gómez',          '+573200000021'),
    ('10000000-0000-4000-8000-000000000022', 'cliente2@tienda.app', 'customer', 'Santiago Pérez',       '+573200000022'),
    ('10000000-0000-4000-8000-000000000023', 'cliente3@tienda.app', 'customer', 'Valentina Ruiz',       '+573200000023'),
    ('10000000-0000-4000-8000-000000000031', 'courier1@tienda.app', 'courier',  'Jhon Martínez',        '+573300000031'),
    ('10000000-0000-4000-8000-000000000032', 'courier2@tienda.app', 'courier',  'Carlos Ospina',        '+573300000032')
) as u (id, email, role, full_name, phone)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.email,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@tienda.app'
on conflict (provider_id, provider) do nothing;

-- Make sure roles match even if the profiles existed before this seed ran.
update public.profiles p
set role = v.role::public.user_role
from (
  values
    ('10000000-0000-4000-8000-000000000001', 'admin'),
    ('10000000-0000-4000-8000-000000000011', 'merchant'),
    ('10000000-0000-4000-8000-000000000012', 'merchant'),
    ('10000000-0000-4000-8000-000000000013', 'merchant'),
    ('10000000-0000-4000-8000-000000000014', 'merchant'),
    ('10000000-0000-4000-8000-000000000015', 'merchant'),
    ('10000000-0000-4000-8000-000000000016', 'merchant'),
    ('10000000-0000-4000-8000-000000000031', 'courier'),
    ('10000000-0000-4000-8000-000000000032', 'courier')
) as v (id, role)
where p.id = v.id::uuid
  and p.role is distinct from v.role::public.user_role;

-- ---------------------------------------------------------------------------
-- Stores (all in Bogotá)
-- ---------------------------------------------------------------------------
insert into public.stores (
  id, owner_id, slug, name, description, category, logo_url, cover_url, theme,
  address, lat, lng, delivery_radius_km, min_order, delivery_fee, prep_time_min,
  commission_pct, is_open, schedule, whatsapp_phone, status
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000011',
    'la-parrilla-del-norte',
    'La Parrilla del Norte',
    'Cortes madurados a la brasa, chorizos artesanales y vinos de la casa en el corazón de Usaquén.',
    'Parrilla',
    null,
    'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#C08A3E", "accent": "#8B1E1E", "background": "#141210", "surface": "#1F1B18", "text": "#F5EFE6",
      "radius": 8, "fontDisplay": "Playfair Display", "fontBody": "Inter",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.55, "layout": "full" },
      "logoUrl": null, "sectionOrder": ["hero", "featured", "menu", "info"], "buttonStyle": "square"
    }'::jsonb,
    'Carrera 6 # 119-40, Usaquén, Bogotá', 4.6980, -74.0410, 6, 30000, 6000, 35,
    8, true,
    '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"23:30"},"sat":{"open":"12:00","close":"23:30"},"sun":{"open":"12:00","close":"20:00"}}'::jsonb,
    '+573100000011', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000012',
    'arepa-and-co',
    'Arepa & Co',
    'Arepas rellenas al estilo de la calle: carne desmechada, pollo, queso costeño y mucho sabor.',
    'Comida rápida',
    null,
    'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#DC2626", "accent": "#FACC15", "background": "#FFFBEB", "surface": "#FFFFFF", "text": "#1C1917",
      "radius": 12, "fontDisplay": "Space Grotesk", "fontBody": "DM Sans",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.3, "layout": "full" },
      "logoUrl": null, "sectionOrder": ["hero", "menu", "featured", "info"], "buttonStyle": "rounded"
    }'::jsonb,
    'Calle 57 # 9-25, Chapinero, Bogotá', 4.6486, -74.0632, 5, 12000, 4000, 15,
    6, true,
    '{"mon":{"open":"07:00","close":"21:00"},"tue":{"open":"07:00","close":"21:00"},"wed":{"open":"07:00","close":"21:00"},"thu":{"open":"07:00","close":"21:00"},"fri":{"open":"07:00","close":"22:00"},"sat":{"open":"08:00","close":"22:00"},"sun":{"open":"08:00","close":"18:00"}}'::jsonb,
    '+573100000012', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000013',
    'verde-bowl',
    'Verde Bowl',
    'Bowls, ensaladas y smoothies con ingredientes frescos de productores locales.',
    'Saludable',
    null,
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#15803D", "accent": "#84CC16", "background": "#F3FAF3", "surface": "#FFFFFF", "text": "#14291A",
      "radius": 24, "fontDisplay": "DM Sans", "fontBody": "Inter",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.25, "layout": "full" },
      "logoUrl": null, "sectionOrder": ["hero", "featured", "menu", "info"], "buttonStyle": "pill"
    }'::jsonb,
    'Carrera 11 # 93-52, Chicó, Bogotá', 4.6700, -74.0550, 5, 20000, 5000, 20,
    6, true,
    '{"mon":{"open":"08:00","close":"20:00"},"tue":{"open":"08:00","close":"20:00"},"wed":{"open":"08:00","close":"20:00"},"thu":{"open":"08:00","close":"20:00"},"fri":{"open":"08:00","close":"20:00"},"sat":{"open":"09:00","close":"17:00"},"sun":{"open":"09:00","close":"15:00"}}'::jsonb,
    '+573100000013', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000014',
    'sushi-nocturno',
    'Sushi Nocturno',
    'Rolls, nigiri y ramen hasta la madrugada. Pescado fresco y salsas de la casa.',
    'Japonesa',
    null,
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#22D3EE", "accent": "#F472B6", "background": "#0B1020", "surface": "#151B33", "text": "#E8ECFF",
      "radius": 16, "fontDisplay": "Geist", "fontBody": "Geist",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.6, "layout": "split" },
      "logoUrl": null, "sectionOrder": ["hero", "menu", "featured", "info"], "buttonStyle": "rounded"
    }'::jsonb,
    'Calle 82 # 12-15, Zona T, Bogotá', 4.6640, -74.0530, 7, 25000, 7000, 30,
    7, true,
    '{"mon":{"open":"17:00","close":"02:00"},"tue":{"open":"17:00","close":"02:00"},"wed":{"open":"17:00","close":"02:00"},"thu":{"open":"17:00","close":"03:00"},"fri":{"open":"17:00","close":"04:00"},"sat":{"open":"17:00","close":"04:00"},"sun":{"open":"17:00","close":"01:00"}}'::jsonb,
    '+573100000014', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000015',
    'pizzeria-ragazzi',
    'Pizzería Ragazzi',
    'Pizza napolitana de masa madre horneada en leña, pastas caseras y tiramisú de la nonna.',
    'Italiana',
    null,
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#B91C1C", "accent": "#F59E0B", "background": "#FFF7ED", "surface": "#FFFDF9", "text": "#2A1A12",
      "radius": 16, "fontDisplay": "Fraunces", "fontBody": "Inter",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.4, "layout": "full" },
      "logoUrl": null, "sectionOrder": ["hero", "featured", "menu", "info"], "buttonStyle": "rounded"
    }'::jsonb,
    'Calle 140 # 12-30, Cedritos, Bogotá', 4.7100, -74.0350, 6, 25000, 5500, 25,
    6, true,
    '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb,
    '+573100000015', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000016',
    'cafe-lumbre',
    'Café Lumbre',
    'Café de origen colombiano, panadería artesanal y desayunos todo el día.',
    'Café y panadería',
    null,
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    '{
      "primary": "#9A3412", "accent": "#D97706", "background": "#FBF3EA", "surface": "#FFFFFF", "text": "#2B1D14",
      "radius": 20, "fontDisplay": "Instrument Serif", "fontBody": "DM Sans",
      "banner": { "imageUrl": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80", "overlayOpacity": 0.35, "layout": "full" },
      "logoUrl": null, "sectionOrder": ["hero", "menu", "info", "featured"], "buttonStyle": "pill"
    }'::jsonb,
    'Carrera 24 # 40-12, Teusaquillo, Bogotá', 4.6560, -74.0980, 4, 10000, 4500, 15,
    6, true,
    '{"mon":{"open":"06:30","close":"19:00"},"tue":{"open":"06:30","close":"19:00"},"wed":{"open":"06:30","close":"19:00"},"thu":{"open":"06:30","close":"19:00"},"fri":{"open":"06:30","close":"20:00"},"sat":{"open":"07:00","close":"20:00"},"sun":{"open":"07:00","close":"16:00"}}'::jsonb,
    '+573100000016', 'active'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, store_id, name, position)
values
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'Cortes', 1),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 'Entradas', 2),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', 'Acompañamientos', 3),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000001', 'Bebidas', 4),
  ('30000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', 'Arepas', 1),
  ('30000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', 'Combos', 2),
  ('30000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000002', 'Adiciones', 3),
  ('30000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000002', 'Bebidas', 4),
  ('30000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000003', 'Bowls', 1),
  ('30000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000003', 'Ensaladas', 2),
  ('30000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000003', 'Smoothies', 3),
  ('30000000-0000-4000-8000-000000000041', '20000000-0000-4000-8000-000000000004', 'Rolls', 1),
  ('30000000-0000-4000-8000-000000000042', '20000000-0000-4000-8000-000000000004', 'Nigiri', 2),
  ('30000000-0000-4000-8000-000000000043', '20000000-0000-4000-8000-000000000004', 'Entradas', 3),
  ('30000000-0000-4000-8000-000000000044', '20000000-0000-4000-8000-000000000004', 'Bebidas', 4),
  ('30000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000005', 'Pizzas', 1),
  ('30000000-0000-4000-8000-000000000052', '20000000-0000-4000-8000-000000000005', 'Pastas', 2),
  ('30000000-0000-4000-8000-000000000053', '20000000-0000-4000-8000-000000000005', 'Postres', 3),
  ('30000000-0000-4000-8000-000000000054', '20000000-0000-4000-8000-000000000005', 'Bebidas', 4),
  ('30000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000006', 'Café', 1),
  ('30000000-0000-4000-8000-000000000062', '20000000-0000-4000-8000-000000000006', 'Panadería', 2),
  ('30000000-0000-4000-8000-000000000063', '20000000-0000-4000-8000-000000000006', 'Desayunos', 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Products (prices in COP)
-- ---------------------------------------------------------------------------
insert into public.products (id, store_id, category_id, name, description, price, image_url, position, tags)
values
  -- La Parrilla del Norte
  ('40000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'Churrasco 350 g', 'Corte de lomo ancho madurado 21 días, a la brasa con chimichurri de la casa.', 58900, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1200&q=80', 1, '{"popular","parrilla"}'),
  ('40000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'Punta de anca 300 g', 'Punta de anca jugosa con costra de sal y pimienta.', 54900, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80', 2, '{"parrilla"}'),
  ('40000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'Baby beef 250 g', 'Corte tierno del centro del lomo, término al gusto.', 49900, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80', 3, '{"parrilla"}'),
  ('40000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000012', 'Chorizo santarrosano', 'Chorizo artesanal a la brasa con arepa y limón.', 14900, 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80', 1, '{"entrada"}'),
  ('40000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000012', 'Chicharrón crocante', 'Chicharrón carnudo servido con hogao y arepa.', 16900, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80', 2, '{"entrada","popular"}'),
  ('40000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000013', 'Papas al carbón', 'Papas criollas asadas al carbón con romero y sal marina.', 12900, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80', 1, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000014', 'Limonada de coco', 'Limonada cremosa de coco, 400 ml.', 9900, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80', 1, '{"bebida"}'),
  ('40000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000013', 'Ensalada de la casa', 'Mix de lechugas, tomate cherry, cebolla morada y vinagreta de mostaza.', 11900, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80', 2, '{"vegetariano"}'),
  -- Arepa & Co
  ('40000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000021', 'Arepa de queso', 'Arepa de maíz blanco rellena de queso costeño derretido.', 7900, 'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&fit=crop&w=1200&q=80', 1, '{"clasica","vegetariano"}'),
  ('40000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000021', 'Arepa rellena de carne desmechada', 'Carne desmechada guisada con hogao y queso.', 15900, 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80', 2, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000021', 'Arepa de pollo con champiñones', 'Pollo desmechado en salsa cremosa de champiñones.', 16900, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=1200&q=80', 3, '{}'),
  ('40000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000021', 'Arepa mixta', 'Carne, pollo, chicharrón y queso: la más completa.', 18900, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80', 4, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000022', 'Combo arepa + gaseosa', 'Arepa rellena a elección con gaseosa de 400 ml.', 19900, 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=1200&q=80', 1, '{"combo"}'),
  ('40000000-0000-4000-8000-000000000026', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000023', 'Chicharrón extra', 'Porción de chicharrón crocante para acompañar.', 5900, 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80', 1, '{}'),
  ('40000000-0000-4000-8000-000000000027', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000024', 'Jugo de mora', 'Jugo natural de mora en agua o leche, 400 ml.', 6900, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80', 1, '{"bebida"}'),
  ('40000000-0000-4000-8000-000000000028', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000024', 'Gaseosa 400 ml', 'Gaseosa personal bien fría.', 4500, 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1200&q=80', 2, '{"bebida"}'),
  -- Verde Bowl
  ('40000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000031', 'Bowl de quinoa y aguacate', 'Quinoa tricolor, aguacate, garbanzos tostados, tomate y tahini de limón.', 28900, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80', 1, '{"popular","vegano"}'),
  ('40000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000031', 'Bowl mediterráneo', 'Arroz integral, falafel, hummus, pepino, aceitunas y yogur de hierbas.', 27900, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80', 2, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000031', 'Bowl de salmón', 'Salmón a la plancha, arroz de coliflor, edamame y sésamo.', 34900, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80', 3, '{"proteina"}'),
  ('40000000-0000-4000-8000-000000000034', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000032', 'Ensalada césar con pollo', 'Lechuga romana, pollo a la parrilla, crutones y parmesano.', 24900, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80', 1, '{}'),
  ('40000000-0000-4000-8000-000000000035', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000032', 'Ensalada caprese', 'Tomate, mozzarella fresca, albahaca y reducción de balsámico.', 22900, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80', 2, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000036', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000033', 'Smoothie verde', 'Espinaca, piña, banano, jengibre y agua de coco.', 13900, 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1200&q=80', 1, '{"bebida","vegano"}'),
  ('40000000-0000-4000-8000-000000000037', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000033', 'Smoothie de frutos rojos', 'Fresa, mora, arándanos y yogur griego.', 13900, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80', 2, '{"bebida"}'),
  -- Sushi Nocturno
  ('40000000-0000-4000-8000-000000000041', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000041', 'California roll', 'Cangrejo, aguacate y pepino cubierto de ajonjolí.', 26900, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80', 1, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000042', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000041', 'Roll acevichado', 'Roll de langostino crocante bañado en salsa acevichada.', 32900, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80', 2, '{"popular","picante"}'),
  ('40000000-0000-4000-8000-000000000043', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000041', 'Roll tempura de camarón', 'Camarón tempura, aguacate y salsa de anguila.', 31900, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80', 3, '{}'),
  ('40000000-0000-4000-8000-000000000044', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000042', 'Nigiri de salmón', 'Dos piezas de salmón fresco sobre arroz de sushi.', 14900, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80', 1, '{}'),
  ('40000000-0000-4000-8000-000000000045', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000042', 'Nigiri de atún', 'Dos piezas de atún rojo sobre arroz de sushi.', 15900, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80', 2, '{}'),
  ('40000000-0000-4000-8000-000000000046', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000043', 'Gyozas de cerdo', 'Seis gyozas a la plancha con salsa ponzu.', 16900, 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80', 1, '{}'),
  ('40000000-0000-4000-8000-000000000047', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000043', 'Edamame', 'Vainas de soya al vapor con sal marina.', 11900, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80', 2, '{"vegano"}'),
  ('40000000-0000-4000-8000-000000000048', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000044', 'Té verde frío', 'Té verde con jazmín, servido con hielo.', 7900, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80', 1, '{"bebida"}'),
  -- Pizzería Ragazzi
  ('40000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000051', 'Pizza margherita', 'Salsa de tomate San Marzano, mozzarella fior di latte y albahaca.', 32900, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80', 1, '{"popular","vegetariano"}'),
  ('40000000-0000-4000-8000-000000000052', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000051', 'Pizza pepperoni', 'Pepperoni artesanal, mozzarella y orégano.', 36900, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=1200&q=80', 2, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000053', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000051', 'Pizza cuatro quesos', 'Mozzarella, gorgonzola, parmesano y provolone.', 38900, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80', 3, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000054', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000052', 'Lasaña bolognesa', 'Capas de pasta fresca, ragú de carne y bechamel gratinada.', 34900, 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=80', 1, '{}'),
  ('40000000-0000-4000-8000-000000000055', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000052', 'Fettuccine alfredo', 'Fettuccine en salsa cremosa de parmesano y mantequilla.', 29900, 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=80', 2, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000056', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000053', 'Tiramisú', 'Receta clásica con mascarpone y café espresso.', 14900, 'https://images.unsplash.com/photo-1481070555726-e2fe8357725c?auto=format&fit=crop&w=1200&q=80', 1, '{"postre"}'),
  ('40000000-0000-4000-8000-000000000057', '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000054', 'Limonada natural', 'Limonada recién exprimida, 400 ml.', 7900, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80', 1, '{"bebida"}'),
  -- Café Lumbre
  ('40000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000061', 'Latte', 'Espresso doble con leche texturizada.', 8900, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80', 1, '{"popular","bebida"}'),
  ('40000000-0000-4000-8000-000000000062', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000061', 'Cappuccino', 'Espresso con leche vaporizada y espuma cremosa.', 8500, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80', 2, '{"bebida"}'),
  ('40000000-0000-4000-8000-000000000063', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000061', 'Espresso doble', 'Café de origen Huila, extracción doble.', 6500, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80', 3, '{"bebida"}'),
  ('40000000-0000-4000-8000-000000000064', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000062', 'Croissant de mantequilla', 'Hojaldre laminado con mantequilla francesa.', 6900, 'https://images.unsplash.com/photo-1481070555726-e2fe8357725c?auto=format&fit=crop&w=1200&q=80', 1, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000065', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000062', 'Pan de bono', 'Pan de bono tradicional, recién horneado.', 3500, 'https://images.unsplash.com/photo-1481070555726-e2fe8357725c?auto=format&fit=crop&w=1200&q=80', 2, '{}'),
  ('40000000-0000-4000-8000-000000000066', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000063', 'Tostada de aguacate', 'Pan de masa madre, aguacate, huevo pochado y semillas.', 18900, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80', 1, '{"vegetariano"}'),
  ('40000000-0000-4000-8000-000000000067', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000063', 'Pancakes con frutos rojos', 'Tres pancakes esponjosos con frutos rojos y miel de maple.', 19900, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1200&q=80', 2, '{"popular"}'),
  ('40000000-0000-4000-8000-000000000068', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000063', 'Bowl de frutas y granola', 'Yogur griego, granola de la casa y fruta de temporada.', 15900, 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1200&q=80', 3, '{"vegetariano"}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Product options and values
-- ---------------------------------------------------------------------------
insert into public.product_options (id, product_id, name, required, min, max, position)
values
  ('50000000-0000-4000-8000-000000001101', '40000000-0000-4000-8000-000000000011', 'Término', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000001201', '40000000-0000-4000-8000-000000000012', 'Término', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000002101', '40000000-0000-4000-8000-000000000021', 'Tamaño', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000002201', '40000000-0000-4000-8000-000000000022', 'Adiciones', false, 0, 3, 1),
  ('50000000-0000-4000-8000-000000002501', '40000000-0000-4000-8000-000000000025', 'Bebida', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000003101', '40000000-0000-4000-8000-000000000031', 'Proteína', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000003401', '40000000-0000-4000-8000-000000000034', 'Aderezo', false, 0, 1, 1),
  ('50000000-0000-4000-8000-000000003601', '40000000-0000-4000-8000-000000000036', 'Tamaño', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000004101', '40000000-0000-4000-8000-000000000041', 'Piezas', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000004201', '40000000-0000-4000-8000-000000000042', 'Extras', false, 0, 2, 1),
  ('50000000-0000-4000-8000-000000005101', '40000000-0000-4000-8000-000000000051', 'Tamaño', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000005201', '40000000-0000-4000-8000-000000000052', 'Tamaño', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000005301', '40000000-0000-4000-8000-000000000053', 'Tamaño', true, 1, 1, 1),
  ('50000000-0000-4000-8000-000000006101', '40000000-0000-4000-8000-000000000061', 'Leche', false, 0, 1, 1),
  ('50000000-0000-4000-8000-000000006102', '40000000-0000-4000-8000-000000000061', 'Tamaño', true, 1, 1, 2),
  ('50000000-0000-4000-8000-000000006201', '40000000-0000-4000-8000-000000000062', 'Leche', false, 0, 1, 1)
on conflict (id) do nothing;

insert into public.product_option_values (id, option_id, name, price_delta, position)
values
  -- Término (churrasco / punta de anca)
  ('60000000-0000-4000-8000-000000001111', '50000000-0000-4000-8000-000000001101', 'Rojo', 0, 1),
  ('60000000-0000-4000-8000-000000001112', '50000000-0000-4000-8000-000000001101', 'Medio', 0, 2),
  ('60000000-0000-4000-8000-000000001113', '50000000-0000-4000-8000-000000001101', 'Tres cuartos', 0, 3),
  ('60000000-0000-4000-8000-000000001114', '50000000-0000-4000-8000-000000001101', 'Bien asado', 0, 4),
  ('60000000-0000-4000-8000-000000001211', '50000000-0000-4000-8000-000000001201', 'Rojo', 0, 1),
  ('60000000-0000-4000-8000-000000001212', '50000000-0000-4000-8000-000000001201', 'Medio', 0, 2),
  ('60000000-0000-4000-8000-000000001213', '50000000-0000-4000-8000-000000001201', 'Tres cuartos', 0, 3),
  ('60000000-0000-4000-8000-000000001214', '50000000-0000-4000-8000-000000001201', 'Bien asado', 0, 4),
  -- Arepa de queso: tamaño
  ('60000000-0000-4000-8000-000000002111', '50000000-0000-4000-8000-000000002101', 'Personal', 0, 1),
  ('60000000-0000-4000-8000-000000002112', '50000000-0000-4000-8000-000000002101', 'Grande', 3000, 2),
  -- Arepa rellena: adiciones
  ('60000000-0000-4000-8000-000000002211', '50000000-0000-4000-8000-000000002201', 'Queso extra', 2500, 1),
  ('60000000-0000-4000-8000-000000002212', '50000000-0000-4000-8000-000000002201', 'Aguacate', 3000, 2),
  ('60000000-0000-4000-8000-000000002213', '50000000-0000-4000-8000-000000002201', 'Huevo', 2000, 3),
  -- Combo: bebida
  ('60000000-0000-4000-8000-000000002511', '50000000-0000-4000-8000-000000002501', 'Coca-Cola', 0, 1),
  ('60000000-0000-4000-8000-000000002512', '50000000-0000-4000-8000-000000002501', 'Colombiana', 0, 2),
  ('60000000-0000-4000-8000-000000002513', '50000000-0000-4000-8000-000000002501', 'Agua', 0, 3),
  -- Bowl de quinoa: proteína
  ('60000000-0000-4000-8000-000000003111', '50000000-0000-4000-8000-000000003101', 'Pollo', 0, 1),
  ('60000000-0000-4000-8000-000000003112', '50000000-0000-4000-8000-000000003101', 'Salmón', 6000, 2),
  ('60000000-0000-4000-8000-000000003113', '50000000-0000-4000-8000-000000003101', 'Tofu', 0, 3),
  -- Ensalada césar: aderezo
  ('60000000-0000-4000-8000-000000003411', '50000000-0000-4000-8000-000000003401', 'César', 0, 1),
  ('60000000-0000-4000-8000-000000003412', '50000000-0000-4000-8000-000000003401', 'Vinagreta', 0, 2),
  ('60000000-0000-4000-8000-000000003413', '50000000-0000-4000-8000-000000003401', 'Yogur', 0, 3),
  -- Smoothie verde: tamaño
  ('60000000-0000-4000-8000-000000003611', '50000000-0000-4000-8000-000000003601', '350 ml', 0, 1),
  ('60000000-0000-4000-8000-000000003612', '50000000-0000-4000-8000-000000003601', '500 ml', 4000, 2),
  -- California roll: piezas
  ('60000000-0000-4000-8000-000000004111', '50000000-0000-4000-8000-000000004101', '8 piezas', 0, 1),
  ('60000000-0000-4000-8000-000000004112', '50000000-0000-4000-8000-000000004101', '12 piezas', 9000, 2),
  -- Roll acevichado: extras
  ('60000000-0000-4000-8000-000000004211', '50000000-0000-4000-8000-000000004201', 'Salsa de anguila', 2000, 1),
  ('60000000-0000-4000-8000-000000004212', '50000000-0000-4000-8000-000000004201', 'Cream cheese extra', 2500, 2),
  -- Pizzas: tamaño
  ('60000000-0000-4000-8000-000000005111', '50000000-0000-4000-8000-000000005101', 'Personal', 0, 1),
  ('60000000-0000-4000-8000-000000005112', '50000000-0000-4000-8000-000000005101', 'Mediana', 12000, 2),
  ('60000000-0000-4000-8000-000000005113', '50000000-0000-4000-8000-000000005101', 'Familiar', 22000, 3),
  ('60000000-0000-4000-8000-000000005211', '50000000-0000-4000-8000-000000005201', 'Personal', 0, 1),
  ('60000000-0000-4000-8000-000000005212', '50000000-0000-4000-8000-000000005201', 'Mediana', 12000, 2),
  ('60000000-0000-4000-8000-000000005213', '50000000-0000-4000-8000-000000005201', 'Familiar', 22000, 3),
  ('60000000-0000-4000-8000-000000005311', '50000000-0000-4000-8000-000000005301', 'Personal', 0, 1),
  ('60000000-0000-4000-8000-000000005312', '50000000-0000-4000-8000-000000005301', 'Mediana', 12000, 2),
  ('60000000-0000-4000-8000-000000005313', '50000000-0000-4000-8000-000000005301', 'Familiar', 22000, 3),
  -- Latte: leche y tamaño
  ('60000000-0000-4000-8000-000000006111', '50000000-0000-4000-8000-000000006101', 'Entera', 0, 1),
  ('60000000-0000-4000-8000-000000006112', '50000000-0000-4000-8000-000000006101', 'Deslactosada', 0, 2),
  ('60000000-0000-4000-8000-000000006113', '50000000-0000-4000-8000-000000006101', 'Almendras', 2000, 3),
  ('60000000-0000-4000-8000-000000006114', '50000000-0000-4000-8000-000000006101', 'Avena', 2000, 4),
  ('60000000-0000-4000-8000-000000006121', '50000000-0000-4000-8000-000000006102', '8 oz', 0, 1),
  ('60000000-0000-4000-8000-000000006122', '50000000-0000-4000-8000-000000006102', '12 oz', 2500, 2),
  -- Cappuccino: leche
  ('60000000-0000-4000-8000-000000006211', '50000000-0000-4000-8000-000000006201', 'Entera', 0, 1),
  ('60000000-0000-4000-8000-000000006212', '50000000-0000-4000-8000-000000006201', 'Deslactosada', 0, 2),
  ('60000000-0000-4000-8000-000000006213', '50000000-0000-4000-8000-000000006201', 'Almendras', 2000, 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Customer addresses (two each, one default)
-- ---------------------------------------------------------------------------
insert into public.addresses (id, user_id, label, line1, line2, lat, lng, is_default)
values
  ('70000000-0000-4000-8000-000000000211', '10000000-0000-4000-8000-000000000021', 'Casa', 'Calle 93 # 13-24', 'Apto 501', 4.6764, -74.0483, true),
  ('70000000-0000-4000-8000-000000000212', '10000000-0000-4000-8000-000000000021', 'Oficina', 'Carrera 7 # 71-52', 'Torre B, piso 9', 4.6538, -74.0567, false),
  ('70000000-0000-4000-8000-000000000221', '10000000-0000-4000-8000-000000000022', 'Casa', 'Carrera 15 # 106-30', 'Casa 4', 4.6935, -74.0435, true),
  ('70000000-0000-4000-8000-000000000222', '10000000-0000-4000-8000-000000000022', 'Universidad', 'Calle 45 # 26-85', 'Portería principal', 4.6320, -74.0740, false),
  ('70000000-0000-4000-8000-000000000231', '10000000-0000-4000-8000-000000000023', 'Apartamento', 'Calle 140 # 11-58', 'Apto 302', 4.7190, -74.0340, true),
  ('70000000-0000-4000-8000-000000000232', '10000000-0000-4000-8000-000000000023', 'Trabajo', 'Calle 26 # 69-76', 'Recepción', 4.6580, -74.1050, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Store tables (two per store; qr_token is generated by the default)
-- ---------------------------------------------------------------------------
insert into public.store_tables (id, store_id, number)
values
  ('a0000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 1),
  ('a0000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 2),
  ('a0000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', 1),
  ('a0000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', 2),
  ('a0000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000003', 1),
  ('a0000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000003', 2),
  ('a0000000-0000-4000-8000-000000000041', '20000000-0000-4000-8000-000000000004', 1),
  ('a0000000-0000-4000-8000-000000000042', '20000000-0000-4000-8000-000000000004', 2),
  ('a0000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000005', 1),
  ('a0000000-0000-4000-8000-000000000052', '20000000-0000-4000-8000-000000000005', 2),
  ('a0000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000006', 1),
  ('a0000000-0000-4000-8000-000000000062', '20000000-0000-4000-8000-000000000006', 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Orders. short_code comes from the generate_short_code trigger; subtotal is
-- recomputed from order_items and total/platform_fee by compute_order_totals.
-- ---------------------------------------------------------------------------
insert into public.orders (
  id, store_id, customer_id, courier_id, address_id, type, table_number, status,
  subtotal, delivery_fee, tip, payment_method, payment_status, payment_ref, notes,
  created_at, accepted_at, preparing_at, ready_at, picked_up_at, delivered_at, cancelled_at
)
values
  -- 01 delivered, delivery, courier1
  ('80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000211', 'delivery', null, 'delivered',
   91600, 6000, 3000, 'mock', 'paid', 'mock_txn_000001', 'Sin cebolla en la ensalada, por favor.',
   now() - interval '5 days', now() - interval '5 days' + interval '2 minutes', now() - interval '5 days' + interval '5 minutes', now() - interval '5 days' + interval '30 minutes', now() - interval '5 days' + interval '36 minutes', now() - interval '5 days' + interval '58 minutes', null),
  -- 02 delivered, delivery, courier2
  ('80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000032', '70000000-0000-4000-8000-000000000221', 'delivery', null, 'delivered',
   50600, 4000, 0, 'cash', 'paid', null, null,
   now() - interval '4 days', now() - interval '4 days' + interval '1 minute', now() - interval '4 days' + interval '3 minutes', now() - interval '4 days' + interval '14 minutes', now() - interval '4 days' + interval '20 minutes', now() - interval '4 days' + interval '41 minutes', null),
  -- 03 delivered, delivery, courier1
  ('80000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000231', 'delivery', null, 'delivered',
   48800, 5000, 2000, 'mock', 'paid', 'mock_txn_000003', null,
   now() - interval '3 days', now() - interval '3 days' + interval '3 minutes', now() - interval '3 days' + interval '4 minutes', now() - interval '3 days' + interval '19 minutes', now() - interval '3 days' + interval '25 minutes', now() - interval '3 days' + interval '52 minutes', null),
  -- 04 delivered, delivery, courier2
  ('80000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000032', '70000000-0000-4000-8000-000000000212', 'delivery', null, 'delivered',
   76700, 7000, 5000, 'mock', 'paid', 'mock_txn_000004', 'Timbre de la oficina no funciona, llamar al llegar.',
   now() - interval '2 days', now() - interval '2 days' + interval '2 minutes', now() - interval '2 days' + interval '6 minutes', now() - interval '2 days' + interval '28 minutes', now() - interval '2 days' + interval '33 minutes', now() - interval '2 days' + interval '55 minutes', null),
  -- 05 delivered, pickup
  ('80000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000022', null, null, 'pickup', null, 'delivered',
   78700, 0, 0, 'cash', 'paid', null, null,
   now() - interval '2 days' - interval '3 hours', now() - interval '2 days' - interval '3 hours' + interval '1 minute', now() - interval '2 days' - interval '3 hours' + interval '2 minutes', now() - interval '2 days' - interval '3 hours' + interval '22 minutes', null, now() - interval '2 days' - interval '3 hours' + interval '35 minutes', null),
  -- 06 delivered, pickup
  ('80000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000023', null, null, 'pickup', null, 'delivered',
   40600, 0, 0, 'mock', 'paid', 'mock_txn_000006', null,
   now() - interval '1 day', now() - interval '1 day' + interval '1 minute', now() - interval '1 day' + interval '2 minutes', now() - interval '1 day' + interval '9 minutes', null, now() - interval '1 day' + interval '15 minutes', null),
  -- 07 picked_up, delivery, courier2
  ('80000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000032', '70000000-0000-4000-8000-000000000221', 'delivery', null, 'picked_up',
   69800, 6000, 0, 'mock', 'paid', 'mock_txn_000007', null,
   now() - interval '40 minutes', now() - interval '38 minutes', now() - interval '36 minutes', now() - interval '10 minutes', now() - interval '5 minutes', null, null),
  -- 08 picked_up, delivery, courier1, cash pending
  ('80000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000211', 'delivery', null, 'picked_up',
   70700, 5500, 0, 'cash', 'pending', null, 'Pagar con billete de 100.000.',
   now() - interval '25 minutes', now() - interval '24 minutes', now() - interval '22 minutes', now() - interval '6 minutes', now() - interval '2 minutes', null, null),
  -- 09 ready, delivery, unassigned (visible to couriers)
  ('80000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000023', null, '70000000-0000-4000-8000-000000000232', 'delivery', null, 'ready',
   42800, 4000, 1000, 'mock', 'paid', 'mock_txn_000009', null,
   now() - interval '20 minutes', now() - interval '19 minutes', now() - interval '17 minutes', now() - interval '1 minute', null, null, null),
  -- 10 preparing, delivery
  ('80000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000022', null, '70000000-0000-4000-8000-000000000221', 'delivery', null, 'preparing',
   75700, 7000, 0, 'mock', 'paid', 'mock_txn_000010', 'Sin wasabi.',
   now() - interval '12 minutes', now() - interval '11 minutes', now() - interval '9 minutes', null, null, null, null),
  -- 11 accepted, pickup
  ('80000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000021', null, null, 'pickup', null, 'accepted',
   38800, 0, 0, 'mock', 'paid', 'mock_txn_000011', null,
   now() - interval '8 minutes', now() - interval '7 minutes', null, null, null, null, null),
  -- 12 pending, delivery
  ('80000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000023', null, '70000000-0000-4000-8000-000000000231', 'delivery', null, 'pending',
   28400, 4500, 0, 'mock', 'pending', null, null,
   now() - interval '3 minutes', null, null, null, null, null, null),
  -- 13 preparing, anonymous table order
  ('80000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', null, null, null, 'table', 2, 'preparing',
   131500, 0, 0, 'cash', 'pending', null, 'Mesa 2, cumpleaños.',
   now() - interval '15 minutes', now() - interval '14 minutes', now() - interval '12 minutes', null, null, null, null),
  -- 14 pending, table order by a signed-in customer
  ('80000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000022', null, null, 'table', 1, 'pending',
   46800, 0, 0, 'cash', 'pending', null, null,
   now() - interval '5 minutes', null, null, null, null, null, null),
  -- 15 cancelled, delivery, refunded
  ('80000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000021', null, '70000000-0000-4000-8000-000000000211', 'delivery', null, 'cancelled',
   18900, 4000, 0, 'mock', 'refunded', 'mock_txn_000015', 'Cancelado por el cliente.',
   now() - interval '6 days', null, null, null, null, null, now() - interval '6 days' + interval '4 minutes')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Order items (unit_price already includes any option deltas)
-- ---------------------------------------------------------------------------
insert into public.order_items (id, order_id, product_id, name_snapshot, unit_price, quantity, options)
values
  -- 01
  ('90000000-0000-4000-8000-000000000101', '80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000011', 'Churrasco 350 g', 58900, 1, '[{"option":"Término","value":"Medio","price_delta":0}]'),
  ('90000000-0000-4000-8000-000000000102', '80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000016', 'Papas al carbón', 12900, 1, '[]'),
  ('90000000-0000-4000-8000-000000000103', '80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000017', 'Limonada de coco', 9900, 2, '[]'),
  -- 02
  ('90000000-0000-4000-8000-000000000201', '80000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000022', 'Arepa rellena de carne desmechada', 18400, 2, '[{"option":"Adiciones","value":"Queso extra","price_delta":2500}]'),
  ('90000000-0000-4000-8000-000000000202', '80000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000027', 'Jugo de mora', 6900, 2, '[]'),
  -- 03
  ('90000000-0000-4000-8000-000000000301', '80000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031', 'Bowl de quinoa y aguacate', 34900, 1, '[{"option":"Proteína","value":"Salmón","price_delta":6000}]'),
  ('90000000-0000-4000-8000-000000000302', '80000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000036', 'Smoothie verde', 13900, 1, '[{"option":"Tamaño","value":"350 ml","price_delta":0}]'),
  -- 04
  ('90000000-0000-4000-8000-000000000401', '80000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000041', 'California roll', 26900, 1, '[{"option":"Piezas","value":"8 piezas","price_delta":0}]'),
  ('90000000-0000-4000-8000-000000000402', '80000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000042', 'Roll acevichado', 32900, 1, '[]'),
  ('90000000-0000-4000-8000-000000000403', '80000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000046', 'Gyozas de cerdo', 16900, 1, '[]'),
  -- 05
  ('90000000-0000-4000-8000-000000000501', '80000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000052', 'Pizza pepperoni', 48900, 1, '[{"option":"Tamaño","value":"Mediana","price_delta":12000}]'),
  ('90000000-0000-4000-8000-000000000502', '80000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000056', 'Tiramisú', 14900, 2, '[]'),
  -- 06
  ('90000000-0000-4000-8000-000000000601', '80000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000061', 'Latte', 13400, 2, '[{"option":"Leche","value":"Avena","price_delta":2000},{"option":"Tamaño","value":"12 oz","price_delta":2500}]'),
  ('90000000-0000-4000-8000-000000000602', '80000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000064', 'Croissant de mantequilla', 6900, 2, '[]'),
  -- 07
  ('90000000-0000-4000-8000-000000000701', '80000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000012', 'Punta de anca 300 g', 54900, 1, '[{"option":"Término","value":"Tres cuartos","price_delta":0}]'),
  ('90000000-0000-4000-8000-000000000702', '80000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000014', 'Chorizo santarrosano', 14900, 1, '[]'),
  -- 08
  ('90000000-0000-4000-8000-000000000801', '80000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000051', 'Pizza margherita', 54900, 1, '[{"option":"Tamaño","value":"Familiar","price_delta":22000}]'),
  ('90000000-0000-4000-8000-000000000802', '80000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000057', 'Limonada natural', 7900, 2, '[]'),
  -- 09
  ('90000000-0000-4000-8000-000000000901', '80000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000023', 'Arepa de pollo con champiñones', 16900, 2, '[]'),
  ('90000000-0000-4000-8000-000000000902', '80000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000028', 'Gaseosa 400 ml', 4500, 2, '[]'),
  -- 10
  ('90000000-0000-4000-8000-000000001001', '80000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000043', 'Roll tempura de camarón', 31900, 2, '[]'),
  ('90000000-0000-4000-8000-000000001002', '80000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000047', 'Edamame', 11900, 1, '[]'),
  -- 11
  ('90000000-0000-4000-8000-000000001101', '80000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000034', 'Ensalada césar con pollo', 24900, 1, '[{"option":"Aderezo","value":"César","price_delta":0}]'),
  ('90000000-0000-4000-8000-000000001102', '80000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000037', 'Smoothie de frutos rojos', 13900, 1, '[]'),
  -- 12
  ('90000000-0000-4000-8000-000000001201', '80000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000067', 'Pancakes con frutos rojos', 19900, 1, '[]'),
  ('90000000-0000-4000-8000-000000001202', '80000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000062', 'Cappuccino', 8500, 1, '[{"option":"Leche","value":"Entera","price_delta":0}]'),
  -- 13
  ('90000000-0000-4000-8000-000000001301', '80000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000013', 'Baby beef 250 g', 49900, 2, '[]'),
  ('90000000-0000-4000-8000-000000001302', '80000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000018', 'Ensalada de la casa', 11900, 1, '[]'),
  ('90000000-0000-4000-8000-000000001303', '80000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000017', 'Limonada de coco', 9900, 2, '[]'),
  -- 14
  ('90000000-0000-4000-8000-000000001401', '80000000-0000-4000-8000-000000000014', '40000000-0000-4000-8000-000000000053', 'Pizza cuatro quesos', 38900, 1, '[{"option":"Tamaño","value":"Personal","price_delta":0}]'),
  ('90000000-0000-4000-8000-000000001402', '80000000-0000-4000-8000-000000000014', '40000000-0000-4000-8000-000000000057', 'Limonada natural', 7900, 1, '[]'),
  -- 15
  ('90000000-0000-4000-8000-000000001501', '80000000-0000-4000-8000-000000000015', '40000000-0000-4000-8000-000000000024', 'Arepa mixta', 18900, 1, '[]')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews (one per delivered order; store ratings update via trigger)
-- ---------------------------------------------------------------------------
insert into public.reviews (id, order_id, store_id, customer_id, rating, comment)
values
  ('b0000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000021', 5, 'El churrasco llegó en su punto y todavía caliente. Repetiré.'),
  ('b0000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000022', 4, 'Muy buenas arepas, el jugo llegó un poco tibio.'),
  ('b0000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000023', 5, 'Fresco, abundante y bien empacado.'),
  ('b0000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000021', 4, 'El roll acevichado es espectacular. Las gyozas podrían venir más calientes.'),
  ('b0000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000022', 5, 'La mejor pizza de masa madre de la zona.'),
  ('b0000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000023', 4, 'Café excelente y croissant crocante.')
on conflict (order_id) do nothing;

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
insert into public.favorites (user_id, store_id)
values
  ('10000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000006')
on conflict (user_id, store_id) do nothing;

-- ---------------------------------------------------------------------------
-- Courier locations
-- ---------------------------------------------------------------------------
insert into public.courier_locations (courier_id, lat, lng, heading)
values
  ('10000000-0000-4000-8000-000000000031', 4.6800, -74.0450, 120),
  ('10000000-0000-4000-8000-000000000032', 4.6600, -74.0600, 45)
on conflict (courier_id) do nothing;

-- ---------------------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------------------
insert into public.payouts (id, store_id, period_start, period_end, gross, commission, net, status, paid_at)
values
  ('c0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', current_date - 14, current_date - 8, 1250000, 100000, 1150000, 'paid', now() - interval '6 days'),
  ('c0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', current_date - 14, current_date - 8, 640000, 38400, 601600, 'paid', now() - interval '6 days'),
  ('c0000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', current_date - 7, current_date - 1, 980000, 78400, 901600, 'pending', null),
  ('c0000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', current_date - 7, current_date - 1, 720000, 43200, 676800, 'pending', null)
on conflict (id) do nothing;
