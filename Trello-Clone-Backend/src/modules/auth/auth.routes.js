import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./auth.controller.js";

export const authRouter = Router();

authRouter.get("/setup-status", ah(c.setupStatusHandler));
authRouter.post("/setup", ah(c.setupHandler));
authRouter.post("/register", ah(c.registerHandler));
authRouter.post("/login", ah(c.loginHandler));
authRouter.post("/renew", ah(c.renewHandler));
authRouter.post("/forgot-password", ah(c.forgotPasswordHandler));
authRouter.post("/reset-password", ah(c.resetPasswordHandler));
authRouter.post("/logout", authenticate, ah(c.logoutHandler));
authRouter.post("/logout-all", authenticate, ah(c.logoutAllHandler));
authRouter.post("/change-password", authenticate, ah(c.changePasswordHandler));
