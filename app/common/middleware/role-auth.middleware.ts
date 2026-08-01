import { type NextFunction, type Request, type Response } from "express";
import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import process from "process";
import { type IUser, type Role } from "../../modules/user/user.model";

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export const roleAuth = (roles: Role[], publicRoutes: string[] = []) =>
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (publicRoutes.includes(req.path)) {
        next();
        return;
      }
      const authHeader = req.headers.authorization;
      let token = "";
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }

      if (!token || token === "undefined" || token === "null") {
        throw createHttpError(401, {
          message: `Invalid token`,
        });
      }
      try {
        const { verifyToken } = await import("../service/passport-jwt.service");
        const decodedUser = verifyToken(token) as any;
        if (decodedUser.type !== "access") {
          throw new Error("Invalid access token type");
        }
        req.user = decodedUser as IUser;
      } catch (error: any) {
        console.error("JWT Verify Error:", error.message);
        if (error.message === "jwt expired") {
          throw createHttpError(401, {
            message: `Token expired`,
            data: {
              type: "TOKEN_EXPIRED",
            },
          });
        }
        throw createHttpError(401, {
          message: "Invalid access token",
          data: { type: "ACCESS_TOKEN_INVALID" },
        });
      }
      const user = req.user as IUser;
      if (!roles.includes(user.role)) {
        const type =
          user.role.slice(0, 1) + user.role.slice(1).toLocaleLowerCase();

        throw createHttpError(401, {
          message: `${type} can not access this resource`,
        });
      }
      next();
    },
  );
