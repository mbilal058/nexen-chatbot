UPDATE public.bot_knowledge 
SET raw_text = REPLACE(raw_text, 
    'At the moment, BrightSmile PK does not have a branch in **that city**.
Our only clinic is located in **Karachi, Pakistan**.', 
    'At the moment, Our only clinic is located in Karachi, Sindh.')
WHERE id = 'd46524b7-1842-4d19-879c-70b3a64ed28d';