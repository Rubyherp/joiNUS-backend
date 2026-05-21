import { createClient } from "@supabase/supabase-js";
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Checking environment variables");
console.log("URL Found?:", !!supabaseUrl);
console.log("Key Found?:", !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase environment variables');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

