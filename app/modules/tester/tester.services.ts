import { supabase } from "../../config/supabase";
import { ITester } from "./tester.model";
import { sendEmail } from "../../common/service/email.service";

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

  // Send welcome email to the new tester (non-blocking)
  const registeredAt = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  sendEmail({
    to: testerData.email,
    subject: "Welcome to Expirely Beta Testing!",
    template: "tester-welcome",
    data: {
      username: testerData.username,
      email: testerData.email,
      registeredAt,
    },
  }).catch((err) => {
    console.error("[Email Error] Failed to send tester welcome email:", err.message);
  });

  // Notify admin about the new tester registration (non-blocking)
  sendEmail({
    to: process.env.EMAILS as string,
    subject: `🔔 New Tester: ${testerData.username} just registered!`,
    template: "tester-admin-notify",
    data: {
      username: testerData.username,
      email: testerData.email,
      notes: testerData.notes || "",
      registeredAt,
    },
  }).catch((err) => {
    console.error("[Email Error] Failed to send admin notification email:", err.message);
  });

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
