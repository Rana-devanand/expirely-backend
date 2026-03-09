import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as testerService from "./tester.services";

export const registerTester = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, notes } = req.body;

  if (!username || !email) {
    res.status(400);
    throw new Error("Username and email are required");
  }

  try {
    const tester = await testerService.createTester({ username, email, notes });
    res.status(201).json({
      success: true,
      message: "Tester registered successfully",
      data: tester,
    });
  } catch (error: any) {
    if (error.code === "23505") { // Unique violation in Postgres
      res.status(400);
      throw new Error("This email is already registered as a tester");
    }
    throw error;
  }
});

export const getTesters = asyncHandler(async (req: Request, res: Response) => {
  const result = await testerService.getAllTesters();
  res.status(200).json({
    success: true,
    data: result
  });
});
