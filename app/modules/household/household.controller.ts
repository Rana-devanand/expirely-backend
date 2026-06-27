import { Request, Response } from "express";
import * as householdService from "./household.service";

export const createHousehold = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Household name is required." });
    }
    const data = await householdService.createHousehold(user.id, name);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyHousehold = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = await householdService.getMyHousehold(user.id);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const joinHousehold = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { joinCode } = req.body;
    if (!joinCode) {
      return res.status(400).json({ success: false, message: "Join code is required." });
    }
    const data = await householdService.joinHousehold(user.id, joinCode);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const leaveHousehold = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    await householdService.leaveHousehold(user.id);
    res.status(200).json({ success: true, message: "You have left the household." });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMembers = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const household = await householdService.getMyHousehold(user.id);
    if (!household) {
      return res.status(404).json({ success: false, message: "You are not in a household." });
    }
    const data = await householdService.getHouseholdMembers(household.id);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const memberId = req.params.memberId as string;
    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required." });
    }
    await householdService.removeMember(user.id, memberId);
    res.status(200).json({ success: true, message: "Member removed from household successfully." });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
