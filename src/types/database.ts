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
          role: "owner" | "admin" | "operator";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          full_name: string;
          role?: "owner" | "admin" | "operator";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          full_name?: string;
          role?: "owner" | "admin" | "operator";
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
          payment_status: "pending" | "partial" | "paid";
          amount_paid: number;
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
          payment_status?: "pending" | "partial" | "paid";
          amount_paid?: number;
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
          payment_status?: "pending" | "partial" | "paid";
          amount_paid?: number;
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
      profile_role: "owner" | "admin" | "operator";
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
