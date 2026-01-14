-- Enable Row Level Security on aircraft_positions table
ALTER TABLE public.aircraft_positions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (since this appears to be public data)
CREATE POLICY "Allow public read access to aircraft positions"
ON public.aircraft_positions
FOR SELECT
USING (true);

-- Create policy for authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can insert aircraft positions"
ON public.aircraft_positions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update aircraft positions"
ON public.aircraft_positions
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete aircraft positions"
ON public.aircraft_positions
FOR DELETE
TO authenticated
USING (true);