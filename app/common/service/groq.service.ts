import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export class GroqService {
  async generateNotificationMessage(action: string, context: any) {
    try {
      const prompt = `Generate a short, engaging, and professional notification message for a "Smart Expiry Tracker" app.
      
      Action performed: "${action}"
      Detailed Context: ${JSON.stringify(context)}
      
      Requirements:
      1. For "ADD_PRODUCT": Explicitly mention the name, quantity, and category. Explain that it's now being tracked.
      2. For "UPDATE_PRODUCT": Describe what changed (if provided in context) or at least name the product.
      3. For "DELETE_PRODUCT": Name the product that was removed to keep the user informed.
      4. For "MARK_CONSUMED": Enthusiastically mention the product name and celebrate zero-waste!
      5. For "MARK_ACTIVE": Mention the product name and its return to inventory.
      
      CRITICAL: If the category is "Medicine", add a suffix: "⚠️ Note: Check instructions before use."
      
      The message MUST include:
      - "title": A catchy headline (with emojis).
      - "body": A detailed but concise description of exactly what happened. (Max 150 chars).
      
      Return as a raw JSON object like: {"title": "...", "body": "..."}`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate message from Groq");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq AI Error:", error);
      return this.getFallbackMessage(action);
    }
  }

  async generateExpiryAlertMessages(productName: string, category: string) {
    try {
      const isMedicine =
        category.toLowerCase().includes("medicine") ||
        productName.toLowerCase().includes("medicine");

      const prompt = `Generate 4 creative, engaging, and professional notification messages for a product named "${productName}" (Category: ${category}) in a "Smart Expiry Tracker" app.
      
      We need messages for 4 stages:
      1. "Coming Soon" (7 days before expiry)
      2. "Getting Closer" (3 days before expiry)
      3. "Tomorrow" (1 day before expiry)
      4. "Today" (Day of expiry)
      
      ${isMedicine ? `CRITICAL: This is a MEDICINE. The messages MUST include serious safety warnings. Mention that using expired medicine can be dangerous, ineffective, or cause side effects. Phrases like "Don't risk it", "Consult a doctor", or "Side effects possible" should be used.` : ""}
      
      Each message should have a ${isMedicine ? "serious warning" : "funny or helpful"} "title" and a short "body" (under 100 chars).
      Use emojis related to ${isMedicine ? "pharmacy/health" : "the product or category"}.
      
      Return as a JSON object:
      {
        "sevenDays": {"title": "...", "body": "..."},
        "threeDays": {"title": "...", "body": "..."},
        "oneDay": {"title": "...", "body": "..."},
        "today": {"title": "...", "body": "..."}
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate expiry messages");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq AI Expiry Error:", error);
      return {
        sevenDays: {
          title: "Upcoming Expiry",
          body: `${productName} will expire in 7 days. Plan ahead!`,
        },
        threeDays: {
          title: "Expiry Warning",
          body: `${productName} will expire in 3 days.`,
        },
        oneDay: {
          title: "Urgent Alert",
          body: `${productName} expires tomorrow!`,
        },
        today: {
          title: "Expired Today",
          body: `${productName} expires today. Use it now!`,
        },
      };
    }
  }

  async extractDatesFromImage(base64Image: string) {
    try {
      const prompt = `Extract the Manufacturing Date (MFG) and Expiry Date (EXP) from this product label image. 
      The product could be anything: Food, Medicine, Drink, etc.
      Look for text like "MFG", "EXP", "Best Before", "Use By", "Mfd Date", etc.
      
      Return as a JSON object:
      {
        "mfgDate": "YYYY-MM-DD" (or null if not found),
        "expiryDate": "YYYY-MM-DD" (or null if not found),
        "confidence": 0-1
      }
      If the date format is dd/mm/yyyy or mm/yyyy, convert it to YYYY-MM-DD.`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        model: "llama-3.2-11b-vision-preview",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to extract dates from image");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Vision Error:", error);
      throw new Error("Failed to analyze image for dates");
    }
  }

  async generateStorageTips(productName: string) {
    try {
      const prompt = `Provide 3 actionable and short professional storage tips for "${productName}". 
      Focus on how to keep it fresh for as long as possible.
      Include one "Did you know?" style fact about its shelf life.
      
      Return as a JSON object:
      {
        "product": "${productName}",
        "tips": ["Tip 1", "Tip 2", "Tip 3"],
        "fact": "Did you know..."
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate storage tips");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Storage Tips Error:", error);
      return {
        product: productName,
        tips: [
          "Store in a cool, dry place.",
          "Keep away from direct sunlight.",
          "Seal tightly after opening.",
        ],
        fact: "Proper storage can extend shelf life significantly!",
      };
    }
  }

  async generateRecipe(ingredients: string[]) {
    try {
      const prompt = `Generate a creative and easy-to-follow recipe using these ingredients: ${ingredients.join(", ")}.
      The recipe should focus on "Zero Waste" by using up items that might be near expiry.
      
      Return as a JSON object:
      {
        "title": "Recipe Title",
        "servings": "2",
        "prepTime": "15 mins",
        "ingredients": ["...", "..."],
        "instructions": ["Step 1", "Step 2", "..."],
        "wasteTip": "Why this recipe helps reduce waste"
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate recipe");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Recipe Error:", error);
      throw new Error("Failed to generate recipe");
    }
  }

  async generateMealPlan(availableProducts: string[]) {
    try {
      const prompt = `Generate a 1-day meal plan (Breakfast, Lunch, Dinner) using some of these ingredients: ${availableProducts.join(", ")}. 
      Include 1 simple snack. Focus on minimizing waste.
      
      Return as a JSON object:
      {
        "breakfast": { "name": "", "ingredients": [], "instructions": "" },
        "lunch": { "name": "", "ingredients": [], "instructions": "" },
        "dinner": { "name": "", "ingredients": [], "instructions": "" },
        "snack": { "name": "", "description": "" }
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate meal plan");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Meal Plan Error:", error);
      return {
        breakfast: {
          name: "Quick Oatmeal",
          ingredients: ["Oats", "Milk/Water"],
          instructions: "Boil and serve.",
        },
        lunch: {
          name: "Garden Salad",
          ingredients: ["Mixed Greens", "Dressing"],
          instructions: "Toss and serve.",
        },
        dinner: {
          name: "Stir-fry",
          ingredients: ["Vegetables", "Protein"],
          instructions: "Sauté and enjoy.",
        },
        snack: { name: "Fresh Fruit", description: "Seasonal fruit piece." },
      };
    }
  }

  async generateDailyRecap(newProducts: any[]) {
    try {
      const productNames = newProducts.map((p) => p.name).join(", ");
      const prompt = `Generate a warm and helpful evening recap notification for a "Smart Expiry Tracker" app.
      
      The user added these products today: ${productNames}.
      
      Requirements:
      1. Summarize the items added today.
      2. Encourage the user to check their inventory before sleeping.
      3. Keep it friendly and pro-active.
      
      Return as a JSON object: {"title": "...", "body": "..."}`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate daily recap");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Daily Recap Error:", error);
      return {
        title: "🌙 Evening Inventory Recap",
        body: `You added ${newProducts.length} new items today. Keep up the great work reducing waste!`,
      };
    }
  }

  async analyzeReceipt(base64Image: string) {
    try {
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all purchased food and medicine items from this receipt. 
                For each item, provide:
                - name: item name
                - category: Dairy, Fruits, Medicine, Vegetables, Bakery, Meat, Staples, or Other
                - quantity: numerical value
                - expiryDays: estimated days until expiry from today (be realistic based on item type)
                
                Return a JSON object with an "items" array:
                { "items": [ { "name": "", "category": "", "quantity": "", "expiryDays": 0 } ] }`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        model: "llama-3.2-11b-vision-preview",
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to extract items from receipt");
      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Vision Error:", error);
      throw new Error("Failed to process receipt image");
    }
  }

  async estimateExpiryFromMetadata(metadata: { name: string; category: string; ingredients?: string; entryDate?: string }) {
    try {
      const prompt = `Estimate the typical shelf life and a realistic expiry date for this product.
      
      Product Name: "${metadata.name}"
      Category: "${metadata.category}"
      Ingredients: "${metadata.ingredients || "Unknown"}"
      First Seen/Entry Date: "${metadata.entryDate || "Today"}"
      
      Requirements:
      1. Analyze the product type (e.g., canned food, medicine, fresh dairy, dried noodles).
      2. Based on typical shelf life for this category, calculate the "estimatedExpiryDate" (YYYY-MM-DD).
      3. Provide a "shelfLifeMonths" (approximate number).
      4. Provide a "confidence" score (0-1) based on how common the product is.
      5. Add "reasoning" (briefly explain why this date was chosen).
      
      Return as a JSON object:
      {
        "estimatedExpiryDate": "YYYY-MM-DD",
        "shelfLifeMonths": 0,
        "confidence": 0,
        "reasoning": "...",
        "storageTip": "..."
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to estimate expiry");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Estimation Error:", error);
      return {
        estimatedExpiryDate: null,
        shelfLifeMonths: 6,
        confidence: 0.1,
        reasoning: "Fallback to default category average due to AI error.",
        storageTip: "Store in a cool, dry place."
      };
    }
  }

  async generateHealthInsight(productName: string, category: string) {
    try {
      const prompt = `Analyze the health benefits and potential concerns for "${productName}" (Category: ${category}). 
      Provide 3 key nutritional benefits and 1 healthy way to consume it.
      
      Return as a JSON object:
      {
        "product": "${productName}",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
        "consumptionTip": "Healthy tip...",
        "healthScore": 1-10
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("Failed to generate health insight");

      return JSON.parse(content);
    } catch (error) {
      console.error("Groq Health Insight Error:", error);
      return {
        product: productName,
        benefits: [
          "Source of nutrients.",
          "Part of a balanced diet.",
          "Helpful for energy.",
        ],
        consumptionTip: "Balance it with other food groups.",
        healthScore: 7,
      };
    }
  }

  private getFallbackMessage(action: string) {
    switch (action) {
      case "ADD_PRODUCT":
        return {
          title: "Product Added",
          body: "New item successfully tracked!",
        };
      case "UPDATE_PROFILE":
        return {
          title: "Profile Updated",
          body: "Your profile details have been saved.",
        };
      case "ADD_CATEGORY":
        return {
          title: "Category Created",
          body: "A new category is ready for use.",
        };
      default:
        return {
          title: "Notification",
          body: "Action performed successfully.",
        };
    }
  }
}

export const groqService = new GroqService();
