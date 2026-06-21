import { Request, Response } from "express";
import * as recurringService from "./recurring.service";

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = await recurringService.getRecurringProducts(user.id);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = await recurringService.createRecurringProduct(user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const id = req.params.id as string;
    const data = await recurringService.updateRecurringProduct(user.id, id, req.body);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const id = req.params.id as string;
    await recurringService.deleteRecurringProduct(user.id, id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const addProductFromTemplate = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const id = req.params.id as string;
    await recurringService.logTemplateAdded(user.id, id);
    res.status(200).json({ success: true, message: "Template usage tracked" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
