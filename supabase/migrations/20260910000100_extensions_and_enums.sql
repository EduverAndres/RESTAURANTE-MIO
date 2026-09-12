-- Extensions and enum types used across the Tienda schema.

create extension if not exists "pgcrypto" with schema extensions;

create type public.user_role as enum ('customer', 'merchant', 'courier', 'admin');
create type public.store_status as enum ('pending', 'active', 'suspended');
create type public.order_type as enum ('delivery', 'pickup', 'table');
create type public.order_status as enum (
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled'
);
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_method as enum ('cash', 'wompi', 'mercadopago', 'mock');
create type public.payout_status as enum ('pending', 'paid');
