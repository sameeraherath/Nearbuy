export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          area: string;
          cover_photo_path: string | null;
          created_at: string;
          cuisine_tags: string[];
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          area?: string;
          cover_photo_path?: string | null;
          created_at?: string;
          cuisine_tags?: string[];
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
          sort_order?: number;
        };
        Update: {
          area?: string;
          cover_photo_path?: string | null;
          created_at?: string;
          cuisine_tags?: string[];
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      customer_locations: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          is_default: boolean;
          label: string;
          lat: number;
          lng: number;
          note: string;
          place_id: string | null;
          room: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          is_default?: boolean;
          label: string;
          lat: number;
          lng: number;
          note?: string;
          place_id?: string | null;
          room?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          lat?: number;
          lng?: number;
          note?: string;
          place_id?: string | null;
          room?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_locations_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_locations_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
        ];
      };
      foods: {
        Row: {
          business_id: string;
          category: string;
          created_at: string;
          description: string;
          id: string;
          is_available: boolean;
          name: string;
          photo_path: string | null;
          selling_price: number;
          shop_price: number;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_available?: boolean;
          name: string;
          photo_path?: string | null;
          selling_price: number;
          shop_price: number;
          sort_order?: number;
        };
        Update: {
          business_id?: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_available?: boolean;
          name?: string;
          photo_path?: string | null;
          selling_price?: number;
          shop_price?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'foods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'foods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      order_codes: {
        Row: {
          code: string;
          order_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          order_id: string;
        };
        Update: {
          code?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_codes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'my_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_codes_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: number;
          order_id: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          order_id: string;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          order_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'my_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          food_id: string | null;
          id: string;
          is_unavailable: boolean;
          name: string;
          order_id: string;
          qty: number;
          selling_price: number;
          shop_price: number;
        };
        ComputedFields: never;
        Insert: {
          food_id?: string | null;
          id?: string;
          is_unavailable?: boolean;
          name: string;
          order_id: string;
          qty: number;
          selling_price: number;
          shop_price: number;
        };
        Update: {
          food_id?: string | null;
          id?: string;
          is_unavailable?: boolean;
          name?: string;
          order_id?: string;
          qty?: number;
          selling_price?: number;
          shop_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'menu_foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'my_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          assigned_at: string | null;
          business_id: string;
          cancelled_at: string | null;
          client_ref: string | null;
          code_attempts: number;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          delivered_by_override: boolean;
          delivery_date: string;
          delivery_fee: number;
          id: string;
          items_selling_total: number;
          items_shop_total: number;
          location_label: string;
          location_lat: number;
          location_lng: number;
          location_note: string;
          location_place_id: string | null;
          location_room: string;
          order_number: string;
          override_note: string | null;
          override_reason: Database['public']['Enums']['override_reason'] | null;
          picked_up_at: string | null;
          placed_at: string;
          rider_id: string | null;
          rider_pay: number;
          status: Database['public']['Enums']['order_status'];
          total_to_collect: number;
        };
        ComputedFields: never;
        Insert: {
          assigned_at?: string | null;
          business_id: string;
          cancelled_at?: string | null;
          client_ref?: string | null;
          code_attempts?: number;
          customer_id: string;
          customer_name?: string;
          customer_phone: string;
          delivered_at?: string | null;
          delivered_by_override?: boolean;
          delivery_date: string;
          delivery_fee: number;
          id?: string;
          items_selling_total: number;
          items_shop_total: number;
          location_label: string;
          location_lat: number;
          location_lng: number;
          location_note?: string;
          location_place_id?: string | null;
          location_room?: string;
          order_number?: string;
          override_note?: string | null;
          override_reason?: Database['public']['Enums']['override_reason'] | null;
          picked_up_at?: string | null;
          placed_at?: string;
          rider_id?: string | null;
          rider_pay?: number;
          status?: Database['public']['Enums']['order_status'];
          total_to_collect: number;
        };
        Update: {
          assigned_at?: string | null;
          business_id?: string;
          cancelled_at?: string | null;
          client_ref?: string | null;
          code_attempts?: number;
          customer_id?: string;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          delivered_by_override?: boolean;
          delivery_date?: string;
          delivery_fee?: number;
          id?: string;
          items_selling_total?: number;
          items_shop_total?: number;
          location_label?: string;
          location_lat?: number;
          location_lng?: number;
          location_note?: string;
          location_place_id?: string | null;
          location_room?: string;
          order_number?: string;
          override_note?: string | null;
          override_reason?: Database['public']['Enums']['override_reason'] | null;
          picked_up_at?: string | null;
          placed_at?: string;
          rider_id?: string | null;
          rider_pay?: number;
          status?: Database['public']['Enums']['order_status'];
          total_to_collect?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_location_place_id_fkey';
            columns: ['location_place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: false;
            referencedRelation: 'riders';
            referencedColumns: ['profile_id'];
          },
        ];
      };
      places: {
        Row: {
          created_at: string;
          id: string;
          lat: number;
          lng: number;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          lat: number;
          lng: number;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          lat?: number;
          lng?: number;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_blocked: boolean;
          phone: string;
          role: Database['public']['Enums']['user_role'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          is_blocked?: boolean;
          phone: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_blocked?: boolean;
          phone?: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          platform: string;
          profile_id: string;
          token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          platform?: string;
          profile_id: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          platform?: string;
          profile_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rider_locations: {
        Row: {
          accuracy: number | null;
          heading: number | null;
          lat: number;
          lng: number;
          rider_id: string;
          speed: number | null;
          updated_at: string;
        };
        Insert: {
          accuracy?: number | null;
          heading?: number | null;
          lat: number;
          lng: number;
          rider_id: string;
          speed?: number | null;
          updated_at?: string;
        };
        Update: {
          accuracy?: number | null;
          heading?: number | null;
          lat?: number;
          lng?: number;
          rider_id?: string;
          speed?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rider_locations_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: true;
            referencedRelation: 'riders';
            referencedColumns: ['profile_id'];
          },
        ];
      };
      riders: {
        Row: {
          created_at: string;
          is_active: boolean;
          profile_id: string;
          vehicle_note: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          is_active?: boolean;
          profile_id: string;
          vehicle_note?: string;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          profile_id?: string;
          vehicle_note?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'riders_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          cutoff_time: string;
          delivery_fee: number;
          delivery_window_text: string;
          free_delivery_over: number | null;
          free_delivery_until: string | null;
          help_phone: string;
          id: boolean;
          min_order_amount: number;
          ordering_enabled: boolean;
          rider_pay_per_delivery: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cutoff_time?: string;
          delivery_fee?: number;
          delivery_window_text?: string;
          free_delivery_over?: number | null;
          free_delivery_until?: string | null;
          help_phone?: string;
          id?: boolean;
          min_order_amount?: number;
          ordering_enabled?: boolean;
          rider_pay_per_delivery?: number;
          updated_at?: string;
        };
        Update: {
          cutoff_time?: string;
          delivery_fee?: number;
          delivery_window_text?: string;
          free_delivery_over?: number | null;
          free_delivery_until?: string | null;
          help_phone?: string;
          id?: boolean;
          min_order_amount?: number;
          ordering_enabled?: boolean;
          rider_pay_per_delivery?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      sms_messages: {
        Row: {
          attempts: number;
          body: string;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['sms_kind'];
          order_id: string | null;
          profile_id: string | null;
          provider: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['sms_status'];
          status_updated_at: string | null;
          to_phone: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          body: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          kind: Database['public']['Enums']['sms_kind'];
          order_id?: string | null;
          profile_id?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['sms_status'];
          status_updated_at?: string | null;
          to_phone: string;
        };
        Update: {
          attempts?: number;
          body?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['sms_kind'];
          order_id?: string | null;
          profile_id?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['sms_status'];
          status_updated_at?: string | null;
          to_phone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sms_messages_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'my_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sms_messages_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sms_messages_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      menu_foods: {
        Row: {
          business_id: string;
          category: string;
          description: string;
          id: string;
          is_available: boolean;
          name: string;
          photo_path: string | null;
          selling_price: number;
          sort_order: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'foods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'foods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      my_order_items: {
        Row: {
          food_id: string | null;
          id: string;
          is_unavailable: boolean;
          name: string;
          order_id: string;
          qty: number;
          selling_price: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'order_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'menu_foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'my_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      my_orders: {
        Row: {
          assigned_at: string | null;
          business_id: string;
          business_name: string;
          cancelled_at: string | null;
          delivered_at: string | null;
          delivery_date: string;
          delivery_fee: number;
          id: string;
          items_selling_total: number;
          location_label: string;
          location_lat: number;
          location_lng: number;
          location_note: string;
          location_room: string;
          order_number: string;
          picked_up_at: string | null;
          placed_at: string;
          status: Database['public']['Enums']['order_status'];
          total_to_collect: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'orders_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      public_settings: {
        Row: {
          cutoff_time: string;
          delivery_fee: number;
          delivery_window_text: string;
          free_delivery_over: number | null;
          free_delivery_until: string | null;
          help_phone: string;
          is_open: boolean | null;
          min_order_amount: number;
          ordering_enabled: boolean;
          server_now: string | null;
          today: string | null;
        };
        ComputedFields: never;
        Insert: {
          cutoff_time?: string | null;
          delivery_fee?: number | null;
          delivery_window_text?: string | null;
          free_delivery_over?: number | null;
          free_delivery_until?: string | null;
          help_phone?: string | null;
          is_open?: never;
          min_order_amount?: number | null;
          ordering_enabled?: boolean | null;
          server_now?: never;
          today?: never;
        };
        Update: {
          cutoff_time?: string | null;
          delivery_fee?: number | null;
          delivery_window_text?: string | null;
          free_delivery_over?: number | null;
          free_delivery_until?: string | null;
          help_phone?: string | null;
          is_open?: never;
          min_order_amount?: number | null;
          ordering_enabled?: boolean | null;
          server_now?: never;
          today?: never;
        };
        Relationships: [];
      };
      shops: {
        Row: {
          area: string;
          cover_photo_path: string | null;
          cuisine_tags: string[];
          id: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          area?: string | null;
          cover_photo_path?: string | null;
          cuisine_tags?: string[] | null;
          id?: string | null;
          name?: string | null;
          sort_order?: number | null;
        };
        Update: {
          area?: string | null;
          cover_photo_path?: string | null;
          cuisine_tags?: string[] | null;
          id?: string | null;
          name?: string | null;
          sort_order?: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_cancel_order: { Args: { p_order_id: string; p_reason?: string }; Returns: undefined };
      admin_override_delivery: {
        Args: {
          p_note?: string;
          p_order_id: string;
          p_reason: Database['public']['Enums']['override_reason'];
        };
        Returns: undefined;
      };
      admin_set_customer_blocked: {
        Args: { p_blocked: boolean; p_phone: string };
        Returns: string;
      };
      assign_orders: { Args: { p_order_ids: string[]; p_rider_id: string }; Returns: number };
      cancel_order: { Args: { p_order_id: string }; Returns: undefined };
      confirm_delivery: { Args: { p_code: string; p_order_id: string }; Returns: Json };
      is_registered_staff: {
        Args: { p_phone: string; p_role: Database['public']['Enums']['user_role'] };
        Returns: boolean;
      };
      order_rider_location: {
        Args: { p_order_id: string };
        Returns: { heading: number | null; lat: number; lng: number; updated_at: string }[];
      };
      place_order: {
        Args: {
          p_business_id: string;
          p_client_ref?: string;
          p_customer_name?: string;
          p_items: Json;
          p_location: Json;
          p_save_location?: boolean;
        };
        Returns: Json;
      };
      rider_update_location: {
        Args: {
          p_accuracy?: number;
          p_heading?: number;
          p_lat: number;
          p_lng: number;
          p_speed?: number;
        };
        Returns: undefined;
      };
      rider_mark_picked_up: { Args: { p_order_ids: string[] }; Returns: number };
      rider_set_item_unavailable: {
        Args: { p_order_item_id: string; p_unavailable?: boolean };
        Returns: Json;
      };
      sms_claim_batch: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          body: string;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['sms_kind'];
          order_id: string | null;
          profile_id: string | null;
          provider: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['sms_status'];
          status_updated_at: string | null;
          to_phone: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'sms_messages';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      sms_record_result: {
        Args: {
          p_error?: string;
          p_id: string;
          p_ok: boolean;
          p_provider: string;
          p_provider_message_id?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      order_status: 'placed' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
      override_reason: 'phone_off' | 'paid_in_person' | 'other';
      sms_kind:
        | 'login_code'
        | 'order_placed'
        | 'item_unavailable'
        | 'picked_up'
        | 'delivered'
        | 'order_cancelled'
        | 'other';
      sms_status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
      user_role: 'customer' | 'rider' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      order_status: ['placed', 'assigned', 'picked_up', 'delivered', 'cancelled'],
      override_reason: ['phone_off', 'paid_in_person', 'other'],
      sms_kind: [
        'login_code',
        'order_placed',
        'item_unavailable',
        'picked_up',
        'delivered',
        'order_cancelled',
        'other',
      ],
      sms_status: ['queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'],
      user_role: ['customer', 'rider', 'admin'],
    },
  },
} as const;
