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
      ad_campaign_pauses: {
        Row: {
          campaign_id: string
          id: string
          paused_at: string
          reason: string
          resumed_at: string | null
        }
        Insert: {
          campaign_id: string
          id?: string
          paused_at?: string
          reason: string
          resumed_at?: string | null
        }
        Update: {
          campaign_id?: string
          id?: string
          paused_at?: string
          reason?: string
          resumed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_pauses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_snapshot: string | null
          created_at: string
          daily_price: number
          ended_at: string | null
          ends_on: string
          id: string
          pause_reason: string | null
          placement: string
          rejection_reason: string | null
          requested_by: string | null
          starts_on: string
          status: string
          store_id: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_snapshot?: string | null
          created_at?: string
          daily_price: number
          ended_at?: string | null
          ends_on: string
          id?: string
          pause_reason?: string | null
          placement: string
          rejection_reason?: string | null
          requested_by?: string | null
          starts_on: string
          status?: string
          store_id: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_snapshot?: string | null
          created_at?: string
          daily_price?: number
          ended_at?: string | null
          ends_on?: string
          id?: string
          pause_reason?: string | null
          placement?: string
          rejection_reason?: string | null
          requested_by?: string | null
          starts_on?: string
          status?: string
          store_id?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_placement_fkey"
            columns: ["placement"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["placement"]
          },
          {
            foreignKeyName: "ad_campaigns_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_daily_stats: {
        Row: {
          campaign_id: string
          clicks: number
          day: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          day: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          day?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_placements: {
        Row: {
          active: boolean
          daily_price: number
          max_days: number
          max_slots: number
          min_days: number
          placement: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          daily_price: number
          max_days: number
          max_slots: number
          min_days: number
          placement: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          daily_price?: number
          max_days?: number
          max_slots?: number
          min_days?: number
          placement?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      companies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_address: string
          billing_email: string
          city: string
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string | null
          credit_limit: number
          dv: number
          id: string
          legal_name: string
          max_tip_pct: number
          nit: string
          payment_terms_days: number
          status: string
          status_note: string | null
          suspended_at: string | null
          terms_accepted_at: string
          terms_accepted_by: string | null
          terms_version: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_address: string
          billing_email: string
          city?: string
          contact_name: string
          contact_phone: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          dv: number
          id?: string
          legal_name: string
          max_tip_pct?: number
          nit: string
          payment_terms_days?: number
          status?: string
          status_note?: string | null
          suspended_at?: string | null
          terms_accepted_at?: string
          terms_accepted_by?: string | null
          terms_version: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_address?: string
          billing_email?: string
          city?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          dv?: number
          id?: string
          legal_name?: string
          max_tip_pct?: number
          nit?: string
          payment_terms_days?: number
          status?: string
          status_note?: string | null
          suspended_at?: string | null
          terms_accepted_at?: string
          terms_accepted_by?: string | null
          terms_version?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_terms_accepted_by_fkey"
            columns: ["terms_accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          monthly_budget: number | null
          per_order_limit: number | null
          revoked_at: string | null
          role: string
          token_hash: string
          uses: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          monthly_budget?: number | null
          per_order_limit?: number | null
          revoked_at?: string | null
          role?: string
          token_hash: string
          uses?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          monthly_budget?: number | null
          per_order_limit?: number | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          active: boolean
          company_id: string
          id: string
          invitation_id: string | null
          joined_at: string
          left_at: string | null
          monthly_budget: number | null
          per_order_limit: number | null
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          invitation_id?: string | null
          joined_at?: string
          left_at?: string | null
          monthly_budget?: number | null
          per_order_limit?: number | null
          role?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          invitation_id?: string | null
          joined_at?: string
          left_at?: string | null
          monthly_budget?: number | null
          per_order_limit?: number | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "company_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_statement_lines: {
        Row: {
          amount: number
          company_id: string
          corporate_reference: string | null
          created_at: string
          id: string
          kind: string
          member_name: string | null
          order_id: string
          ordered_at: string
          short_code: string
          statement_id: string
          store_name: string
          voided: boolean
        }
        Insert: {
          amount: number
          company_id: string
          corporate_reference?: string | null
          created_at?: string
          id?: string
          kind: string
          member_name?: string | null
          order_id: string
          ordered_at: string
          short_code: string
          statement_id: string
          store_name: string
          voided?: boolean
        }
        Update: {
          amount?: number
          company_id?: string
          corporate_reference?: string | null
          created_at?: string
          id?: string
          kind?: string
          member_name?: string | null
          order_id?: string
          ordered_at?: string
          short_code?: string
          statement_id?: string
          store_name?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_statement_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_statement_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "company_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      company_statements: {
        Row: {
          company_id: string
          created_at: string
          due_on: string
          dv: number
          id: string
          issued_on: string
          legal_name: string
          nit: string
          paid_at: string | null
          payment_ref: string | null
          period: string
          status: string
          total: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          due_on: string
          dv: number
          id?: string
          issued_on: string
          legal_name: string
          nit: string
          paid_at?: string | null
          payment_ref?: string | null
          period: string
          status?: string
          total: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          due_on?: string
          dv?: number
          id?: string
          issued_on?: string
          legal_name?: string
          nit?: string
          paid_at?: string | null
          payment_ref?: string | null
          period?: string
          status?: string
          total?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          max_uses: number | null
          min_order: number
          starts_at: string | null
          store_id: string
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          max_uses?: number | null
          min_order?: number
          starts_at?: string | null
          store_id: string
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          min_order?: number
          starts_at?: string | null
          store_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_ledger: {
        Row: {
          amount: number
          cash_collected: number
          courier_id: string
          created_at: string
          created_by: string | null
          earnings: number
          id: string
          kind: string
          note: string | null
          occurred_at: string
          order_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          settled_in_payout_id: string | null
          store_id: string | null
        }
        Insert: {
          amount?: number
          cash_collected?: number
          courier_id: string
          created_at?: string
          created_by?: string | null
          earnings?: number
          id?: string
          kind: string
          note?: string | null
          occurred_at?: string
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          settled_in_payout_id?: string | null
          store_id?: string | null
        }
        Update: {
          amount?: number
          cash_collected?: number
          courier_id?: string
          created_at?: string
          created_by?: string | null
          earnings?: number
          id?: string
          kind?: string
          note?: string | null
          occurred_at?: string
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          settled_in_payout_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_ledger_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_ledger_settled_in_payout_id_fkey"
            columns: ["settled_in_payout_id"]
            isOneToOne: false
            referencedRelation: "courier_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      courier_payouts: {
        Row: {
          adjustments: number
          carried_in: number
          carried_into_payout_id: string | null
          cash_collected: number
          courier_id: string
          created_at: string
          deliveries: number
          earnings: number
          id: string
          net: number
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          adjustments?: number
          carried_in?: number
          carried_into_payout_id?: string | null
          cash_collected?: number
          courier_id: string
          created_at?: string
          deliveries?: number
          earnings?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          adjustments?: number
          carried_in?: number
          carried_into_payout_id?: string | null
          cash_collected?: number
          courier_id?: string
          created_at?: string
          deliveries?: number
          earnings?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_payouts_carried_into_payout_id_fkey"
            columns: ["carried_into_payout_id"]
            isOneToOne: false
            referencedRelation: "courier_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_payouts_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          created_at: string
          document_number: string | null
          license_expires_on: string | null
          plate: string | null
          soat_expires_on: string | null
          status: string
          status_note: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
          zone: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          created_at?: string
          document_number?: string | null
          license_expires_on?: string | null
          plate?: string | null
          soat_expires_on?: string | null
          status?: string
          status_note?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
          zone?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          created_at?: string
          document_number?: string | null
          license_expires_on?: string | null
          plate?: string | null
          soat_expires_on?: string | null
          status?: string
          status_note?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          min_order: number
          reason: string
          referral_id: string | null
          used_order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          min_order?: number
          reason: string
          referral_id?: string | null
          used_order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          min_order?: number
          reason?: string
          referral_id?: string | null
          used_order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_used_order_id_fkey"
            columns: ["used_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      legal_consents: {
        Row: {
          accepted_at: string
          document_version: string
          id: string
          ip: unknown
          marketing_opt_in: boolean | null
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          document_version: string
          id?: string
          ip?: unknown
          marketing_opt_in?: boolean | null
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          document_version?: string
          id?: string
          ip?: unknown
          marketing_opt_in?: boolean | null
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          enabled: boolean
          min_order: number
          reward_label: string
          reward_value: number
          stamps_required: number
          store_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          min_order?: number
          reward_label?: string
          reward_value?: number
          stamps_required?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          min_order?: number
          reward_label?: string
          reward_value?: number
          stamps_required?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
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
      order_corporate_billing: {
        Row: {
          billing_address: string
          billing_email: string
          city: string
          company_id: string
          created_at: string
          dv: number
          invoiced_at: string | null
          legal_name: string
          merchant_invoice_ref: string | null
          nit: string
          order_id: string
          store_id: string
        }
        Insert: {
          billing_address: string
          billing_email: string
          city: string
          company_id: string
          created_at?: string
          dv: number
          invoiced_at?: string | null
          legal_name: string
          merchant_invoice_ref?: string | null
          nit: string
          order_id: string
          store_id: string
        }
        Update: {
          billing_address?: string
          billing_email?: string
          city?: string
          company_id?: string
          created_at?: string
          dv?: number
          invoiced_at?: string | null
          legal_name?: string
          merchant_invoice_ref?: string | null
          nit?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_corporate_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_corporate_billing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_corporate_billing_store_id_fkey"
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
          line_total?: number | null
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
          line_total?: number | null
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
          company_id: string | null
          company_member_id: string | null
          corporate_period: string | null
          corporate_reference: string | null
          coupon_id: string | null
          courier_id: string | null
          created_at: string
          credit_id: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_fee: number
          estimated_at: string | null
          id: string
          loyalty_redeemed: boolean
          merchant_discount: number
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          platform_discount: number
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
          company_id?: string | null
          company_member_id?: string | null
          corporate_period?: string | null
          corporate_reference?: string | null
          coupon_id?: string | null
          courier_id?: string | null
          created_at?: string
          credit_id?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_fee?: number
          estimated_at?: string | null
          id?: string
          loyalty_redeemed?: boolean
          merchant_discount?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          platform_discount?: number
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
          company_id?: string | null
          company_member_id?: string | null
          corporate_period?: string | null
          corporate_reference?: string | null
          coupon_id?: string | null
          courier_id?: string | null
          created_at?: string
          credit_id?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_fee?: number
          estimated_at?: string | null
          id?: string
          loyalty_redeemed?: boolean
          merchant_discount?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          platform_discount?: number
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
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_member_id_fkey"
            columns: ["company_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
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
            foreignKeyName: "orders_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "customer_credits"
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
          ads_fee: number
          carried_in: number
          carried_into_payout_id: string | null
          cash_collected: number
          commission: number
          created_at: string
          delivery_and_tips: number
          gross: number
          id: string
          net: number
          paid_at: string | null
          period_end: string
          period_start: string
          plan_fee: number
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          ads_fee?: number
          carried_in?: number
          carried_into_payout_id?: string | null
          cash_collected?: number
          commission?: number
          created_at?: string
          delivery_and_tips?: number
          gross?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          plan_fee?: number
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          ads_fee?: number
          carried_in?: number
          carried_into_payout_id?: string | null
          cash_collected?: number
          commission?: number
          created_at?: string
          delivery_and_tips?: number
          gross?: number
          id?: string
          net?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan_fee?: number
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_carried_into_payout_id_fkey"
            columns: ["carried_into_payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          monthly_fee: number
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          monthly_fee: number
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_fee?: number
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          courier_cash_debt_cap: number
          id: boolean
          referral_amount: number
          referral_credit_days: number
          referral_min_order: number
          referral_monthly_budget: number
          updated_at: string
        }
        Insert: {
          courier_cash_debt_cap?: number
          id?: boolean
          referral_amount?: number
          referral_credit_days?: number
          referral_min_order?: number
          referral_monthly_budget?: number
          updated_at?: string
        }
        Update: {
          courier_cash_debt_cap?: number
          id?: boolean
          referral_amount?: number
          referral_credit_days?: number
          referral_min_order?: number
          referral_monthly_budget?: number
          updated_at?: string
        }
        Relationships: []
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
      product_reviews: {
        Row: {
          author_first_name: string | null
          comment: string | null
          created_at: string
          customer_id: string | null
          hidden_at: string | null
          id: string
          order_id: string
          order_item_id: string
          product_id: string | null
          rating: number
          store_id: string
        }
        Insert: {
          author_first_name?: string | null
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          hidden_at?: string | null
          id?: string
          order_id: string
          order_item_id: string
          product_id?: string | null
          rating: number
          store_id: string
        }
        Update: {
          author_first_name?: string | null
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          hidden_at?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          product_id?: string | null
          rating?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          rating_avg: number
          rating_count: number
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
          rating_avg?: number
          rating_count?: number
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
          rating_avg?: number
          rating_count?: number
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
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          rewarded_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          rewarded_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          rewarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: false
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
      reservation_settings: {
        Row: {
          blocked_dates: string[]
          covers_per_slot: number
          duration_minutes: number
          enabled: boolean
          max_days_ahead: number
          max_party_size: number
          min_lead_minutes: number
          policy_text: string
          slot_minutes: number
          store_id: string
          updated_at: string
        }
        Insert: {
          blocked_dates?: string[]
          covers_per_slot?: number
          duration_minutes?: number
          enabled?: boolean
          max_days_ahead?: number
          max_party_size?: number
          min_lead_minutes?: number
          policy_text?: string
          slot_minutes?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          blocked_dates?: string[]
          covers_per_slot?: number
          duration_minutes?: number
          enabled?: boolean
          max_days_ahead?: number
          max_party_size?: number
          min_lead_minutes?: number
          policy_text?: string
          slot_minutes?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          code: string
          confirmed_at: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          customer_id: string
          decline_reason: string | null
          declined_at: string | null
          id: string
          no_show_at: string | null
          notes: string | null
          occasion: string | null
          party_size: number
          seated_at: string | null
          service_date: string
          starts_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          confirmed_at?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          customer_id: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          no_show_at?: string | null
          notes?: string | null
          occasion?: string | null
          party_size: number
          seated_at?: string | null
          service_date: string
          starts_at: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          confirmed_at?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          customer_id?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          no_show_at?: string | null
          notes?: string | null
          occasion?: string | null
          party_size?: number
          seated_at?: string | null
          service_date?: string
          starts_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          founder_until: string | null
          id: string
          is_open: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          min_order: number
          name: string
          online_payment_pct: number
          owner_id: string
          plan: string
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
          founder_until?: string | null
          id?: string
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order?: number
          name: string
          online_payment_pct?: number
          owner_id: string
          plan?: string
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
          founder_until?: string | null
          id?: string
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order?: number
          name?: string
          online_payment_pct?: number
          owner_id?: string
          plan?: string
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
          {
            foreignKeyName: "stores_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invitation: {
        Args: { p_token: string }
        Returns: {
          company_id: string
          outcome: string
        }[]
      }
      approve_ad_campaign: {
        Args: { p_admin: string; p_id: string }
        Returns: string
      }
      authorize_corporate_payment: {
        Args: { p_order_id: string }
        Returns: {
          outcome: string
          payment_ref: string
        }[]
      }
      bogota_month_start: { Args: never; Returns: string }
      can_edit_order_items: { Args: { order_id: string }; Returns: boolean }
      claim_referral: { Args: { p_code: string }; Returns: string }
      company_credit_used: { Args: { p_company_id: string }; Returns: number }
      company_is_overdue: { Args: { p_company_id: string }; Returns: boolean }
      company_member_spent: {
        Args: { p_member_id: string; p_period: string }
        Returns: number
      }
      company_month_summary: {
        Args: { p_company_id: string; p_period: string }
        Returns: {
          credit_limit: number
          credit_used: number
          members_active: number
          open_balance: number
          orders_count: number
          orders_total: number
          overdue: boolean
        }[]
      }
      company_orders: {
        Args: { p_company_id: string; p_period: string }
        Returns: {
          corporate_reference: string
          created_at: string
          member_name: string
          order_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          short_code: string
          status: Database["public"]["Enums"]["order_status"]
          store_name: string
          total: number
        }[]
      }
      company_team: {
        Args: { p_company_id: string }
        Returns: {
          active: boolean
          email: string
          full_name: string
          joined_at: string
          left_at: string
          member_id: string
          monthly_budget: number
          per_order_limit: number
          role: string
          spent_this_month: number
          user_id: string
        }[]
      }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_window_seconds: number
        }
        Returns: {
          hit_count: number
          window_start: string
        }[]
      }
      courier_cash_balance: { Args: { p_courier: string }; Returns: number }
      courier_cash_in_progress: {
        Args: { p_courier: string }
        Returns: number
      }
      create_company_invitation: {
        Args: {
          p_company_id: string
          p_expires_days: number
          p_max_uses: number
          p_monthly_budget: number
          p_per_order_limit: number
          p_role: string
          p_token_hash: string
        }
        Returns: {
          invitation_id: string
          outcome: string
        }[]
      }
      create_reservation: {
        Args: {
          p_contact_name: string
          p_contact_phone: string
          p_customer_id: string
          p_max_active: number
          p_notes: string
          p_occasion: string
          p_party_size: number
          p_service_date: string
          p_starts_at: string
          p_store_id: string
        }
        Returns: {
          code: string
          outcome: string
          reservation_id: string
        }[]
      }
      ensure_referral_code: { Args: never; Returns: string }
      generate_company_statements: {
        Args: { p_period: string }
        Returns: {
          lines_added: number
          statements_created: number
          statements_skipped: number
        }[]
      }
      generate_courier_payouts: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: {
          debts_carried: number
          entries_settled: number
          payouts_created: number
          payouts_skipped: number
        }[]
      }
      generate_payouts: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: {
          payouts_created: number
          payouts_skipped: number
          refunds_resolved: number
          refunds_reversed: number
        }[]
      }
      is_active_courier: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member: { Args: { p_company_id: string }; Returns: boolean }
      my_corporate_budget: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_status: string
          credit_available: number
          credit_limit: number
          credit_used: number
          max_tip_pct: number
          member_id: string
          monthly_budget: number
          overdue: boolean
          per_order_limit: number
          period: string
          role: string
          spent_this_month: number
        }[]
      }
      my_courier_cash_status: {
        Args: never
        Returns: {
          balance: number
          blocked: boolean
          cap: number
          exposure: number
          in_progress: number
        }[]
      }
      next_short_code: { Args: never; Returns: string }
      nit_check_digit: { Args: { p_nit: string }; Returns: number }
      option_store_id: { Args: { option_id: string }; Returns: string }
      owns_store: { Args: { store_id: string }; Returns: boolean }
      owns_store_folder: { Args: { folder: string }; Returns: boolean }
      peek_company_invitation: {
        Args: { p_token: string }
        Returns: {
          company_name: string
          expires_at: string
          monthly_budget: number
          outcome: string
          per_order_limit: number
          role: string
        }[]
      }
      product_store_id: { Args: { product_id: string }; Returns: string }
      record_ad_click: { Args: { p_id: string }; Returns: string }
      record_refund: {
        Args: {
          p_amount: number
          p_expected_payment_status: Database["public"]["Enums"]["payment_status"]
          p_issued_by: string
          p_method: string
          p_note: string
          p_order_id: string
          p_reason: string
        }
        Returns: string
      }
      referral_spent_this_month: { Args: never; Returns: number }
      refresh_overdue_company_statements: { Args: never; Returns: number }
      register_company: {
        Args: {
          p_billing_address: string
          p_billing_email: string
          p_city: string
          p_contact_name: string
          p_contact_phone: string
          p_dv: number
          p_legal_name: string
          p_nit: string
          p_terms_version: string
          p_trade_name: string
        }
        Returns: {
          company_id: string
          outcome: string
        }[]
      }
      resolve_store_table: {
        Args: { store_slug: string; token: string }
        Returns: {
          id: string
          number: number
          store_id: string
        }[]
      }
      revoke_company_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      set_company_member: {
        Args: {
          p_active: boolean
          p_member_id: string
          p_monthly_budget: number
          p_per_order_limit: number
          p_role: string
        }
        Returns: string
      }
      sponsored_stores: {
        Args: { p_placement: string }
        Returns: {
          campaign_id: string
          category: string
          name: string
          slug: string
          store_id: string
        }[]
      }
      store_is_visible: { Args: { store_id: string }; Returns: boolean }
      stores_nearby: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: {
          address: string
          category: string
          commission_pct: number
          cover_url: string
          created_at: string
          delivery_fee: number
          delivery_radius_km: number
          description: string
          distance_km: number
          id: string
          is_open: boolean
          lat: number
          lng: number
          logo_url: string
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
          whatsapp_phone: string
        }[]
      }
      submit_order_reviews: {
        Args: {
          p_comment: string
          p_items?: Json
          p_order_id: string
          p_rating: number
        }
        Returns: undefined
      }
      table_token_store_slug: { Args: { token: string }; Returns: string }
      try_delivery_code: {
        Args: { p_code: string; p_max_attempts: number; p_order_id: string }
        Returns: {
          attempts: number
          outcome: string
        }[]
      }
      update_company_billing: {
        Args: {
          p_billing_address: string
          p_billing_email: string
          p_city: string
          p_company_id: string
          p_contact_name: string
          p_contact_phone: string
        }
        Returns: string
      }
      user_role_of: {
        Args: { uid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      void_company_statement: {
        Args: { p_reason: string; p_statement_id: string }
        Returns: string
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
      payment_method: "cash" | "wompi" | "mercadopago" | "mock" | "corporate"
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      payment_method: ["cash", "wompi", "mercadopago", "mock", "corporate"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      payout_status: ["pending", "paid"],
      store_status: ["pending", "active", "suspended"],
      user_role: ["customer", "merchant", "courier", "admin"],
    },
  },
} as const

