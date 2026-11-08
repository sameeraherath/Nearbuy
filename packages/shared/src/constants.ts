export const TIMEZONE = 'Asia/Colombo';

export const ORDER_STATUSES = [
  'placed',
  'assigned',
  'picked_up',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The four happy-path steps shown on the customer tracking screen. */
export const ORDER_STEPS = [
  { status: 'placed', label: 'Placed' },
  { status: 'assigned', label: 'Rider assigned' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'delivered', label: 'Delivered' },
] as const satisfies readonly { status: OrderStatus; label: string }[];

export const USER_ROLES = ['customer', 'rider', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const OVERRIDE_REASONS = ['phone_off', 'paid_in_person', 'other'] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];
export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  phone_off: "Student's phone is off",
  paid_in_person: 'Paid in person',
  other: 'Other',
};

export const MAX_CODE_ATTEMPTS = 3;
export const MAX_ITEM_QTY = 20;
export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;

/** Error codes raised by Postgres functions (`raise exception 'NB_…'`) and their user-facing text. */
export const SERVER_ERRORS = {
  NB_ORDERING_CLOSED: 'Orders are closed for today',
  NB_MIN_ORDER: 'Minimum order is Rs {amount}',
  NB_BLOCKED: 'Your number has been blocked. Please contact us.',
  NB_NOT_AUTHENTICATED: 'Please log in to continue',
  NB_FORBIDDEN: 'You are not allowed to do that',
  NB_EMPTY_CART: 'Your cart is empty',
  NB_BAD_QTY: 'Each item must have a quantity between 1 and 20',
  NB_BUSINESS_UNAVAILABLE: 'This shop is not taking orders right now',
  NB_FOOD_UNAVAILABLE: 'Some items in your cart are no longer available',
  NB_NAME_REQUIRED: 'Please enter your name',
  NB_LOCATION_REQUIRED: 'Please choose a delivery location',
  NB_ORDER_NOT_FOUND: 'Order not found',
  NB_BAD_STATUS: 'This order can no longer be changed',
  NB_CODE_LOCKED: 'Call the student or contact admin',
  NB_RIDER_NOT_FOUND: 'Rider not found or inactive',
  NB_REASON_REQUIRED: 'Please choose a reason',
  NB_PROFILE_NOT_FOUND: 'No customer with that number',
} as const;
export type ServerErrorCode = keyof typeof SERVER_ERRORS;

/** Design tokens shared by all apps (section 10 of the spec). */
export const COLORS = {
  primary: '#FF9900',
  primaryPressed: '#EC7211',
  primaryTint: '#FFF4E0',
  navy: '#232F3E',
  text: '#16191F',
  textSecondary: '#545B64',
  background: '#F2F3F3',
  surface: '#FFFFFF',
  border: '#E9EBED',
  success: '#037F0C',
  error: '#D13212',
  /** Text colour on orange buttons — never white. */
  onPrimary: '#16191F',
} as const;

export const RADII = { card: 16, button: 16 } as const;
export const SIZES = {
  buttonHeight: 56,
  minTapTarget: 44,
  screenMargin: 16,
  minBodyText: 13,
} as const;

export const STORAGE_BUCKETS = {
  businessCovers: 'business-covers',
  foodPhotos: 'food-photos',
} as const;
