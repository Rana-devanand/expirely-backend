import dotenv from "dotenv";
import { UserService } from "../app/modules/user/user.services";
import { sendRawEmail } from "../app/common/service/email.service";

dotenv.config();

async function main() {
  const service = new UserService();
  const email = "dev.cloudapp93@gmail.com";

  console.log("--- TEST 1: Sending Raw Feedback-style Email ---");
  try {
    await sendRawEmail({
      to: email,
      subject: "[Expirely Test] Raw Email Direct to Inbox",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Raw Email</h2>
          <p>This is a plain feedback-style email sent to check delivery folder path.</p>
        </div>
      `,
    });
    console.log("✅ Raw Email sent!");
  } catch (err: any) {
    console.error("❌ Raw Email failed:", err.message);
  }

  console.log("\n--- TEST 2: Sending Templated Broadcast Email ---");
  try {
    const result = await service.broadcastEmail({
      subject: "Expirely Broadcast Template Test",
      content: "This is a broadcast test email using the broadcast.ejs HTML template.",
      recipients: [email],
    });
    console.log("✅ Broadcast Result:", result);
  } catch (err: any) {
    console.error("❌ Broadcast failed:", err.message);
  }
}

main();
