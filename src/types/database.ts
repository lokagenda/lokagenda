export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          document: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          logo_url: string | null;
          signature_url: string | null;
          reminder_days_before: number;
          reminder_auto_send: boolean;
          catalog_enabled: boolean;
          catalog_show_prices: boolean;
          ai_agent_enabled: boolean;
          ai_agent_prompt: string | null;
          zapi_client_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          document?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          logo_url?: string | null;
          signature_url?: string | null;
          reminder_days_before?: number;
          reminder_auto_send?: boolean;
          catalog_enabled?: boolean;
          catalog_show_prices?: boolean;
          ai_agent_enabled?: boolean;
          ai_agent_prompt?: string | null;
          zapi_client_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          document?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          logo_url?: string | null;
          signature_url?: string | null;
          reminder_days_before?: number;
          reminder_auto_send?: boolean;
          catalog_enabled?: boolean;
          catalog_show_prices?: boolean;
          ai_agent_enabled?: boolean;
          ai_agent_prompt?: string | null;
          zapi_client_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string;
          full_name: string;
          role: "owner" | "admin" | "operator" | "super_admin";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          full_name: string;
          role?: "owner" | "admin" | "operator" | "super_admin";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          full_name?: string;
          role?: "owner" | "admin" | "operator" | "super_admin";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          price: number;
          stock: number;
          status: "active" | "inactive" | "maintenance";
          track_stock: boolean;
          cost_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          price: number;
          stock?: number;
          status?: "active" | "inactive" | "maintenance";
          track_stock?: boolean;
          cost_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          stock?: number;
          status?: "active" | "inactive" | "maintenance";
          track_stock?: boolean;
          cost_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          document: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          notes: string | null;
          event_type: string | null;
          birthday: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          document?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          event_type?: string | null;
          birthday?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          document?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          event_type?: string | null;
          birthday?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          id: string;
          company_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          customer_email: string | null;
          event_date: string;
          event_end_date: string | null;
          event_address: string | null;
          event_city: string | null;
          event_state: string | null;
          event_zip_code: string | null;
          delivery_time: string | null;
          pickup_time: string | null;
          notes: string | null;
          status:
            | "pending"
            | "approved"
            | "rejected"
            | "expired"
            | "converted";
          total: number;
          discount: number;
          freight: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          customer_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          event_date: string;
          event_end_date?: string | null;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          event_zip_code?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          status?:
            | "pending"
            | "approved"
            | "rejected"
            | "expired"
            | "converted";
          total?: number;
          discount?: number;
          freight?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          event_date?: string;
          event_end_date?: string | null;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          event_zip_code?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          status?:
            | "pending"
            | "approved"
            | "rejected"
            | "expired"
            | "converted";
          total?: number;
          discount?: number;
          freight?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          quote_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          quote_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      rentals: {
        Row: {
          id: string;
          company_id: string;
          quote_id: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          customer_email: string | null;
          customer_document: string | null;
          event_date: string;
          event_end_date: string | null;
          event_address: string | null;
          event_city: string | null;
          event_state: string | null;
          event_zip_code: string | null;
          delivery_time: string | null;
          pickup_time: string | null;
          notes: string | null;
          status: "confirmed" | "delivered" | "returned" | "cancelled";
          total: number;
          discount: number;
          freight: number;
          contract_html: string | null;
          contract_pdf_url: string | null;
          signature_client: string | null;
          signature_company: string | null;
          payment_status: "pending" | "partial" | "paid";
          amount_paid: number;
          event_type: string | null;
          payment_date_signal: string | null;
          payment_date_total: string | null;
          assigned_employee_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          quote_id?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          customer_document?: string | null;
          event_date: string;
          event_end_date?: string | null;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          event_zip_code?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          status?: "confirmed" | "delivered" | "returned" | "cancelled";
          total?: number;
          discount?: number;
          freight?: number;
          contract_html?: string | null;
          contract_pdf_url?: string | null;
          signature_client?: string | null;
          signature_company?: string | null;
          payment_status?: "pending" | "partial" | "paid";
          amount_paid?: number;
          event_type?: string | null;
          payment_date_signal?: string | null;
          payment_date_total?: string | null;
          assigned_employee_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          quote_id?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          customer_document?: string | null;
          event_date?: string;
          event_end_date?: string | null;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          event_zip_code?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          status?: "confirmed" | "delivered" | "returned" | "cancelled";
          total?: number;
          discount?: number;
          freight?: number;
          contract_html?: string | null;
          contract_pdf_url?: string | null;
          signature_client?: string | null;
          signature_company?: string | null;
          payment_status?: "pending" | "partial" | "paid";
          amount_paid?: number;
          event_type?: string | null;
          payment_date_signal?: string | null;
          payment_date_total?: string | null;
          assigned_employee_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rentals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_items: {
        Row: {
          id: string;
          rental_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          rental_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          rental_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rental_items_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          rental_id: string;
          company_id: string;
          amount: number;
          method: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rental_id: string;
          company_id: string;
          amount: number;
          method?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          rental_id?: string;
          company_id?: string;
          amount?: number;
          method?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string | null;
          type: string;
          title: string;
          message: string;
          rental_id: string | null;
          quote_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id?: string | null;
          type: string;
          title: string;
          message: string;
          rental_id?: string | null;
          quote_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string | null;
          type?: string;
          title?: string;
          message?: string;
          rental_id?: string | null;
          quote_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
        ];
      };
      banners: {
        Row: {
          id: string;
          company_id: string | null;
          image_url: string;
          link_url: string | null;
          active: boolean;
          position: number;
          is_global: boolean;
          type: "banner" | "popup";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          image_url: string;
          link_url?: string | null;
          active?: boolean;
          position?: number;
          is_global?: boolean;
          type?: "banner" | "popup";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          image_url?: string;
          link_url?: string | null;
          active?: boolean;
          position?: number;
          is_global?: boolean;
          type?: "banner" | "popup";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banners_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price_monthly: number;
          price_semiannual: number;
          price_annual: number;
          max_products: number;
          max_rentals_month: number;
          max_users: number;
          features: Json;
          active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price_monthly: number;
          price_semiannual: number;
          price_annual: number;
          max_products?: number;
          max_rentals_month?: number;
          max_users?: number;
          features?: Json;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price_monthly?: number;
          price_semiannual?: number;
          price_annual?: number;
          max_products?: number;
          max_rentals_month?: number;
          max_users?: number;
          features?: Json;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          company_id: string;
          plan_id: string;
          status: "trial" | "active" | "past_due" | "cancelled" | "expired";
          billing_cycle: "monthly" | "semiannual" | "annual";
          current_price: number;
          mercadopago_subscription_id: string | null;
          mercadopago_payer_id: string | null;
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          asaas_checkout_id: string | null;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancelled_at: string | null;
          coupon_code: string | null;
          discount_applied: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          plan_id: string;
          status?: "trial" | "active" | "past_due" | "cancelled" | "expired";
          billing_cycle?: "monthly" | "semiannual" | "annual";
          current_price?: number;
          mercadopago_subscription_id?: string | null;
          mercadopago_payer_id?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          asaas_checkout_id?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancelled_at?: string | null;
          coupon_code?: string | null;
          discount_applied?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          plan_id?: string;
          status?: "trial" | "active" | "past_due" | "cancelled" | "expired";
          billing_cycle?: "monthly" | "semiannual" | "annual";
          current_price?: number;
          mercadopago_subscription_id?: string | null;
          mercadopago_payer_id?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          asaas_checkout_id?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancelled_at?: string | null;
          coupon_code?: string | null;
          discount_applied?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events_asaas: {
        Row: {
          event_id: string;
          event_type: string;
          processed_at: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          processed_at?: string | null;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      demo_products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          price: number;
          stock: number;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          stock?: number;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          stock?: number;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          document: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          notes: string | null;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          document?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          document?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_quotes: {
        Row: {
          id: string;
          customer_name: string;
          customer_phone: string | null;
          customer_email: string | null;
          event_date_offset: number;
          event_address: string | null;
          event_city: string | null;
          event_state: string | null;
          delivery_time: string | null;
          pickup_time: string | null;
          notes: string | null;
          discount: number;
          freight: number;
          items: Json;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          event_date_offset?: number;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          discount?: number;
          freight?: number;
          items?: Json;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          event_date_offset?: number;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          discount?: number;
          freight?: number;
          items?: Json;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_rentals: {
        Row: {
          id: string;
          customer_name: string;
          customer_phone: string | null;
          customer_email: string | null;
          customer_document: string | null;
          event_date_offset: number;
          event_address: string | null;
          event_city: string | null;
          event_state: string | null;
          delivery_time: string | null;
          pickup_time: string | null;
          notes: string | null;
          discount: number;
          freight: number;
          status: string;
          items: Json;
          position: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          customer_document?: string | null;
          event_date_offset?: number;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          discount?: number;
          freight?: number;
          status?: string;
          items?: Json;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          customer_phone?: string | null;
          customer_email?: string | null;
          customer_document?: string | null;
          event_date_offset?: number;
          event_address?: string | null;
          event_city?: string | null;
          event_state?: string | null;
          delivery_time?: string | null;
          pickup_time?: string | null;
          notes?: string | null;
          discount?: number;
          freight?: number;
          status?: string;
          items?: Json;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_data_logs: {
        Row: {
          id: string;
          company_id: string;
          pushed_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          pushed_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          pushed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "demo_data_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_config: {
        Row: {
          id: string;
          provider: "evolution_api" | "z_api" | "twilio" | "meta_cloud" | "uazapi";
          api_url: string | null;
          api_key: string | null;
          instance_id: string | null;
          phone_number_id: string | null;
          active: boolean;
          notify_sent_by_me_enabled: boolean;
          ai_globally_paused_at: string | null;
          ai_globally_paused_reason: string | null;
          uazapi_last_poll_ts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: "evolution_api" | "z_api" | "twilio" | "meta_cloud" | "uazapi";
          api_url?: string | null;
          api_key?: string | null;
          instance_id?: string | null;
          phone_number_id?: string | null;
          active?: boolean;
          notify_sent_by_me_enabled?: boolean;
          ai_globally_paused_at?: string | null;
          ai_globally_paused_reason?: string | null;
          uazapi_last_poll_ts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: "evolution_api" | "z_api" | "twilio" | "meta_cloud" | "uazapi";
          api_url?: string | null;
          api_key?: string | null;
          instance_id?: string | null;
          phone_number_id?: string | null;
          active?: boolean;
          notify_sent_by_me_enabled?: boolean;
          ai_globally_paused_at?: string | null;
          ai_globally_paused_reason?: string | null;
          uazapi_last_poll_ts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          content: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          content: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          content?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_message_log: {
        Row: {
          id: string;
          company_id: string | null;
          template_slug: string | null;
          phone: string;
          message: string;
          status: "pending" | "sent" | "failed" | "delivered";
          provider_response: Json | null;
          error_message: string | null;
          campaign_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          template_slug?: string | null;
          phone: string;
          message: string;
          status?: "pending" | "sent" | "failed" | "delivered";
          provider_response?: Json | null;
          error_message?: string | null;
          campaign_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          template_slug?: string | null;
          phone?: string;
          message?: string;
          status?: "pending" | "sent" | "failed" | "delivered";
          provider_response?: Json | null;
          error_message?: string | null;
          campaign_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_entries: {
        Row: {
          id: string;
          company_id: string;
          type: "income" | "expense";
          category: string | null;
          description: string;
          amount: number;
          date: string;
          rental_id: string | null;
          recurring_bill_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          type: "income" | "expense";
          category?: string | null;
          description: string;
          amount?: number;
          date?: string;
          rental_id?: string | null;
          recurring_bill_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          type?: "income" | "expense";
          category?: string | null;
          description?: string;
          amount?: number;
          date?: string;
          rental_id?: string | null;
          recurring_bill_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_bills: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          amount: number;
          due_day: number;
          frequency: string;
          active: boolean;
          last_paid_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          amount?: number;
          due_day?: number;
          frequency?: string;
          active?: boolean;
          last_paid_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          amount?: number;
          due_day?: number;
          frequency?: string;
          active?: boolean;
          last_paid_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_bills_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      group_scheduled_messages: {
        Row: {
          id: string;
          company_id: string;
          group_id: string;
          group_name: string | null;
          content: string | null;
          media_url: string | null;
          media_type: string | null;
          scheduled_at: string;
          status: string;
          recurrence: string;
          sent_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          group_id: string;
          group_name?: string | null;
          content?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          scheduled_at: string;
          status?: string;
          recurrence?: string;
          sent_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          group_id?: string;
          group_name?: string | null;
          content?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          scheduled_at?: string;
          status?: string;
          recurrence?: string;
          sent_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_scheduled_messages_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_contacts: {
        Row: {
          id: string;
          company_id: string;
          name: string | null;
          phone: string;
          tags: string | null;
          source: string | null;
          status: "lead" | "contacted" | "qualified" | "converted" | "lost";
          last_message_at: string | null;
          reactivated_at: string | null;
          manual_takeover_at: string | null;
          ai_paused_until: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name?: string | null;
          phone: string;
          tags?: string | null;
          source?: string | null;
          status?: "lead" | "contacted" | "qualified" | "converted" | "lost";
          last_message_at?: string | null;
          reactivated_at?: string | null;
          manual_takeover_at?: string | null;
          ai_paused_until?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string | null;
          phone?: string;
          tags?: string | null;
          source?: string | null;
          status?: "lead" | "contacted" | "qualified" | "converted" | "lost";
          last_message_at?: string | null;
          reactivated_at?: string | null;
          manual_takeover_at?: string | null;
          ai_paused_until?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_takeovers: {
        Row: {
          phone: string;
          takeover_at: string;
          updated_at: string;
        };
        Insert: {
          phone: string;
          takeover_at?: string;
          updated_at?: string;
        };
        Update: {
          phone?: string;
          takeover_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pending_inbound: {
        Row: {
          id: string;
          phone: string;
          text: string;
          company_id: string | null;
          contact_id: string | null;
          campaign_prompt: string | null;
          created_at: string;
          processing_at: string | null;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          phone: string;
          text: string;
          company_id?: string | null;
          contact_id?: string | null;
          campaign_prompt?: string | null;
          created_at?: string;
          processing_at?: string | null;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          phone?: string;
          text?: string;
          company_id?: string | null;
          contact_id?: string | null;
          campaign_prompt?: string | null;
          created_at?: string;
          processing_at?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      reactivation_queue: {
        Row: {
          id: string;
          company_id: string;
          phone: string;
          company_name: string | null;
          template_slug: string;
          status: "pending" | "sent" | "failed";
          attempts: number;
          last_error: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          phone: string;
          company_name?: string | null;
          template_slug: string;
          status?: "pending" | "sent" | "failed";
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          phone?: string;
          company_name?: string | null;
          template_slug?: string;
          status?: "pending" | "sent" | "failed";
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reactivation_queue_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          message_template: string;
          ai_enabled: boolean;
          ai_prompt: string | null;
          status: "draft" | "running" | "paused" | "completed";
          daily_limit: number;
          send_window_start: number;
          send_window_end: number;
          sent_count: number;
          total_targets: number;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          message_template: string;
          ai_enabled?: boolean;
          ai_prompt?: string | null;
          status?: "draft" | "running" | "paused" | "completed";
          daily_limit?: number;
          send_window_start?: number;
          send_window_end?: number;
          sent_count?: number;
          total_targets?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          message_template?: string;
          ai_enabled?: boolean;
          ai_prompt?: string | null;
          status?: "draft" | "running" | "paused" | "completed";
          daily_limit?: number;
          send_window_start?: number;
          send_window_end?: number;
          sent_count?: number;
          total_targets?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_queue: {
        Row: {
          id: string;
          campaign_id: string;
          company_id: string;
          contact_id: string | null;
          phone: string;
          status: "pending" | "sent" | "failed" | "skipped";
          sent_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          company_id: string;
          contact_id?: string | null;
          phone: string;
          status?: "pending" | "sent" | "failed" | "skipped";
          sent_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          company_id?: string;
          contact_id?: string | null;
          phone?: string;
          status?: "pending" | "sent" | "failed" | "skipped";
          sent_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          company_id: string;
          contact_phone: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          contact_phone: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          contact_phone?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      blocked_periods: {
        Row: {
          id: string;
          company_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_periods_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      event_types: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_types_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          phone: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          phone?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          duration_months: number;
          valid_from: string | null;
          valid_until: string | null;
          max_uses: number | null;
          used_count: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          duration_months?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          max_uses?: number | null;
          used_count?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_type?: "percentage" | "fixed";
          discount_value?: number;
          duration_months?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          max_uses?: number | null;
          used_count?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_templates: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          content: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          content: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          content?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      profile_role: "owner" | "admin" | "operator" | "super_admin";
      subscription_status: "trial" | "active" | "past_due" | "cancelled" | "expired";
      billing_cycle: "monthly" | "semiannual" | "annual";
      product_status: "active" | "inactive" | "maintenance";
      quote_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "converted";
      rental_status: "confirmed" | "delivered" | "returned" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

// Row type shortcuts
export type Company = Tables<"companies">;
export type Profile = Tables<"profiles">;
export type Product = Tables<"products">;
export type Customer = Tables<"customers">;
export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;
export type Rental = Tables<"rentals">;
export type RentalItem = Tables<"rental_items">;
export type ContractTemplate = Tables<"contract_templates">;
export type Payment = Tables<"payments">;
export type Notification = Tables<"notifications">;
export type Banner = Tables<"banners">;
export type Plan = Tables<"plans">;
export type Subscription = Tables<"subscriptions">;
export type DemoProduct = Tables<"demo_products">;
export type DemoCustomer = Tables<"demo_customers">;
export type DemoQuote = Tables<"demo_quotes">;
export type DemoRental = Tables<"demo_rentals">;
export type DemoDataLog = Tables<"demo_data_logs">;
export type WhatsAppConfig = Tables<"whatsapp_config">;
export type WhatsAppTemplate = Tables<"whatsapp_templates">;
export type WhatsAppMessageLog = Tables<"whatsapp_message_log">;
export type Employee = Tables<"employees">;
export type Coupon = Tables<"coupons">;
export type FinancialEntry = Tables<"financial_entries">;
export type EventType = Tables<"event_types">;
export type BlockedPeriod = Tables<"blocked_periods">;
export type CampaignContact = Tables<"campaign_contacts">;
export type Campaign = Tables<"campaigns">;
export type CampaignQueue = Tables<"campaign_queue">;
export type AiConversation = Tables<"ai_conversations">;
