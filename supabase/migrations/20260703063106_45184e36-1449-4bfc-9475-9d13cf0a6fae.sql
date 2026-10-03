
-- FAQs table
CREATE TABLE public.dental_faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  question_en TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  question_roman TEXT NOT NULL,
  answer_roman TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dental_faqs TO anon;
GRANT SELECT ON public.dental_faqs TO authenticated;
GRANT ALL ON public.dental_faqs TO service_role;

ALTER TABLE public.dental_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQs are readable by everyone"
  ON public.dental_faqs FOR SELECT
  USING (true);

-- Leads table
CREATE TABLE public.human_handoff_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  issue TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.human_handoff_leads TO anon;
GRANT INSERT ON public.human_handoff_leads TO authenticated;
GRANT ALL ON public.human_handoff_leads TO service_role;

ALTER TABLE public.human_handoff_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.human_handoff_leads FOR INSERT
  WITH CHECK (
    length(name) BETWEEN 1 AND 100
    AND length(phone) BETWEEN 5 AND 30
    AND length(issue) BETWEEN 1 AND 1000
  );

-- Seed FAQ content
INSERT INTO public.dental_faqs (category, question_en, answer_en, question_roman, answer_roman) VALUES
('pricing',
 'What are your prices?',
 'Consultation: Rs. 1,500. Scaling & Polishing: Rs. 5,000. Tooth Filling: from Rs. 3,500. Root Canal: from Rs. 12,000. Braces: from Rs. 90,000. Teeth Whitening: Rs. 15,000. Final pricing depends on your case after the doctor examines you.',
 'Aap ki fees kya hai?',
 'Consultation: Rs. 1,500. Scaling aur Polishing: Rs. 5,000. Filling: Rs. 3,500 se shuru. Root Canal: Rs. 12,000 se shuru. Braces: Rs. 90,000 se shuru. Teeth Whitening: Rs. 15,000. Final price doctor ke check-up ke baad batai jati hai.'),
('services',
 'What services do you offer?',
 'We offer: General Check-ups, Scaling & Polishing, Fillings, Root Canal Treatment, Tooth Extraction, Braces & Orthodontics, Teeth Whitening, Dental Implants, and Kids Dentistry.',
 'Aap kya services dete hain?',
 'Hum yeh services dete hain: General Check-up, Scaling & Polishing, Filling, Root Canal, Tooth Extraction (danth nikalna), Braces, Teeth Whitening, Dental Implants, aur Bachon ki Dentistry.'),
('timings',
 'What are your clinic timings?',
 'We are open Monday to Saturday, 10:00 AM to 9:00 PM. Sunday is closed. Emergency cases can call our helpline.',
 'Clinic ke timings kya hain?',
 'Hum Monday se Saturday khule hain, subah 10 baje se raat 9 baje tak. Sunday band hota hai. Emergency ke liye helpline par call karain.'),
('location',
 'Where are you located?',
 'We are located at 24-C, Main Boulevard, Gulberg III, Lahore. Free parking is available. Google Maps: search "Bright Smile Dental Clinic".',
 'Aap ka clinic kahan hai?',
 'Hamara clinic hai: 24-C, Main Boulevard, Gulberg III, Lahore. Free parking available hai. Google Maps par "Bright Smile Dental Clinic" search karain.');
