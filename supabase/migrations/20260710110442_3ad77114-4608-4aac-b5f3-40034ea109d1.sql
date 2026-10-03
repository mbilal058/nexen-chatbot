
CREATE TABLE public.clinic_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_en text NOT NULL DEFAULT '',
  content_roman text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true UNIQUE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_info TO authenticated;
GRANT ALL ON public.clinic_info TO service_role;

ALTER TABLE public.clinic_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read clinic_info" ON public.clinic_info
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "staff update clinic_info" ON public.clinic_info
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.clinic_info (content_en, content_roman) VALUES (
$EN$
CLINIC: BrightSmile PK — a modern dental clinic in Karachi, Pakistan.

SERVICES & PRICES:
1. General Consultation & Routine Checkups (oral assessment, digital X-rays, treatment planning) — Rs. 3,000
2. Teeth Scaling & Professional Polishing (ultrasonic scaling + high-gloss polish) — Rs. 5,000 – Rs. 9,000 depending on buildup
3. Advanced Root Canal Treatment (RCT), per tooth — starting Rs. 12,000
4. Teeth Whitening & Cosmetic Dentistry (whitening, veneers, bonding, smile makeovers) — Rs. 18,000 per session
5. Dental Implants, Crowns & Braces (titanium implants, porcelain crowns, orthodontics) — starting Rs. 25,000 (consultation required for exact quote)

TIMINGS:
Monday to Saturday: 9:00 AM – 8:00 PM. Sunday: closed.

CONTACT:
Phone: +92 42 1234 5678
Email: hello@brightsmile.pk

LOCATION:
Suite 402, 4th Floor, Medical Arts Plaza, Downtown Branch, Karachi, Pakistan.

APPOINTMENTS:
Patients can book directly in this chat — when they want to book, trigger the appointment form.
$EN$,
$ROMAN$
CLINIC: BrightSmile PK — Karachi, Pakistan mein aik modern dental clinic.

SERVICES aur PRICES:
1. General Consultation & Routine Checkups (oral checkup, digital X-rays, treatment plan) — Rs. 3,000
2. Teeth Scaling & Polishing (ultrasonic scaling + polish) — Rs. 5,000 – Rs. 9,000 (buildup ke hisab se)
3. Root Canal Treatment (RCT), per tooth — Rs. 12,000 se shuru
4. Teeth Whitening & Cosmetic Dentistry (whitening, veneers, bonding, smile makeover) — Rs. 18,000 per session
5. Dental Implants, Crowns & Braces (titanium implants, porcelain crowns, orthodontics) — Rs. 25,000 se shuru (exact quote consultation ke baad)

TIMINGS:
Somvaar se Hafta: subah 9:00 baje se raat 8:00 baje tak. Itwaar: bandh.

CONTACT:
Phone: +92 42 1234 5678
Email: hello@brightsmile.pk

LOCATION:
Suite 402, 4th Floor, Medical Arts Plaza, Downtown Branch, Karachi, Pakistan.

APPOINTMENTS:
Marizeen isi chat mein appointment book kar sakte hain — jab wo book karna chahein to appointment form dikhaen.
$ROMAN$
);
