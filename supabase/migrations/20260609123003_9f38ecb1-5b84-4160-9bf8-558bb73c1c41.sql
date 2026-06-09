CREATE TABLE public.tool_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  file_names TEXT[] NOT NULL DEFAULT '{}',
  output_name TEXT,
  output_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_history TO authenticated;
GRANT ALL ON public.tool_history TO service_role;
ALTER TABLE public.tool_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own history" ON public.tool_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tool_history_user_created_idx ON public.tool_history(user_id, created_at DESC);