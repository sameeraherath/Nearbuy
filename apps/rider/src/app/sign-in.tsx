import { PhoneSignIn } from '@/components/phone-sign-in';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  return (
    <PhoneSignIn
      app="rider"
      subtitle="Rider app. Sign in with the number your admin registered."
      createUser={false}
      beforeSend={async (phone) => {
        const { data, error } = await supabase.rpc('is_registered_staff', { p_phone: phone, p_role: 'rider' });
        if (error) return error.message;
        return data ? null : 'This number is not registered as a rider.';
      }}
    />
  );
}
