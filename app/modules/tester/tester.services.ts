import { supabase } from "../../config/supabase";
import { ITester } from "./tester.model";

export const createTester = async (testerData: ITester) => {
  const { data, error } = await supabase
    .from("testers")
    .insert([
      {
        username: testerData.username,
        email: testerData.email,
        notes: testerData.notes,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};
export const getAllTesters = async () => {
  const { data, error } = await supabase
    .from("testers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
