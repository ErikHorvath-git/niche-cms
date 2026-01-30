import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SAAS_PLATFORM_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SAAS_PLATFORM_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase URL or ANON key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const bucket = 'content-images';

export async function uploadImage(file, clientId) {
  if (!file || !clientId) {
    throw new Error('clientId and file are required to upload image');
  }

  const safeFile = encodeURIComponent(`${Date.now()}_${file.name}`);
  const filePath = `${clientId}/${safeFile}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
    error: urlError
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (urlError) {
    throw urlError;
  }

  return publicUrl;
}
