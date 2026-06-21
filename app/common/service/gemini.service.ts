type AppNotification = {
  title: string;
  body: string;
};

type ExpiryStageMessages = {
  sevenDays: AppNotification;
  threeDays: AppNotification;
  oneDay: AppNotification;
  today: AppNotification;
};

class GeminiService {
  private readonly apiKey = process.env.GEMINI_API_KEY || "";
  private readonly model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  private readonly endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

  async generateNotificationMessage(action: string, context: any) {
    if (!this.apiKey) {
      return this.getFallbackMessage(action, context);
    }

    const prompt = [
      `Generate one exact app notification for the action "${action}" in a Smart Expiry Tracker app.`,
      `Context: ${JSON.stringify(context)}`,
      `Rules:`,
      `- Describe exactly what the user did.`,
      `- Do not invent details that are not present in context.`,
      `- If daysLeft is present, use the exact value. Never say "tomorrow" unless daysLeft is 1.`,
      `- If daysLeft is 0, say "today". If daysLeft is greater than 7, mention the actual days left or expiry date.`,
      `- Keep the body under 140 characters.`,
      `- Return only valid JSON: {"title":"...","body":"..."}`,
    ].join("\n");

    try {
      const parsed = await this.generateJson<AppNotification>(prompt);
      if (!parsed?.title || !parsed?.body) {
        throw new Error("Gemini notification response missing fields");
      }
      return parsed;
    } catch (error) {
      console.error("Gemini notification generation failed:", error);
      return this.getFallbackMessage(action, context);
    }
  }

  async generateExpiryAlertMessages(productName: string, category: string) {
    if (!this.apiKey) {
      return this.getFallbackExpiryMessages(productName, category);
    }

    const prompt = [
      `Generate expiry notifications for product "${productName}" in category "${category}".`,
      `Return exactly four stages: sevenDays, threeDays, oneDay, today.`,
      `Rules:`,
      `- sevenDays must say 7 days or 1 week.`,
      `- threeDays must say 3 days.`,
      `- oneDay must say tomorrow or 1 day.`,
      `- today must say today or expired today.`,
      `- Never mix stages or use the wrong relative date.`,
      `- For medicine, include a clear safety warning on oneDay and today.`,
      `- Keep each body under 100 characters.`,
      `- Return only valid JSON in this shape: {"sevenDays":{"title":"","body":""},"threeDays":{"title":"","body":""},"oneDay":{"title":"","body":""},"today":{"title":"","body":""}}`,
    ].join("\n");

    try {
      const parsed = await this.generateJson<ExpiryStageMessages>(prompt);
      if (
        !parsed?.sevenDays?.body ||
        !parsed?.threeDays?.body ||
        !parsed?.oneDay?.body ||
        !parsed?.today?.body
      ) {
        throw new Error("Gemini expiry response missing fields");
      }
      return parsed;
    } catch (error) {
      console.error("Gemini expiry message generation failed:", error);
      return this.getFallbackExpiryMessages(productName, category);
    }
  }

  private async generateJson<T>(prompt: string): Promise<T> {
    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Gemini HTTP ${response.status}: ${responseText.substring(0, 300)}`,
      );
    }

    const data = (await response.json()) as any;
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.find((part: any) => part.text)?.text;

    if (!text) {
      throw new Error("Gemini returned empty content");
    }

    return JSON.parse(text) as T;
  }

  private getFallbackMessage(action: string, context: any): AppNotification {
    const productName = context?.productName || "Product";
    const category = context?.category ? ` (${context.category})` : "";
    const qty =
      context?.qty !== undefined && context?.qty !== null
        ? ` Qty: ${context.qty}.`
        : "";
    const expirySuffix = this.getExpirySuffix(context);

    switch (action) {
      case "ADD_PRODUCT":
        return {
          title: "Product Added",
          body: `${productName}${category} is now tracked.${qty}${expirySuffix}`.trim(),
        };
      case "UPDATE_PRODUCT":
        return {
          title: "Product Updated",
          body: `${productName} details were updated.${qty}${expirySuffix}`.trim(),
        };
      case "DELETE_PRODUCT":
        return {
          title: "Product Deleted",
          body: `${productName} was removed from inventory.`,
        };
      case "MARK_CONSUMED":
        return {
          title: "Marked as Used",
          body: `${productName} was marked as used.`,
        };
      case "MARK_ACTIVE":
        return {
          title: "Back in Inventory",
          body: `${productName} was marked active again.`,
        };
      case "UPDATE_PROFILE":
        return {
          title: "Profile Updated",
          body: "Your profile details have been updated.",
        };
      case "CHANGE_PASSWORD":
        return {
          title: "Password Changed",
          body: "Your password was changed successfully.",
        };
      case "ADD_CATEGORY":
        return {
          title: "Category Added",
          body: `${context?.categoryName || "Category"} is ready to use.`,
        };
      default:
        return {
          title: "Update Saved",
          body: "Your action was completed successfully.",
        };
    }
  }

  private getExpirySuffix(context: any) {
    const daysLeft = context?.daysLeft;
    const expiryDate = context?.expiryDate;

    if (typeof daysLeft === "number") {
      if (daysLeft < 0) return " It is already expired.";
      if (daysLeft === 0) return " It expires today.";
      if (daysLeft === 1) return " It expires tomorrow.";
      return ` It expires in ${daysLeft} days.`;
    }

    if (expiryDate) {
      return ` Expires on ${expiryDate}.`;
    }

    return "";
  }

  private getFallbackExpiryMessages(
    productName: string,
    category: string,
  ): ExpiryStageMessages {
    const isMedicine =
      category.toLowerCase().includes("medicine") ||
      productName.toLowerCase().includes("medicine");

    return {
      sevenDays: {
        title: "Upcoming Expiry",
        body: `${productName} will expire in 7 days. Plan ahead!`,
      },
      threeDays: {
        title: "Expiry Warning",
        body: `${productName} will expire in 3 days. Use it soon!`,
      },
      oneDay: {
        title: isMedicine ? "Medicine Alert" : "Tomorrow Alert",
        body: isMedicine
          ? `${productName} expires tomorrow. Do not use it past expiry.`
          : `${productName} expires tomorrow. Use it soon!`,
      },
      today: {
        title: isMedicine ? "Expired Medicine" : "Expires Today",
        body: isMedicine
          ? `${productName} expires today. Avoid using it after today.`
          : `${productName} expires today. Use it now!`,
      },
    };
  }
}

export const geminiService = new GeminiService();
