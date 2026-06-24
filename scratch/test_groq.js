const dotenv = require("dotenv");
dotenv.config();
const Groq = require("groq-sdk");

async function main() {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    fetch: globalThis.fetch
  });

  try {
    console.log("Calling Groq API using Key:", process.env.GROQ_API_KEY ? "EXISTS" : "MISSING");
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Write a short test sentence." }],
      model: "llama-3.3-70b-versatile",
    });
    console.log("Success! Response:");
    console.log(chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Groq Error details:", error);
  }
}

main();
