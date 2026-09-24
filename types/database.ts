export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          line1: string
          line2: string | null
          lng: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          line1: string
          line2?: string | null
          lng?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          line1?: string
          line2?: string | null
          lng?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          accuracy_m: number | null
          courier_id: string
          heading: number | null
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          courier_id: string
          heading?: number | null
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          courier_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          locked_at: string | null
          order_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          locked_at?: string | null
          order_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          locked_at?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          name: string
          position: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          name: string
          position?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          name?: string
          position?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          name_snapshot: string
          options: Json
          options_delta: number
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: never
          name_snapshot: string
          options?: Json
          options_delta?: number
          order_id: string
          product_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: never
          name_snapshot?: string
          options?: Json
          options_delta?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          address_id: string | null
          cancelled_at: string | null
          courier_id: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_fee: number
          estimated_at: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          platform_fee: number
          preparing_at: string | null
          ready_at: string | null
          short_code: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          table_number: number | null
          tip: number
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          address_id?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_fee?: number
          estimated_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          platform_fee?: number
          preparing_at?: string | null
          ready_at?: string | null
          short_code?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          table_number?: number | null
          tip?: number
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          address_id?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_fee?: number
          estimated_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          platform_fee?: number
          preparing_at?: string | null
          ready_at?: string | null
          short_code?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          table_number?: number | null
          tip?: number
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_in_cents: number | null
          applied_at: string | null
          event_id: string
          id: string
          order_id: string | null
          payload: Json
          provider: string
          received_at: string
          reference: string
          status: string
        }
        Insert: {
          amount_in_cents?: number | null
          applied_at?: string | null
          event_id: string
          id?: string
          order_id?: string | null
          payload: Json
          provider: string
          received_at?: string
          reference: string
          status: string
        }
        Update: {
          amount_in_cents?: number | null
          applied_at?: string | null
          event_id?: string
          id?: string
          order_id?: string | null
          payload?: Json
          provider?: string
          received_at?: string
          reference?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          commission: number
          created_at: string
          gross: number
          id: string
          net: number
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          name: string
          option_id: string
          position: number
          price_delta: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          option_id: string
          position?: number
          price_delta?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          option_id?: string
          position?: number
          price_delta?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          max: number
          min: number
          name: string
          position: number
          product_id: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max?: number
          min?: number
          name: string
          position?: number
          product_id: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max?: number
          min?: number
          name?: string
          position?: number
          product_id?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          position: number
          price: number
          store_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          position?: number
          price: number
          store_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          position?: number
          price?: number
          store_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          store_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          store_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hit_count: number
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          hit_count?: number
          identifier: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hit_count?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          method: string
          note: string | null
          order_id: string
          reason: string
          reversed_in_payout_id: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          method: string
          note?: string | null
          order_id: string
          reason: string
          reversed_in_payout_id?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          method?: string
          note?: string | null
          order_id?: string
          reason?: string
          reversed_in_payout_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_reversed_in_payout_id_fkey"
            columns: ["reversed_in_payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tables: {
        Row: {
          created_at: string
          id: string
          number: number
          qr_token: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          qr_token?: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          qr_token?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tables_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          category: string | null
          commission_pct: number
          cover_url: string | null
          created_at: string
          delivery_fee: number
          delivery_radius_km: number
          description: string | null
          id: string
          is_open: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          min_order: number
          name: string
          owner_id: string
          prep_time_min: number
          rating_avg: number
          rating_count: number
          schedule: Json
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          theme: Json
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          commission_pct?: number
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_radius_km?: number
          description?: string | null
          id?: string
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order?: number
          name: string
          owner_id: string
          prep_time_min?: number
          rating_avg?: number
          rating_count?: number
          schedule?: Json
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          theme?: Json
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          commission_pct?: number
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_radius_km?: number
          description?: string | null
          id?: string
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order?: number
          name?: string
          owner_id?: string
          prep_time_min?: number
          rating_avg?: number
          rating_count?: number
          schedule?: Json
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          theme?: Json
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_order_items: {
        Args: { order_id: string }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_window_seconds: number
        }
        Returns: { hit_count: number; window_start: string }[]
      }
      generate_payouts: {
        Args: { p_period_start: string; p_period_end: string }
        Returns: {
          payouts_created: number
          payouts_skipped: number
          refunds_reversed: number
          refunds_resolved: number
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      next_short_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      option_store_id: {
        Args: { option_id: string }
        Returns: string
      }
      owns_store: {
        Args: { store_id: string }
        Returns: boolean
      }
      owns_store_folder: {
        Args: { folder: string }
        Returns: boolean
      }
      product_store_id: {
        Args: { product_id: string }
        Returns: string
      }
      record_refund: {
        Args: {
          p_order_id: string
          p_expected_payment_status: Database["public"]["Enums"]["payment_status"]
          p_amount: number
          p_reason: string
          p_method: string
          p_note: string | null
          p_issued_by: string
        }
        Returns: string
      }
      resolve_store_table: {
        Args: { store_slug: string; token: string }
        Returns: { id: string; store_id: string; number: number }[]
      }
      store_is_visible: {
        Args: { store_id: string }
        Returns: boolean
      }
      stores_nearby: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: {
          address: string | null
          category: string | null
          commission_pct: number
          cover_url: string | null
          created_at: string
          delivery_fee: number
          delivery_radius_km: number
          description: string | null
          distance_km: number
          id: string
          is_open: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          min_order: number
          name: string
          owner_id: string
          prep_time_min: number
          rating_avg: number
          rating_count: number
          schedule: Json
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          theme: Json
          updated_at: string
          whatsapp_phone: string | null
        }[]
      }
      user_role_of: {
        Args: { uid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "ready"
        | "picked_up"
        | "delivered"
        | "cancelled"
      order_type: "delivery" | "pickup" | "table"
      payment_method: "cash" | "wompi" | "mercadopago" | "mock"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      payout_status: "pending" | "paid"
      store_status: "pending" | "active" | "suspended"
      user_role: "customer" | "merchant" | "courier" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "picked_up",
        "delivered",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "table"],
      payment_method: ["cash", "wompi", "mercadopago", "mock"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      payout_status: ["pending", "paid"],
      store_status: ["pending", "active", "suspended"],
      user_role: ["customer", "merchant", "courier", "admin"],
    },
  },
} as const
