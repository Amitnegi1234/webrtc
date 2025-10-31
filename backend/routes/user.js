import express from "express";
import { getAllUsers } from "../controllers/user.js";
import { isLogin } from "../middleware/isLogin.js";
const router=express.Router();

router.get("/",isLogin,getAllUsers)

export const userRouter=router;