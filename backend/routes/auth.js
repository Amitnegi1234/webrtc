import express from "express";
import { login, logout, signup } from "../controllers/auth.js";
import { isLogin } from "../middleware/isLogin.js";
const router=express.Router();

router.post("/login",login)
router.post("/signup",signup)
router.post("/logout",isLogin,logout)

export const authRouter=router;