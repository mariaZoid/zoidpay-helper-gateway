import jwt from "jsonwebtoken";
import { Request, Response} from "express";
import { NextFunction } from "express";

export const generateWebToken = (email: string) => {
  const secret = process.env.TOKEN_SECRET!;
  return jwt.sign({ email }, secret, { expiresIn: "1h" }); // refresh token la 1 h
};

export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(
    token,
    process.env.TOKEN_SECRET as string,
    (err: any, user: any) => {
      console.log(err);

      if (err) return res.sendStatus(403);

      req.user = user;

      next();
    }
  );
};