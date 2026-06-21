import "dotenv/config";

async function run() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const json = (await res.json()) as any;
    
    if (json.models) {
      console.log("Found models:");
      const filtered = json.models.filter((m: any) => 
        m.name.includes("flash") || m.name.includes("gemini")
      );
      for (const m of filtered) {
        console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(", ")})`);
      }
    } else {
      console.log("No models field in response:", json);
    }
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

run();
