-- Remove overly permissive write policies on aircraft_positions table
-- The application only reads from this table, so write access should be server-side only

DROP POLICY IF EXISTS "Authenticated users can insert aircraft positions" ON public.aircraft_positions;
DROP POLICY IF EXISTS "Authenticated users can update aircraft positions" ON public.aircraft_positions;
DROP POLICY IF EXISTS "Authenticated users can delete aircraft positions" ON public.aircraft_positions;

-- Keep only the read policy ("Allow public read access to aircraft positions" remains)
-- Writes should be done via service role key in backend/edge functions only