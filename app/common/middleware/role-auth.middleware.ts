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
      console.log("Auth Header:", authHeader);

      let token = "";
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }

      console.log(
        "Extracted Token:",
        token ? `${token.substring(0, 10)}...` : "NONE",
      );

      if (!token || token === "undefined" || token === "null") {
        throw createHttpError(401, {
          message: `Invalid token`,
        });
      }
      try {
        console.log("Verifying token...");
        const { verifyToken } = await import("../service/passport-jwt.service");
        const decodedUser = verifyToken(token);
        req.user = decodedUser as IUser;
        console.log("Token verified. User:", req.user.email);
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
        throw createHttpError(400, {
          message: error.message,
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
