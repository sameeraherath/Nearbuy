import { z } from 'zod';
import { MAX_ITEM_QTY, OTP_LENGTH, OVERRIDE_REASONS } from './constants';
import { normalizeSriLankanMobile } from './phone';

export const phoneSchema = z.string().transform((value, ctx) => {
  const e164 = normalizeSriLankanMobile(value);
  if (!e164) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a Sri Lankan mobile number (07X XXX XXXX)',
    });
    return z.NEVER;
  }
  return e164;
});

export const otpSchema = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'Enter the 6-digit code');
export const deliveryCodeSchema = z.string().regex(/^\d{4}$/, 'Enter the 4-digit code');
export const rupeesSchema = z.number().int().nonnegative();
export const uuidSchema = z.string().uuid();

export const cartLineSchema = z.object({
  food_id: uuidSchema,
  qty: z.number().int().min(1).max(MAX_ITEM_QTY),
});

export const deliveryLocationSchema = z.object({
  place_id: uuidSchema.nullable().optional(),
  label: z.string().trim().min(1, 'Choose a location').max(80),
  room: z.string().trim().max(40).default(''),
  note: z.string().trim().max(200).default(''),
  lat: z.number().min(5.8).max(10),
  lng: z.number().min(79.4).max(82),
});

export const placeOrderInputSchema = z.object({
  business_id: uuidSchema,
  items: z.array(cartLineSchema).min(1, 'Your cart is empty'),
  location: deliveryLocationSchema,
  customer_name: z.string().trim().min(1).max(60).optional(),
  save_location: z.boolean().default(true),
});
export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;

export const businessSchema = z.object({
  name: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80).default(''),
  phone: phoneSchema.or(z.literal('')).optional(),
  cuisine_tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const foodSchema = z
  .object({
    business_id: uuidSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).default(''),
    category: z.string().trim().min(1).max(40),
    shop_price: rupeesSchema,
    selling_price: rupeesSchema,
    is_available: z.boolean().default(true),
    sort_order: z.number().int().default(0),
  })
  .refine((f) => f.selling_price >= f.shop_price, {
    message: 'Selling price should not be below the shop price',
    path: ['selling_price'],
  });

export const placeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(5.8).max(10),
  lng: z.number().min(79.4).max(82),
  sort_order: z.number().int().default(0),
});

export const riderSchema = z.object({
  full_name: z.string().trim().min(1).max(60),
  phone: phoneSchema,
  vehicle_note: z.string().trim().max(100).default(''),
});

export const settingsSchema = z.object({
  cutoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  delivery_window_text: z.string().trim().min(1).max(40),
  ordering_enabled: z.boolean(),
  delivery_fee: rupeesSchema,
  free_delivery_over: rupeesSchema.nullable(),
  free_delivery_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  min_order_amount: rupeesSchema,
  rider_pay_per_delivery: rupeesSchema,
  help_phone: z.string().trim().max(20),
});

export const overrideSchema = z
  .object({
    order_id: uuidSchema,
    reason: z.enum(OVERRIDE_REASONS),
    note: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.reason !== 'other' || (v.note && v.note.length > 0), {
    message: 'Please describe the reason',
    path: ['note'],
  });
