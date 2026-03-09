import { groqService } from "../../common/service/groq.service";

class AIService {
  async getStorageTips(productName: string) {
    return await groqService.generateStorageTips(productName);
  }

  async getRecipe(ingredients: string[]) {
    return await groqService.generateRecipe(ingredients);
  }

  async getHealthInsight(productName: string, category: string) {
    return await groqService.generateHealthInsight(productName, category);
  }

  async scanReceipt(base64Image: string) {
    return await groqService.analyzeReceipt(base64Image);
  }

  async getMealPlan(availableProducts: string[]) {
    return await groqService.generateMealPlan(availableProducts);
  }
}

export const aiService = new AIService();
