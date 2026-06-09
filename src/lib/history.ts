import { supabase } from "@/integrations/supabase/client";

export async function logHistory(entry: {
  tool_slug: string;
  tool_name: string;
  file_names: string[];
  output_name?: string;
  output_size?: number;
}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("tool_history" as never).insert({
      user_id: data.user.id,
      ...entry,
    } as never);
  } catch {
    // silent fail — history is best-effort
  }
}
